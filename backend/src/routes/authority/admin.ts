import { Router } from 'express';
import { z } from 'zod';
import { db, tx } from '../../db/index.js';
import type { UserRow } from '../../db/types.js';
import { audit, verifyAuditChain } from '../../domain/audit.js';
import { runMaintenance } from '../../domain/detection.js';
import { hashPassword, passwordPolicy, staffUser } from '../../domain/passwords.js';
import {
  PERMISSIONS, PERMISSION_LABELS, ROLES, ROLE_LABELS, ROLE_PERMISSIONS, STAFF_ROLES,
} from '../../domain/permissions.js';
import { DEFAULT_SETTINGS, SettingsPatchSchema, getSettings, updateSettings } from '../../domain/settings.js';
import { Errors } from '../../lib/errors.js';
import { iso, likeEscape, pageMeta, pageSchema, param, parse } from '../../lib/http.js';
import { newId } from '../../lib/security.js';
import { requirePermission } from '../../middleware/auth.js';

export const authorityAdmin = Router();

/* ─────────────────────────────── audit logs ─────────────────────────────── */

authorityAdmin.get('/audit-logs', requirePermission('audit:view'), (req, res) => {
  const f = parse(
    pageSchema.extend({
      q: z.string().trim().max(80).optional(),
      action: z.string().max(60).optional(),
      result: z.enum(['success', 'failed', 'denied']).optional(),
      actor: z.string().max(60).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
    req.query,
  );
  const clauses = ['1=1'];
  const params: Record<string, unknown> = {};
  if (f.q) { clauses.push(`(actor LIKE @q ESCAPE '\\' OR action LIKE @q ESCAPE '\\' OR resource LIKE @q ESCAPE '\\')`); params.q = `%${likeEscape(f.q)}%`; }
  if (f.action) { clauses.push('action = @action'); params.action = f.action; }
  if (f.result) { clauses.push('result = @result'); params.result = f.result; }
  if (f.actor) { clauses.push('actor = @actor'); params.actor = f.actor; }
  if (f.from) { clauses.push('ts >= @from'); params.from = f.from.getTime(); }
  if (f.to) { clauses.push('ts <= @to'); params.to = f.to.getTime(); }
  const w = clauses.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE ${w}`).get(params) as { n: number }).n;
  const rows = db.prepare(`SELECT * FROM audit_logs WHERE ${w} ORDER BY seq DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize }) as Array<{
      seq: number; ts: number; actor_id: string | null; actor: string; action: string; resource: string | null;
      ip: string | null; device: string | null; result: string; meta: string | null;
    }>;
  res.json({
    logs: rows.map((r) => ({
      id: r.seq, timestamp: iso(r.ts), actor: { id: r.actor_id, label: r.actor }, action: r.action, resource: r.resource,
      ip: r.ip, device: r.device, result: r.result, meta: r.meta ? JSON.parse(r.meta) : null,
    })),
    actions: (db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action').all() as { action: string }[]).map((a) => a.action),
    pagination: pageMeta(total, f.page, f.pageSize),
  });
});

/** Tamper check: recomputes the hash chain over the whole log. */
authorityAdmin.get('/audit-logs/verify', requirePermission('audit:view'), (req, res) => {
  const result = verifyAuditChain();
  audit(req, { action: 'audit.verify', meta: { valid: result.valid } });
  res.json(result);
});

/* ───────────────────────────── access control ───────────────────────────── */

/** Powers the RBAC matrix (Citizen / Officer / Supervisor / Admin × permissions). */
authorityAdmin.get('/access/roles', requirePermission('users:manage'), (_req, res) => {
  res.json({
    roles: ROLES.map((r) => ({ id: r, label: ROLE_LABELS[r] })),
    permissions: PERMISSIONS.map((p) => ({ id: p, label: PERMISSION_LABELS[p] })),
    matrix: Object.fromEntries(ROLES.map((r) => [r, Object.fromEntries(PERMISSIONS.map((p) => [p, ROLE_PERMISSIONS[r].includes(p)]))])),
  });
});

authorityAdmin.get('/users', requirePermission('users:manage'), (req, res) => {
  const f = parse(
    pageSchema.extend({ q: z.string().trim().max(80).optional(), role: z.enum(STAFF_ROLES).optional(), status: z.enum(['active', 'inactive']).optional() }),
    req.query,
  );
  const clauses = ['1=1'];
  const params: Record<string, unknown> = {};
  if (f.q) { clauses.push(`(name LIKE @q ESCAPE '\\' OR email LIKE @q ESCAPE '\\' OR official_id LIKE @q ESCAPE '\\')`); params.q = `%${likeEscape(f.q)}%`; }
  if (f.role) { clauses.push('role = @role'); params.role = f.role; }
  if (f.status) { clauses.push('status = @status'); params.status = f.status; }
  const w = clauses.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM users WHERE ${w}`).get(params) as { n: number }).n;
  const rows = db.prepare(`SELECT * FROM users WHERE ${w} ORDER BY name LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize }) as UserRow[];
  res.json({ users: rows.map(staffUser), pagination: pageMeta(total, f.page, f.pageSize) });
});

authorityAdmin.post('/users', requirePermission('users:manage'), async (req, res) => {
  const b = parse(
    z.object({
      officialId: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only'),
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().toLowerCase().email().max(120),
      role: z.enum(STAFF_ROLES),
      password: passwordPolicy,
    }),
    req.body,
  );
  const exists = db.prepare('SELECT 1 FROM users WHERE lower(email) = ? OR lower(official_id) = ?').get(b.email, b.officialId.toLowerCase());
  if (exists) throw Errors.conflict('A user with this e-mail or official ID already exists', 'USER_EXISTS');
  const id = newId('US', 8);
  const now = Date.now();
  db.prepare(
    `INSERT INTO users(id, official_id, email, name, password_hash, role, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)`,
  ).run(id, b.officialId, b.email, b.name, await hashPassword(b.password), b.role, now, now);
  audit(req, { action: 'user.create', resource: id, meta: { role: b.role } });
  res.status(201).json(staffUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow));
});

authorityAdmin.patch('/users/:id', requirePermission('users:manage'), (req, res) => {
  const b = parse(
    z.object({ role: z.enum(STAFF_ROLES).optional(), status: z.enum(['active', 'inactive']).optional() })
      .refine((v) => v.role || v.status, { message: 'Nothing to update' }),
    req.body,
  );
  const id = param(req, 'id');
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  if (!target) throw Errors.notFound('User');
  if (target.id === req.staff!.userId) throw Errors.forbidden('You cannot change your own role or status', 'SELF_MODIFICATION');

  const nextRole = b.role ?? target.role;
  const nextStatus = b.status ?? target.status;
  const losingAdmin = target.role === 'admin' && target.status === 'active' && (nextRole !== 'admin' || nextStatus !== 'active');
  if (losingAdmin) {
    const admins = (db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'`).get() as { n: number }).n;
    if (admins <= 1) throw Errors.conflict('At least one active administrator is required', 'LAST_ADMIN');
  }

  const now = Date.now();
  tx(() => {
    db.prepare('UPDATE users SET role = ?, status = ?, updated_at = ? WHERE id = ?').run(nextRole, nextStatus, now, id);
    // Existing sessions carry the old permissions; force a fresh sign-in.
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now, id);
  });
  audit(req, {
    action: 'user.permission_change',
    resource: target.official_id,
    meta: { before: { role: target.role, status: target.status }, after: { role: nextRole, status: nextStatus } },
  });
  res.json(staffUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow));
});

/* ─────────────────────────────── notifications ─────────────────────────────── */

authorityAdmin.get('/notifications', (req, res) => {
  const f = parse(pageSchema.extend({ unread: z.enum(['true', 'false']).default('false') }), req.query);
  const me = req.staff!.userId;
  const base = `FROM notifications n LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = @me
    WHERE n.audience = 'authority' AND (n.user_id IS NULL OR n.user_id = @me) ${f.unread === 'true' ? 'AND nr.read_at IS NULL' : ''}`;
  const total = (db.prepare(`SELECT COUNT(*) AS n ${base}`).get({ me }) as { n: number }).n;
  const unread = (db.prepare(
    `SELECT COUNT(*) AS n FROM notifications n LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = @me
     WHERE n.audience = 'authority' AND (n.user_id IS NULL OR n.user_id = @me) AND nr.read_at IS NULL`,
  ).get({ me }) as { n: number }).n;
  const rows = db.prepare(`SELECT n.*, nr.read_at ${base} ORDER BY n.created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ me, limit: f.pageSize, offset: (f.page - 1) * f.pageSize }) as Array<{
      id: string; type: string; title: string; body: string; level: string | null; pattern_id: string | null; created_at: number; read_at: number | null;
    }>;
  res.json({
    notifications: rows.map((n) => ({
      id: n.id, type: n.type, title: n.title, body: n.body, level: n.level, patternId: n.pattern_id,
      createdAt: iso(n.created_at), read: n.read_at != null,
    })),
    unreadCount: unread,
    pagination: pageMeta(total, f.page, f.pageSize),
  });
});

authorityAdmin.post('/notifications/read-all', (req, res) => {
  const me = req.staff!.userId;
  const r = db.prepare(
    `INSERT OR IGNORE INTO notification_reads(notification_id, user_id, read_at)
     SELECT id, ?, ? FROM notifications WHERE audience = 'authority' AND (user_id IS NULL OR user_id = ?)`,
  ).run(me, Date.now(), me);
  res.json({ marked: r.changes });
});

authorityAdmin.post('/notifications/:id/read', (req, res) => {
  const me = req.staff!.userId;
  const id = param(req, 'id');
  const exists = db.prepare(`SELECT 1 FROM notifications WHERE id = ? AND audience = 'authority' AND (user_id IS NULL OR user_id = ?)`).get(id, me);
  if (!exists) throw Errors.notFound('Notification');
  db.prepare('INSERT OR IGNORE INTO notification_reads(notification_id, user_id, read_at) VALUES(?,?,?)').run(id, me, Date.now());
  res.status(204).end();
});

/* ───────────────────────────────── settings ───────────────────────────────── */

authorityAdmin.get('/settings', requirePermission('settings:modify'), (_req, res) => {
  res.json({ settings: getSettings(), defaults: DEFAULT_SETTINGS });
});

authorityAdmin.put('/settings', requirePermission('settings:modify'), (req, res) => {
  const patch = parse(SettingsPatchSchema, req.body);
  let result;
  try {
    result = updateSettings(patch);
  } catch (err) {
    throw Errors.badRequest((err as Error).message, 'INVALID_SETTINGS');
  }
  audit(req, { action: 'settings.update', meta: { patch } });
  res.json({ settings: result.after });
});

/** Run housekeeping on demand (it also runs hourly): re-score patterns, close quiet ones, apply retention. */
authorityAdmin.post('/jobs/maintenance', requirePermission('settings:modify'), (req, res) => {
  const result = runMaintenance();
  audit(req, { action: 'jobs.maintenance', meta: result });
  res.json(result);
});
