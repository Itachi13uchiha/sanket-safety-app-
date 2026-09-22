import { Router, type Request } from 'express';
import { z } from 'zod';
import { db, tx } from '../../db/index.js';
import type { CaseRow, PatternRow } from '../../db/types.js';
import { audit } from '../../domain/audit.js';
import { pushNotification } from '../../domain/alerts.js';
import { can } from '../../domain/permissions.js';
import { REPORT_SELECT, staffPattern, staffReport, type StaffReportRow } from '../../domain/staffViews.js';
import { Errors } from '../../lib/errors.js';
import { iso, likeEscape, pageMeta, pageSchema, param, parse } from '../../lib/http.js';
import { categoryLabel } from '../../lib/i18n.js';
import { requirePermission } from '../../middleware/auth.js';

export const authorityCases = Router();

type CaseJoined = CaseRow & { officer_name: string | null; officer_official_id: string | null };
const CASE_SELECT = `SELECT c.*, u.name AS officer_name, u.official_id AS officer_official_id
  FROM cases c LEFT JOIN users u ON u.id = c.assigned_officer_id`;

const caseView = (c: CaseJoined) => ({
  id: c.id,
  patternId: c.pattern_id,
  title: c.title,
  category: { id: c.category, label: categoryLabel(c.category, 'en') },
  location: { label: c.area_label, lat: c.lat, lng: c.lng },
  status: c.status,
  priority: c.priority,
  assignedOfficer: c.assigned_officer_id ? { id: c.assigned_officer_id, name: c.officer_name, officialId: c.officer_official_id } : null,
  createdBy: c.created_by,
  createdAt: iso(c.created_at),
  updatedAt: iso(c.updated_at),
  closedAt: iso(c.closed_at),
});

const actorOf = (req: Request) => req.staff!.officialId;
const canManage = (req: Request) => can(req.staff!.role, 'cases:manage');

/** Officers only see cases assigned to them; supervisors/admins see all. */
function loadCase(req: Request, id: string): CaseJoined {
  const c = db.prepare(`${CASE_SELECT} WHERE c.id = ?`).get(id) as CaseJoined | undefined;
  if (!c || (!canManage(req) && c.assigned_officer_id !== req.staff!.userId)) throw Errors.notFound('Case');
  return c;
}

function addEvent(caseId: string, type: string, actor: string, from?: string | null, to?: string | null, note?: string | null) {
  db.prepare('INSERT INTO case_events(case_id, ts, type, actor, from_val, to_val, note) VALUES(?,?,?,?,?,?,?)').run(
    caseId, Date.now(), type, actor, from ?? null, to ?? null, note ?? null,
  );
}

const activeAssignee = (id: string) => {
  const u = db.prepare(`SELECT id, name FROM users WHERE id = ? AND status = 'active'`).get(id) as { id: string; name: string } | undefined;
  if (!u) throw Errors.badRequest('Assignee must be an active officer', 'INVALID_ASSIGNEE');
  return u;
};

authorityCases.get('/cases/assignees', requirePermission('cases:manage'), (_req, res) => {
  const rows = db.prepare(`SELECT id, name, official_id, role FROM users WHERE status = 'active' ORDER BY name`).all() as {
    id: string; name: string; official_id: string; role: string;
  }[];
  res.json({ assignees: rows.map((u) => ({ id: u.id, name: u.name, officialId: u.official_id, role: u.role })) });
});

authorityCases.get('/cases', (req, res) => {
  const f = parse(
    pageSchema.extend({
      status: z.enum(['open', 'in_progress', 'on_hold', 'closed']).optional(),
      assigned: z.enum(['me', 'any']).default('any'),
      q: z.string().trim().max(80).optional(),
    }),
    req.query,
  );
  const clauses = ['1=1'];
  const params: Record<string, unknown> = {};
  if (!canManage(req) || f.assigned === 'me') { clauses.push('c.assigned_officer_id = @me'); params.me = req.staff!.userId; }
  if (f.status) { clauses.push('c.status = @status'); params.status = f.status; }
  if (f.q) { clauses.push(`(c.id LIKE @q ESCAPE '\\' OR c.title LIKE @q ESCAPE '\\' OR c.area_label LIKE @q ESCAPE '\\')`); params.q = `%${likeEscape(f.q)}%`; }
  const w = clauses.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM cases c WHERE ${w}`).get(params) as { n: number }).n;
  const rows = db.prepare(`${CASE_SELECT} WHERE ${w} ORDER BY c.seq DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize }) as CaseJoined[];
  res.json({ cases: rows.map(caseView), pagination: pageMeta(total, f.page, f.pageSize) });
});

authorityCases.post('/cases', requirePermission('cases:manage'), (req, res) => {
  const b = parse(
    z.object({
      patternId: z.string().min(3).max(32),
      title: z.string().trim().min(3).max(140).optional(),
      assignedOfficerId: z.string().max(64).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
    }),
    req.body,
  );
  const pattern = db.prepare('SELECT * FROM patterns WHERE id = ? AND merged_into IS NULL').get(b.patternId) as PatternRow | undefined;
  if (!pattern) throw Errors.notFound('Pattern');
  if (db.prepare(`SELECT 1 FROM cases WHERE pattern_id = ? AND status <> 'closed'`).get(pattern.id)) {
    throw Errors.conflict('An open case already exists for this pattern', 'CASE_EXISTS');
  }
  const assignee = b.assignedOfficerId ? activeAssignee(b.assignedOfficerId) : null;
  const now = Date.now();

  const id = tx(() => {
    const seq = (db.prepare('SELECT COALESCE(MAX(seq), 1000) + 1 AS n FROM cases').get() as { n: number }).n;
    const caseId = `CS-${seq}`;
    db.prepare(
      `INSERT INTO cases(id, seq, pattern_id, title, category, area_label, lat, lng, status, priority, assigned_officer_id, created_by, created_at, updated_at)
       VALUES(@id, @seq, @pid, @title, @cat, @area, @lat, @lng, 'open', @priority, @officer, @by, @now, @now)`,
    ).run({
      id: caseId, seq, pid: pattern.id,
      title: b.title ?? `${categoryLabel(pattern.category, 'en')} pattern – ${pattern.area_label}`,
      cat: pattern.category, area: pattern.area_label, lat: pattern.lat, lng: pattern.lng,
      priority: b.priority ?? (pattern.confidence >= 85 ? 'high' : 'medium'),
      officer: assignee?.id ?? null, by: actorOf(req), now,
    });
    db.prepare(
      `INSERT OR IGNORE INTO case_reports(case_id, report_id, added_at)
       SELECT ?, id, ? FROM reports WHERE pattern_id = ? AND status IN ('active','confirmed')`,
    ).run(caseId, now, pattern.id);
    addEvent(caseId, 'created', actorOf(req), null, 'open');
    if (assignee) {
      addEvent(caseId, 'assigned', actorOf(req), null, assignee.name);
      pushNotification({ audience: 'authority', type: 'case_updated', title: 'Case assigned to you', body: `${caseId} – ${pattern.area_label}`, userId: assignee.id, patternId: pattern.id, now });
    }
    return caseId;
  });
  audit(req, { action: 'case.create', resource: id, meta: { patternId: pattern.id } });
  res.status(201).json(caseView(db.prepare(`${CASE_SELECT} WHERE c.id = ?`).get(id) as CaseJoined));
});

authorityCases.get('/cases/:id', (req, res) => {
  const c = loadCase(req, param(req, 'id'));
  const pattern = c.pattern_id ? (db.prepare('SELECT * FROM patterns WHERE id = ?').get(c.pattern_id) as PatternRow | undefined) : undefined;
  const reports = (db.prepare(`${REPORT_SELECT} JOIN case_reports cr ON cr.report_id = r.id WHERE cr.case_id = ? ORDER BY r.created_at DESC`).all(c.id) as StaffReportRow[])
    .map((r) => staffReport(r, true));
  if (reports.length) audit(req, { action: 'case.view', resource: c.id });
  res.json({
    case: caseView(c),
    pattern: pattern ? staffPattern(pattern) : null,
    reports,
    timeline: (db.prepare('SELECT * FROM case_events WHERE case_id = ? ORDER BY ts ASC, id ASC').all(c.id) as Array<{
      ts: number; type: string; actor: string; from_val: string | null; to_val: string | null; note: string | null;
    }>).map((e) => ({ at: iso(e.ts), type: e.type, actor: e.actor, from: e.from_val, to: e.to_val, note: e.note })),
    notes: (db.prepare('SELECT * FROM case_notes WHERE case_id = ? ORDER BY created_at DESC, id DESC').all(c.id) as Array<{
      id: number; author: string; body: string; created_at: number;
    }>).map((n) => ({ id: n.id, author: n.author, body: n.body, createdAt: iso(n.created_at) })),
    attachments: (db.prepare('SELECT * FROM case_attachments WHERE case_id = ? ORDER BY created_at DESC').all(c.id) as Array<{
      id: number; filename: string; mime_type: string; size_bytes: number; sha256: string; uploaded_by: string; created_at: number;
    }>).map((a) => ({ id: a.id, filename: a.filename, mimeType: a.mime_type, sizeBytes: a.size_bytes, sha256: a.sha256, uploadedBy: a.uploaded_by, createdAt: iso(a.created_at) })),
  });
});

authorityCases.patch('/cases/:id', requirePermission('cases:manage'), (req, res) => {
  const b = parse(
    z.object({
      status: z.enum(['open', 'in_progress', 'on_hold', 'closed']).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      title: z.string().trim().min(3).max(140).optional(),
      assignedOfficerId: z.string().max(64).nullable().optional(),
      note: z.string().trim().max(300).optional(),
    }).refine((v) => Object.keys(v).some((k) => k !== 'note'), { message: 'Nothing to update' }),
    req.body,
  );
  const c = loadCase(req, param(req, 'id'));
  const now = Date.now();
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  tx(() => {
    if (b.status && b.status !== c.status) {
      db.prepare('UPDATE cases SET status = ?, closed_at = ?, updated_at = ? WHERE id = ?').run(b.status, b.status === 'closed' ? now : null, now, c.id);
      addEvent(c.id, 'status', actorOf(req), c.status, b.status, b.note);
      changes.status = { from: c.status, to: b.status };
    }
    if (b.priority && b.priority !== c.priority) {
      db.prepare('UPDATE cases SET priority = ?, updated_at = ? WHERE id = ?').run(b.priority, now, c.id);
      changes.priority = { from: c.priority, to: b.priority };
    }
    if (b.title && b.title !== c.title) {
      db.prepare('UPDATE cases SET title = ?, updated_at = ? WHERE id = ?').run(b.title, now, c.id);
      changes.title = { from: c.title, to: b.title };
    }
    if (b.assignedOfficerId !== undefined && b.assignedOfficerId !== c.assigned_officer_id) {
      const next = b.assignedOfficerId ? activeAssignee(b.assignedOfficerId) : null;
      db.prepare('UPDATE cases SET assigned_officer_id = ?, updated_at = ? WHERE id = ?').run(next?.id ?? null, now, c.id);
      addEvent(c.id, 'assigned', actorOf(req), c.officer_name, next?.name ?? null);
      changes.assignedOfficerId = { from: c.assigned_officer_id, to: next?.id ?? null };
      if (next) pushNotification({ audience: 'authority', type: 'case_updated', title: 'Case assigned to you', body: `${c.id} – ${c.area_label}`, userId: next.id, now });
    }
  });
  if (!Object.keys(changes).length) throw Errors.conflict('No changes were made', 'NO_CHANGE');
  audit(req, { action: 'case.update', resource: c.id, meta: changes });
  res.json(caseView(db.prepare(`${CASE_SELECT} WHERE c.id = ?`).get(c.id) as CaseJoined));
});

authorityCases.post('/cases/:id/notes', (req, res) => {
  const { body } = parse(z.object({ body: z.string().trim().min(1).max(2000) }), req.body);
  const c = loadCase(req, param(req, 'id'));
  const now = Date.now();
  db.prepare('INSERT INTO case_notes(case_id, author_id, author, body, created_at) VALUES(?,?,?,?,?)').run(c.id, req.staff!.userId, req.staff!.name, body, now);
  db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(now, c.id);
  addEvent(c.id, 'note', actorOf(req));
  audit(req, { action: 'case.note_add', resource: c.id });
  res.status(201).json({ added: true });
});

authorityCases.post('/cases/:id/reports', requirePermission('cases:manage', 'reports:view'), (req, res) => {
  const { reportIds } = parse(z.object({ reportIds: z.array(z.string().max(20)).min(1).max(100) }), req.body);
  const c = loadCase(req, param(req, 'id'));
  let linked = 0;
  tx(() => {
    for (const rid of reportIds) {
      if (!db.prepare('SELECT 1 FROM reports WHERE id = ?').get(rid)) continue;
      linked += db.prepare('INSERT OR IGNORE INTO case_reports(case_id, report_id, added_at) VALUES(?,?,?)').run(c.id, rid, Date.now()).changes;
    }
    if (linked) addEvent(c.id, 'report_linked', actorOf(req), null, String(linked));
  });
  audit(req, { action: 'case.link_reports', resource: c.id, meta: { linked } });
  res.json({ linked });
});

/** File bytes live in object storage; the API records metadata and an integrity hash. */
authorityCases.post('/cases/:id/attachments', (req, res) => {
  const b = parse(
    z.object({
      filename: z.string().trim().min(1).max(200).regex(/^[^/\\]+$/, 'Invalid filename'),
      mimeType: z.string().max(100),
      sizeBytes: z.number().int().min(0).max(25 * 1024 * 1024),
      sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'Expected a hex SHA-256'),
      storageKey: z.string().max(300).optional(),
    }),
    req.body,
  );
  const c = loadCase(req, param(req, 'id'));
  db.prepare(
    `INSERT INTO case_attachments(case_id, filename, mime_type, size_bytes, sha256, storage_key, uploaded_by, created_at)
     VALUES(?,?,?,?,?,?,?,?)`,
  ).run(c.id, b.filename, b.mimeType, b.sizeBytes, b.sha256.toLowerCase(), b.storageKey ?? null, actorOf(req), Date.now());
  addEvent(c.id, 'attachment', actorOf(req), null, b.filename);
  audit(req, { action: 'case.attachment_add', resource: c.id, meta: { filename: b.filename } });
  res.status(201).json({ added: true });
});
