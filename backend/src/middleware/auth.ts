import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';
import type { UserRow } from '../db/types.js';
import { audit } from '../domain/audit.js';
import { can, type Permission } from '../domain/permissions.js';
import { Errors } from '../lib/errors.js';

const ISSUER = 'sanket-api';
const ALG = 'HS256' as const;

export function signAnonToken(reporterId: string): { token: string; expiresInSeconds: number } {
  const expiresInSeconds = config.ANON_TOKEN_DAYS * 86_400;
  const token = jwt.sign({ typ: 'anon' }, config.JWT_SECRET, {
    algorithm: ALG, issuer: ISSUER, subject: reporterId, expiresIn: expiresInSeconds,
  });
  return { token, expiresInSeconds };
}

export function signStaffToken(userId: string, sessionId: string, expiresAtMs: number): string {
  return jwt.sign({ typ: 'staff', sid: sessionId }, config.JWT_SECRET, {
    algorithm: ALG, issuer: ISSUER, subject: userId,
    expiresIn: Math.max(1, Math.floor((expiresAtMs - Date.now()) / 1000)),
  });
}

function verify(req: Request, typ: 'anon' | 'staff'): jwt.JwtPayload {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer (.+)$/i.exec(header);
  if (!match) throw Errors.unauthorized('Authentication required');
  try {
    const payload = jwt.verify(match[1]!, config.JWT_SECRET, { algorithms: [ALG], issuer: ISSUER }) as jwt.JwtPayload;
    if (payload.typ !== typ || !payload.sub) throw new Error('wrong token type');
    return payload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw Errors.unauthorized('Your session has expired', 'TOKEN_EXPIRED');
    throw Errors.unauthorized('Invalid credentials', 'INVALID_TOKEN');
  }
}

/** Anonymous device session: proves "same device as before", nothing about who the person is. */
export const requireAnon: RequestHandler = (req, _res, next) => {
  const payload = verify(req, 'anon');
  const exists = db.prepare('SELECT 1 FROM reporters WHERE id = ?').get(payload.sub!);
  if (!exists) throw Errors.unauthorized('Session not found. Please start a new session.', 'SESSION_NOT_FOUND');
  req.anon = { reporterId: payload.sub! };
  next();
};

export const requireStaff: RequestHandler = (req, _res, next) => {
  const payload = verify(req, 'staff');
  const session = db
    .prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ?')
    .get(payload.sid, payload.sub!, Date.now());
  if (!session) throw Errors.unauthorized('Your session is no longer valid', 'SESSION_REVOKED');
  const user = db.prepare(`SELECT * FROM users WHERE id = ? AND status = 'active'`).get(payload.sub!) as UserRow | undefined;
  if (!user) throw Errors.unauthorized('Your account is not active', 'ACCOUNT_INACTIVE');
  req.staff = {
    userId: user.id, sessionId: payload.sid as string, role: user.role,
    name: user.name, officialId: user.official_id, email: user.email,
  };
  next();
};

/** All listed permissions are required. Denials are written to the audit log. */
export const requirePermission = (...perms: Permission[]): RequestHandler => (req, _res, next) => {
  const role = req.staff?.role;
  const missing = role ? perms.filter((p) => !can(role, p)) : perms;
  if (missing.length) {
    audit(req, {
      action: 'access.denied',
      resource: `${req.method} ${req.baseUrl}${req.path}`,
      result: 'denied',
      meta: { required: perms },
    });
    throw Errors.forbidden('You do not have permission to perform this action', 'PERMISSION_DENIED');
  }
  next();
};
