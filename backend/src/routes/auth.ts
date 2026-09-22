import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { db, tx } from '../db/index.js';
import type { UserRow } from '../db/types.js';
import { audit } from '../domain/audit.js';
import { DUMMY_HASH, checkPassword, hashPassword, passwordPolicy, permissionsFor, staffUser } from '../domain/passwords.js';
import { Errors } from '../lib/errors.js';
import { iso, parse } from '../lib/http.js';
import { MIN } from '../lib/time.js';
import { hmac, randomInt, randomToken, safeEqual, sha256 } from '../lib/security.js';
import { maskEmail, sendMessage } from '../lib/notifier.js';
import { requireStaff, signStaffToken } from '../middleware/auth.js';
import { loginLimiter, otpLimiter } from '../middleware/core.js';

export const authRouter = Router();

const OTP_TTL_MS = 5 * MIN;
const RESEND_COOLDOWN_S = 45;
const MAX_RESENDS = 3;
const MAX_OTP_ATTEMPTS = 5;
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * MIN;

const findUser = (identifier: string) => {
  const id = identifier.trim().toLowerCase();
  return db.prepare('SELECT * FROM users WHERE lower(email) = ? OR lower(official_id) = ?').get(id, id) as UserRow | undefined;
};

function issueOtp(user: UserRow, challengeId: string, now: number): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  db.prepare('UPDATE otp_challenges SET code_hash = ?, expires_at = ?, last_sent_at = ?, attempts = 0 WHERE id = ?').run(
    hmac(`${challengeId}:${code}`), now + OTP_TTL_MS, now, challengeId,
  );
  void sendMessage({
    to: user.email,
    subject: 'Your Sanket verification code',
    text: `Your verification code is ${code}. It expires in 5 minutes. If you did not try to sign in, contact your administrator.`,
  });
  return code;
}

/** Step 1 of authority sign-in: official ID or e-mail + password → OTP challenge. */
authRouter.post('/auth/login', loginLimiter, async (req, res) => {
  const { identifier, password } = parse(
    z.object({ identifier: z.string().min(3).max(120), password: z.string().min(1).max(128) }),
    req.body,
  );
  const now = Date.now();
  const user = findUser(identifier);
  const label = identifier.trim().slice(0, 60);

  if (user?.locked_until && user.locked_until > now) {
    audit(req, { action: 'auth.login', actor: { id: user.id, label: user.official_id }, result: 'failed', meta: { reason: 'locked' } });
    throw Errors.locked('Too many failed attempts. Try again later.', Math.ceil((user.locked_until - now) / 1000));
  }

  const passwordOk = await checkPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || user.status !== 'active' || !passwordOk) {
    if (user) {
      const attempts = user.failed_attempts + 1;
      const lock = attempts >= MAX_FAILED_LOGINS ? now + LOCK_MS : null;
      db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?').run(
        lock ? 0 : attempts, lock, now, user.id,
      );
    }
    audit(req, {
      action: 'auth.login',
      actor: { id: user?.id ?? null, label: user?.official_id ?? label },
      result: 'failed',
      meta: { reason: 'invalid_credentials' },
    });
    throw Errors.unauthorized('Invalid official ID/e-mail or password', 'INVALID_CREDENTIALS');
  }

  const challengeId = randomToken(18);
  tx(() => {
    db.prepare('UPDATE otp_challenges SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL').run(now, user.id);
    db.prepare(
      `INSERT INTO otp_challenges(id, user_id, code_hash, expires_at, last_sent_at, created_at)
       VALUES(?, ?, '', ?, ?, ?)`,
    ).run(challengeId, user.id, now + OTP_TTL_MS, now, now);
  });
  const code = issueOtp(user, challengeId, now);

  res.json({
    challengeId,
    channel: 'email',
    destination: maskEmail(user.email),
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendAfterSeconds: RESEND_COOLDOWN_S,
    ...(config.DEV_EXPOSE_OTP ? { devOtp: code } : {}),
  });
});

authRouter.post('/auth/resend-otp', otpLimiter, (req, res) => {
  const { challengeId } = parse(z.object({ challengeId: z.string().min(8).max(64) }), req.body);
  const now = Date.now();
  const ch = db.prepare('SELECT * FROM otp_challenges WHERE id = ?').get(challengeId) as
    | { id: string; user_id: string; last_sent_at: number; resends: number; consumed_at: number | null }
    | undefined;
  if (!ch || ch.consumed_at) throw Errors.unauthorized('This verification request is no longer valid', 'INVALID_OTP');

  const wait = Math.ceil((ch.last_sent_at + RESEND_COOLDOWN_S * 1000 - now) / 1000);
  if (wait > 0) throw Errors.rateLimited(wait, `Please wait ${wait}s before requesting another code.`);
  if (ch.resends >= MAX_RESENDS) throw Errors.rateLimited(300, 'Resend limit reached. Please sign in again.');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(ch.user_id) as UserRow;
  db.prepare('UPDATE otp_challenges SET resends = resends + 1 WHERE id = ?').run(ch.id);
  const code = issueOtp(user, ch.id, now);
  res.json({ resent: true, resendAfterSeconds: RESEND_COOLDOWN_S, ...(config.DEV_EXPOSE_OTP ? { devOtp: code } : {}) });
});

/** Step 2: verify the OTP, open a revocable session. */
authRouter.post('/auth/verify-otp', otpLimiter, (req, res) => {
  const { challengeId, otp } = parse(
    z.object({ challengeId: z.string().min(8).max(64), otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits') }),
    req.body,
  );
  const now = Date.now();

  const outcome = tx(() => {
    const ch = db.prepare('SELECT * FROM otp_challenges WHERE id = ?').get(challengeId) as
      | { id: string; user_id: string; code_hash: string; expires_at: number; attempts: number; consumed_at: number | null }
      | undefined;
    if (!ch || ch.consumed_at || ch.expires_at < now) return { ok: false as const, code: 'INVALID_OTP', userId: ch?.user_id ?? null };
    if (ch.attempts >= MAX_OTP_ATTEMPTS) {
      db.prepare('UPDATE otp_challenges SET consumed_at = ? WHERE id = ?').run(now, ch.id);
      return { ok: false as const, code: 'OTP_ATTEMPTS_EXCEEDED', userId: ch.user_id };
    }
    db.prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?').run(ch.id);
    if (!safeEqual(hmac(`${ch.id}:${otp}`), ch.code_hash)) return { ok: false as const, code: 'INVALID_OTP', userId: ch.user_id };
    db.prepare('UPDATE otp_challenges SET consumed_at = ? WHERE id = ?').run(now, ch.id);
    return { ok: true as const, userId: ch.user_id };
  });

  const user = outcome.userId
    ? (db.prepare(`SELECT * FROM users WHERE id = ? AND status = 'active'`).get(outcome.userId) as UserRow | undefined)
    : undefined;

  if (!outcome.ok || !user) {
    audit(req, {
      action: 'auth.otp',
      actor: { id: outcome.userId, label: user?.official_id ?? 'unknown' },
      result: 'failed',
      meta: { reason: outcome.ok ? 'inactive' : outcome.code },
    });
    throw Errors.unauthorized(
      outcome.ok || outcome.code === 'INVALID_OTP' ? 'Invalid or expired code' : 'Too many incorrect attempts. Please sign in again.',
      outcome.ok ? 'INVALID_OTP' : outcome.code,
    );
  }

  const sessionId = randomToken(18);
  const expiresAt = now + config.STAFF_SESSION_MINUTES * MIN;
  db.prepare('INSERT INTO sessions(id, user_id, created_at, expires_at) VALUES(?,?,?,?)').run(sessionId, user.id, now, expiresAt);
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, user.id);
  audit(req, { action: 'auth.login', actor: { id: user.id, label: user.official_id }, result: 'success' });

  res.json({
    accessToken: signStaffToken(user.id, sessionId, expiresAt),
    tokenType: 'Bearer',
    expiresAt: iso(expiresAt),
    user: staffUser({ ...user, last_login_at: now }),
    permissions: permissionsFor(user.role),
  });
});

authRouter.get('/auth/me', requireStaff, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.staff!.userId) as UserRow;
  res.json({ user: staffUser(user), permissions: permissionsFor(user.role) });
});

authRouter.post('/auth/logout', requireStaff, (req, res) => {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(Date.now(), req.staff!.sessionId);
  audit(req, { action: 'auth.logout' });
  res.status(204).end();
});

/** Always 202 – never reveals whether an account exists. */
authRouter.post('/auth/forgot-password', loginLimiter, (req, res) => {
  const { identifier } = parse(z.object({ identifier: z.string().min(3).max(120) }), req.body);
  const user = findUser(identifier);
  if (user && user.status === 'active') {
    const token = randomToken(32);
    db.prepare('INSERT INTO password_resets(token_hash, user_id, expires_at) VALUES(?,?,?)').run(sha256(token), user.id, Date.now() + 30 * MIN);
    void sendMessage({
      to: user.email,
      subject: 'Reset your Sanket password',
      text: `Use this one-time reset token within 30 minutes: ${token}`,
    });
    audit(req, { action: 'auth.password_reset_requested', actor: { id: user.id, label: user.official_id } });
  }
  res.status(202).json({ message: 'If the account exists, reset instructions have been sent.' });
});

authRouter.post('/auth/reset-password', loginLimiter, async (req, res) => {
  const { token, newPassword } = parse(z.object({ token: z.string().min(20).max(200), newPassword: passwordPolicy }), req.body);
  const now = Date.now();
  const hash = await hashPassword(newPassword);
  const userId = tx(() => {
    const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?').get(sha256(token), now) as
      | { user_id: string }
      | undefined;
    if (!row) return null;
    db.prepare('UPDATE password_resets SET consumed_at = ? WHERE token_hash = ?').run(now, sha256(token));
    db.prepare('UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?').run(hash, now, row.user_id);
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now, row.user_id);
    return row.user_id;
  });
  if (!userId) throw Errors.badRequest('This reset link is invalid or has expired', 'INVALID_RESET_TOKEN');
  const u = db.prepare('SELECT official_id FROM users WHERE id = ?').get(userId) as { official_id: string };
  audit(req, { action: 'auth.password_reset', actor: { id: userId, label: u.official_id } });
  res.json({ reset: true });
});
