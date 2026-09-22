import type { Request } from 'express';
import { db, tx } from '../db/index.js';
import { sha256 } from '../lib/security.js';

export type AuditResult = 'success' | 'failed' | 'denied';

export interface AuditEntry {
  action: string;
  resource?: string | null;
  result?: AuditResult;
  meta?: Record<string, unknown>;
  /** Override the actor (e.g. a failed login has no session yet). */
  actor?: { id: string | null; label: string };
}

function deviceOf(ua: string | undefined): string {
  if (!ua) return 'unknown';
  const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS'
    : /Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Other OS';
  const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox\//i.test(ua) ? 'Firefox' : /Chrome\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) ? 'Safari' : /curl|node|undici|python/i.test(ua) ? 'API client' : 'Other browser';
  return `${browser} / ${os}`;
}

interface RawAudit {
  ts?: number;
  actorId: string | null;
  actor: string;
  action: string;
  resource: string | null;
  ip: string | null;
  device: string | null;
  result: AuditResult;
  meta: Record<string, unknown> | null;
}

const chainInput = (prev: string, r: {
  ts: number; actor_id: string | null; actor: string; action: string; resource: string | null;
  ip: string | null; device: string | null; result: string; meta: string | null;
}) =>
  sha256(JSON.stringify([prev, r.ts, r.actor_id, r.actor, r.action, r.resource, r.ip, r.device, r.result, r.meta]));

/**
 * Append-only, hash-chained log: every row commits to the previous row's hash, so editing or
 * deleting history is detectable via verifyAuditChain().
 */
export function writeAudit(a: RawAudit): void {
  tx(() => {
    const last = db.prepare('SELECT hash FROM audit_logs ORDER BY seq DESC LIMIT 1').get() as { hash: string } | undefined;
    const prev = last?.hash ?? 'GENESIS';
    const row = {
      ts: a.ts ?? Date.now(),
      actor_id: a.actorId,
      actor: a.actor,
      action: a.action,
      resource: a.resource,
      ip: a.ip,
      device: a.device,
      result: a.result,
      meta: a.meta ? JSON.stringify(a.meta) : null,
    };
    db.prepare(
      `INSERT INTO audit_logs(ts, actor_id, actor, action, resource, ip, device, result, meta, prev_hash, hash)
       VALUES(@ts, @actor_id, @actor, @action, @resource, @ip, @device, @result, @meta, @prev, @hash)`,
    ).run({ ...row, prev, hash: chainInput(prev, row) });
  });
}

export function audit(req: Request, e: AuditEntry): void {
  const actor = e.actor ?? (req.staff
    ? { id: req.staff.userId, label: req.staff.officialId }
    : { id: null, label: 'unauthenticated' });
  writeAudit({
    actorId: actor.id,
    actor: actor.label,
    action: e.action,
    resource: e.resource ?? null,
    ip: (req.ip ?? '').replace(/^::ffff:/, '') || null,
    device: deviceOf(req.header('user-agent')),
    result: e.result ?? 'success',
    meta: e.meta ?? null,
  });
}

export function verifyAuditChain(): { valid: boolean; checked: number; brokenAtSeq: number | null } {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY seq ASC').all() as Array<{
    seq: number; ts: number; actor_id: string | null; actor: string; action: string; resource: string | null;
    ip: string | null; device: string | null; result: string; meta: string | null; prev_hash: string; hash: string;
  }>;
  let prev = 'GENESIS';
  for (const r of rows) {
    if (r.prev_hash !== prev || chainInput(prev, r) !== r.hash) {
      return { valid: false, checked: rows.length, brokenAtSeq: r.seq };
    }
    prev = r.hash;
  }
  return { valid: true, checked: rows.length, brokenAtSeq: null };
}
