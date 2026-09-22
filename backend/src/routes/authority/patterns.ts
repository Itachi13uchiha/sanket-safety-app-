import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import type { AlertRow, PatternRow } from '../../db/types.js';
import { audit } from '../../domain/audit.js';
import { changePatternStatus, type StatusTarget } from '../../domain/patternActions.js';
import { getSettings } from '../../domain/settings.js';
import {
  REPORT_SELECT, allowedNextStatuses, patternEvents, reportingTimeline, staffAlert, staffPattern, staffReport,
  type StaffReportRow,
} from '../../domain/staffViews.js';
import { Errors } from '../../lib/errors.js';
import { likeEscape, pageMeta, pageSchema, param, parse } from '../../lib/http.js';
import { CATEGORIES } from '../../lib/i18n.js';
import { can } from '../../domain/permissions.js';
import { requirePermission } from '../../middleware/auth.js';

export const authorityPatterns = Router();

const getPattern = (id: string) => {
  const p = db.prepare('SELECT * FROM patterns WHERE id = ? AND merged_into IS NULL').get(id) as PatternRow | undefined;
  if (!p) throw Errors.notFound('Pattern');
  return p;
};

function patternDetail(p: PatternRow, canSeeReports: boolean) {
  const analysis = JSON.parse(p.analysis_json || '{}') as Record<string, unknown>;
  const d = getSettings().detection;
  const alert = db.prepare('SELECT * FROM alerts WHERE pattern_id = ?').get(p.id) as AlertRow | undefined;
  return {
    pattern: staffPattern(p),
    signals: {
      distinctReporters: p.distinct_reporters,
      effectiveReporters: p.effective_reporters,
      distinctPeriods: p.distinct_periods,
      distinctDays: p.distinct_days,
      spreadMeters: p.spread_m,
      confidence: p.confidence,
      ...analysis,
      thresholds: {
        emergingMinReporters: d.emergingMinReporters,
        emergingMinPeriods: d.emergingMinPeriods,
        emergingMinConfidence: d.emergingMinConfidence,
      },
    },
    reportingTimeline: reportingTimeline(p.id),
    history: patternEvents(p.id),
    alert: alert ? staffAlert(alert) : null,
    cases: db.prepare('SELECT id, status, title FROM cases WHERE pattern_id = ? ORDER BY seq DESC').all(p.id),
    allowedActions: allowedNextStatuses(p.status),
    reports: canSeeReports
      ? (db.prepare(`${REPORT_SELECT} WHERE r.pattern_id = ? ORDER BY r.created_at DESC LIMIT 200`).all(p.id) as StaffReportRow[]).map((r) => staffReport(r))
      : undefined,
  };
}

authorityPatterns.get('/patterns', requirePermission('patterns:view'), (req, res) => {
  const f = parse(
    pageSchema.extend({
      status: z.enum(['monitoring', 'emerging', 'escalated', 'resolved']).optional(),
      category: z.enum(CATEGORIES).optional(),
      q: z.string().trim().max(80).optional(),
      sort: z.enum(['confidence', 'recent', 'reports']).default('confidence'),
    }),
    req.query,
  );
  const clauses = ['merged_into IS NULL'];
  const params: Record<string, unknown> = {};
  if (f.status) { clauses.push('status = @status'); params.status = f.status; }
  else clauses.push(`status <> 'resolved'`);
  if (f.category) { clauses.push('category = @category'); params.category = f.category; }
  if (f.q) { clauses.push(`(area_label LIKE @q ESCAPE '\\' OR id LIKE @q ESCAPE '\\')`); params.q = `%${likeEscape(f.q)}%`; }
  const w = clauses.join(' AND ');
  const order = { confidence: 'confidence DESC, last_report_at DESC', recent: 'last_report_at DESC', reports: 'distinct_reporters DESC' }[f.sort];
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM patterns WHERE ${w}`).get(params) as { n: number }).n;
  const rows = db.prepare(`SELECT * FROM patterns WHERE ${w} ORDER BY ${order} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize }) as PatternRow[];
  res.json({ patterns: rows.map(staffPattern), pagination: pageMeta(total, f.page, f.pageSize) });
});

authorityPatterns.get('/patterns/:id', requirePermission('patterns:view'), (req, res) => {
  res.json(patternDetail(getPattern(param(req, 'id')), can(req.staff!.role, 'reports:view')));
});

const StatusBody = z.object({
  status: z.enum(['monitoring', 'escalated', 'resolved']),
  note: z.string().trim().max(300).optional(),
});
const AUDIT_ACTION: Record<StatusTarget, string> = {
  monitoring: 'alert.start_monitoring',
  escalated: 'alert.escalate',
  resolved: 'alert.resolve',
};

function applyStatus(req: Parameters<typeof audit>[0], patternId: string, to: StatusTarget, note?: string) {
  const before = getPattern(patternId);
  const after = changePatternStatus(patternId, to, { id: req.staff!.userId, label: req.staff!.officialId }, note);
  const alert = db.prepare('SELECT id FROM alerts WHERE pattern_id = ?').get(patternId) as { id: string } | undefined;
  audit(req, { action: AUDIT_ACTION[to], resource: alert?.id ?? patternId, meta: { patternId, from: before.status, to, note: note ?? null } });
  return after;
}

authorityPatterns.post('/patterns/:id/status', requirePermission('alerts:escalate'), (req, res) => {
  const { status, note } = parse(StatusBody, req.body);
  const p = applyStatus(req, param(req, 'id'), status, note);
  res.json(patternDetail(p, can(req.staff!.role, 'reports:view')));
});

/* ─────────────────────────────── alerts ─────────────────────────────── */

authorityPatterns.get('/alerts', requirePermission('patterns:view'), (req, res) => {
  const f = parse(
    pageSchema.extend({
      status: z.enum(['open', 'acknowledged', 'escalated', 'resolved']).optional(),
      level: z.enum(['low', 'medium', 'high']).optional(),
    }),
    req.query,
  );
  const clauses = ['1=1'];
  const params: Record<string, unknown> = {};
  if (f.status) { clauses.push('a.status = @status'); params.status = f.status; }
  if (f.level) { clauses.push('a.level = @level'); params.level = f.level; }
  const w = clauses.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM alerts a WHERE ${w}`).get(params) as { n: number }).n;
  const rows = db
    .prepare(
      `SELECT a.*, p.category, p.area_label, p.confidence, p.distinct_reporters, p.distinct_periods, p.distinct_days, p.status AS pattern_status
       FROM alerts a JOIN patterns p ON p.id = a.pattern_id WHERE ${w}
       ORDER BY CASE a.level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, a.created_at DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize }) as Array<
      AlertRow & { category: string; area_label: string; confidence: number; distinct_reporters: number; distinct_periods: number; distinct_days: number; pattern_status: string }
    >;
  res.json({
    alerts: rows.map((r) => ({
      ...staffAlert(r),
      area: r.area_label,
      category: r.category,
      confidence: r.confidence,
      distinctReporters: r.distinct_reporters,
      distinctPeriods: Math.max(r.distinct_periods, r.distinct_days),
      patternStatus: r.pattern_status,
    })),
    pagination: pageMeta(total, f.page, f.pageSize),
  });
});

authorityPatterns.get('/alerts/:id', requirePermission('patterns:view'), (req, res) => {
  const a = db.prepare('SELECT * FROM alerts WHERE id = ?').get(param(req, 'id')) as AlertRow | undefined;
  if (!a) throw Errors.notFound('Alert');
  const p = db.prepare('SELECT * FROM patterns WHERE id = ?').get(a.pattern_id) as PatternRow;
  res.json(patternDetail(p, can(req.staff!.role, 'reports:view')));
});

/** Start Monitoring / Escalate / Resolve straight from the alert screen. */
authorityPatterns.post('/alerts/:id/action', requirePermission('alerts:escalate'), (req, res) => {
  const { action, note } = parse(
    z.object({ action: z.enum(['start_monitoring', 'escalate', 'resolve']), note: z.string().trim().max(300).optional() }),
    req.body,
  );
  const a = db.prepare('SELECT * FROM alerts WHERE id = ?').get(param(req, 'id')) as AlertRow | undefined;
  if (!a) throw Errors.notFound('Alert');
  const to: StatusTarget = action === 'start_monitoring' ? 'monitoring' : action === 'escalate' ? 'escalated' : 'resolved';
  const p = applyStatus(req, a.pattern_id, to, note);
  res.json(patternDetail(p, can(req.staff!.role, 'reports:view')));
});
