import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import type { PatternRow } from '../../db/types.js';
import { audit } from '../../domain/audit.js';
import { reviewReport } from '../../domain/reports.js';
import { REPORT_SELECT, REPORT_STATUS_SQL, staffPattern, staffReport, type StaffReportRow } from '../../domain/staffViews.js';
import { Errors } from '../../lib/errors.js';
import { likeEscape, pageMeta, pageSchema, param, parse } from '../../lib/http.js';
import { CATEGORIES } from '../../lib/i18n.js';
import { requirePermission } from '../../middleware/auth.js';

export const authorityReports = Router();

const Filters = pageSchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['new', 'linked', 'confirmed', 'dismissed']).optional(),
  category: z.enum(CATEGORIES).optional(),
  patternId: z.string().max(32).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['time', 'category', 'status']).default('time'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
type Filters = z.infer<typeof Filters>;

function where(f: Filters) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (f.q) {
    clauses.push(`(r.id LIKE @q ESCAPE '\\' OR r.area_label LIKE @q ESCAPE '\\' OR r.category LIKE @q ESCAPE '\\')`);
    params.q = `%${likeEscape(f.q)}%`;
  }
  if (f.status) { clauses.push(`${REPORT_STATUS_SQL} = @status`); params.status = f.status; }
  if (f.category) { clauses.push('r.category = @category'); params.category = f.category; }
  if (f.patternId) { clauses.push('r.pattern_id = @patternId'); params.patternId = f.patternId; }
  if (f.from) { clauses.push('r.created_at >= @from'); params.from = f.from.getTime(); }
  if (f.to) { clauses.push('r.created_at <= @to'); params.to = f.to.getTime(); }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const SORT: Record<Filters['sort'], string> = { time: 'r.created_at', category: 'r.category', status: REPORT_STATUS_SQL };

/** Report Management table (Report ID, Incident Type, Location, Time, Status, Pattern). */
authorityReports.get('/reports', requirePermission('reports:view'), (req, res) => {
  const f = parse(Filters, req.query);
  const w = where(f);
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM reports r ${w.sql}`).get(w.params) as { n: number }).n;
  const rows = db
    .prepare(`${REPORT_SELECT} ${w.sql} ORDER BY ${SORT[f.sort]} ${f.order === 'asc' ? 'ASC' : 'DESC'}, r.id LIMIT @limit OFFSET @offset`)
    .all({ ...w.params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize }) as StaffReportRow[];
  res.json({ reports: rows.map((r) => staffReport(r)), pagination: pageMeta(total, f.page, f.pageSize) });
});

const csvCell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

authorityReports.get('/reports/export.csv', requirePermission('reports:view', 'data:export'), (req, res) => {
  const f = parse(Filters, { ...req.query, page: 1, pageSize: 100 });
  const w = where(f);
  const rows = db.prepare(`${REPORT_SELECT} ${w.sql} ORDER BY r.created_at DESC LIMIT 5000`).all(w.params) as StaffReportRow[];
  const header = ['report_id', 'category', 'area', 'lat', 'lng', 'occurred_at', 'submitted_at', 'status', 'pattern_id'];
  const lines = rows.map((r) =>
    [r.id, r.category, r.area_label, r.lat, r.lng, new Date(r.occurred_at).toISOString(), new Date(r.created_at).toISOString(), r.display_status, r.pattern_id]
      .map(csvCell).join(','),
  );
  audit(req, { action: 'data.export', resource: 'reports', meta: { rows: rows.length } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sanket-reports.csv"');
  res.send([header.join(','), ...lines].join('\n'));
});

/** Report detail panel. Viewing an individual report is an audited event. */
authorityReports.get('/reports/:id', requirePermission('reports:view'), (req, res) => {
  const row = db.prepare(`${REPORT_SELECT} WHERE r.id = ?`).get(param(req, 'id')) as StaffReportRow | undefined;
  if (!row) throw Errors.notFound('Report');
  audit(req, { action: 'report.view', resource: row.id });
  const pattern = row.pattern_id
    ? (db.prepare('SELECT * FROM patterns WHERE id = ?').get(row.pattern_id) as PatternRow | undefined)
    : undefined;
  res.json({ ...staffReport(row, true), pattern: pattern ? staffPattern(pattern) : null });
});

/** Confirm / dismiss / mark as spam. Outcomes adjust reporter trust and re-score the pattern. */
authorityReports.post('/reports/:id/review', requirePermission('reports:view'), (req, res) => {
  const { decision, note } = parse(
    z.object({ decision: z.enum(['confirm', 'dismiss', 'spam']), note: z.string().trim().max(300).optional() }),
    req.body,
  );
  const id = param(req, 'id');
  const updated = reviewReport(id, decision, note, req.staff!.officialId);
  audit(req, { action: `report.${decision}`, resource: id });
  const row = db.prepare(`${REPORT_SELECT} WHERE r.id = ?`).get(updated.id) as StaffReportRow;
  res.json(staffReport(row, true));
});
