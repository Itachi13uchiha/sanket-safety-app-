import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import type { ReportRow } from '../db/types.js';
import { eraseReports, submitReport } from '../domain/reports.js';
import { citizenReport } from '../domain/views.js';
import { Errors } from '../lib/errors.js';
import { param, parse, pageMeta, pageSchema } from '../lib/http.js';
import { CATEGORIES, TIME_BUCKETS, getLang } from '../lib/i18n.js';
import { requireAnon } from '../middleware/auth.js';
import { reportLimiter } from '../middleware/core.js';

export const reportsRouter = Router();

const CreateReport = z
  .object({
    category: z.enum(CATEGORIES),
    when: z.enum(TIME_BUCKETS),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    areaId: z.string().max(64).optional(),
    locationSource: z.enum(['current', 'map', 'manual']).default('current'),
    note: z.string().max(400).optional(),
  })
  .refine((v) => (v.lat == null) === (v.lng == null), { message: 'lat and lng must be provided together', path: ['lat'] });

/** Submit a report (step 1–4 of the reporting flow). Returns what the success screen needs. */
reportsRouter.post('/reports', requireAnon, reportLimiter, (req, res) => {
  const lang = getLang(req);
  const body = parse(CreateReport, req.body);
  const key = req.header('idempotency-key');
  if (key && !/^[\w-]{8,80}$/.test(key)) throw Errors.badRequest('Invalid Idempotency-Key', 'INVALID_IDEMPOTENCY_KEY');

  const { report, duplicate } = submitReport({
    reporterId: req.anon!.reporterId,
    category: body.category,
    lat: body.lat,
    lng: body.lng,
    areaId: body.areaId,
    locationSource: body.locationSource,
    when: body.when,
    note: body.note,
    idempotencyKey: key ?? undefined,
  });

  res.status(duplicate ? 200 : 201).json({
    ...citizenReport(report, lang, null, false),
    duplicate,
    message: duplicate
      ? 'We already have this report from you. Thank you.'
      : 'Thank you for helping make your community safer.',
  });
});

const patternStatusOf = (r: ReportRow) =>
  r.pattern_id
    ? ((db.prepare('SELECT status FROM patterns WHERE id = ?').get(r.pattern_id) as { status: string } | undefined)?.status ?? null)
    : null;

/** My Reports list (filter: all | open | resolved). */
reportsRouter.get('/reports/mine', requireAnon, (req, res) => {
  const lang = getLang(req);
  const q = parse(pageSchema.extend({ status: z.enum(['all', 'open', 'resolved']).default('all') }), req.query);
  const rows = db
    .prepare('SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at DESC')
    .all(req.anon!.reporterId) as ReportRow[];
  const mapped = rows.map((r) => citizenReport(r, lang, patternStatusOf(r)));
  const filtered = q.status === 'all' ? mapped : mapped.filter((r) => r.status === q.status);
  const start = (q.page - 1) * q.pageSize;
  res.json({
    reports: filtered.slice(start, start + q.pageSize),
    counts: {
      all: mapped.length,
      open: mapped.filter((r) => r.status === 'open').length,
      resolved: mapped.filter((r) => r.status === 'resolved').length,
    },
    pagination: pageMeta(filtered.length, q.page, q.pageSize),
  });
});

reportsRouter.get('/reports/mine/:id', requireAnon, (req, res) => {
  const r = db
    .prepare('SELECT * FROM reports WHERE id = ? AND reporter_id = ?')
    .get(param(req, 'id'), req.anon!.reporterId) as ReportRow | undefined;
  if (!r) throw Errors.notFound('Report');
  res.json(citizenReport(r, getLang(req), patternStatusOf(r), true));
});

reportsRouter.delete('/reports/mine/:id', requireAnon, (req, res) => {
  const removed = eraseReports(req.anon!.reporterId, { reportId: param(req, 'id') });
  if (!removed) throw Errors.notFound('Report');
  res.json({ deleted: true });
});

reportsRouter.delete('/reports/mine', requireAnon, (req, res) => {
  res.json({ deleted: true, reportsRemoved: eraseReports(req.anon!.reporterId, {}) });
});
