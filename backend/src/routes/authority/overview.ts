import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import type { AlertRow, PatternRow } from '../../db/types.js';
import { can } from '../../domain/permissions.js';
import {
  REPORT_SELECT, sinceDays, staffAlert, staffPattern, staffReport, type StaffReportRow,
} from '../../domain/staffViews.js';
import { rangeStart, type Range } from '../../domain/views.js';
import { iso, parse, round } from '../../lib/http.js';
import { CATEGORIES, categoryLabel } from '../../lib/i18n.js';
import { DAY, blockOf, lastDateKeys, localParts, startOfLocalDay, windowLabel } from '../../lib/time.js';
import { requirePermission } from '../../middleware/auth.js';

export const authorityOverview = Router();
const OFF = config.TIMEZONE_OFFSET_MINUTES;

const count = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;

/** Dashboard: KPI cards, emerging patterns, recent reports, 7-day trend, priority alerts, live map. */
authorityOverview.get('/dashboard', requirePermission('patterns:view'), (req, res) => {
  const now = Date.now();
  const today = startOfLocalDay(now, OFF);
  const canSeeReports = can(req.staff!.role, 'reports:view');

  const reportsToday = count('SELECT COUNT(*) AS n FROM reports WHERE created_at >= ?', today);
  const reportsYesterday = count('SELECT COUNT(*) AS n FROM reports WHERE created_at >= ? AND created_at < ?', today - DAY, today);
  const emerging = count(`SELECT COUNT(*) AS n FROM patterns WHERE status IN ('emerging','escalated') AND merged_into IS NULL`);
  const emergingYesterday = count(
    `SELECT COUNT(*) AS n FROM patterns WHERE emerged_at IS NOT NULL AND emerged_at < ? AND merged_into IS NULL
       AND (resolved_at IS NULL OR resolved_at >= ?)`, today, today,
  );

  const keys = lastDateKeys(now, 7, OFF);
  const reportsPerDay = new Map(keys.map((k) => [k, 0]));
  for (const r of db.prepare('SELECT created_at AS t FROM reports WHERE created_at >= ?').all(today - 7 * DAY) as { t: number }[]) {
    const k = localParts(r.t, OFF).dateKey;
    if (reportsPerDay.has(k)) reportsPerDay.set(k, reportsPerDay.get(k)! + 1);
  }
  const detectedPerDay = new Map(keys.map((k) => [k, 0]));
  for (const e of db.prepare(`SELECT ts FROM pattern_events WHERE type = 'emerged' AND ts >= ?`).all(today - 7 * DAY) as { ts: number }[]) {
    const k = localParts(e.ts, OFF).dateKey;
    if (detectedPerDay.has(k)) detectedPerDay.set(k, detectedPerDay.get(k)! + 1);
  }

  const patterns = db
    .prepare(`SELECT * FROM patterns WHERE status IN ('emerging','escalated','monitoring') AND merged_into IS NULL ORDER BY confidence DESC, last_report_at DESC`)
    .all() as PatternRow[];
  const alerts = db
    .prepare(
      `SELECT a.*, p.area_label, p.category, p.confidence FROM alerts a JOIN patterns p ON p.id = a.pattern_id
       WHERE a.status IN ('open','escalated') ORDER BY CASE a.level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, a.created_at DESC LIMIT 5`,
    )
    .all() as Array<AlertRow & { area_label: string; category: string; confidence: number }>;

  res.json({
    generatedAt: iso(now),
    metrics: {
      activeEmergingPatterns: { value: emerging, previous: emergingYesterday },
      reportsToday: { value: reportsToday, previous: reportsYesterday },
      areasMonitored: { value: count('SELECT COUNT(*) AS n FROM areas WHERE active = 1') },
      alertsGenerated: {
        value: count('SELECT COUNT(*) AS n FROM alerts WHERE created_at >= ?', today),
        open: count(`SELECT COUNT(*) AS n FROM alerts WHERE status = 'open'`),
      },
    },
    emergingPatterns: patterns.filter((p) => p.status !== 'monitoring').slice(0, 5).map(staffPattern),
    priorityAlerts: alerts.map((a) => ({ ...staffAlert(a), area: a.area_label, category: categoryLabel(a.category, 'en'), confidence: a.confidence })),
    recentReports: canSeeReports
      ? (db.prepare(`${REPORT_SELECT} ORDER BY r.created_at DESC LIMIT 8`).all() as StaffReportRow[]).map((r) => staffReport(r))
      : undefined,
    trend: keys.map((date) => ({ date, reports: reportsPerDay.get(date)!, patternsDetected: detectedPerDay.get(date)! })),
    liveMap: patterns.map((p) => ({
      id: p.id, lat: p.lat, lng: p.lng, status: p.status, confidence: p.confidence,
      intensity: round(p.confidence / 100, 2), category: p.category, area: p.area_label,
    })),
  });
});

/** Live pattern map with the filters from the UI (time range, category, area, status). */
authorityOverview.get('/map', requirePermission('patterns:view'), (req, res) => {
  const f = parse(
    z.object({
      range: z.enum(['today', 'week', 'month']).default('week'),
      category: z.enum(CATEGORIES).optional(),
      areaId: z.string().max(64).optional(),
      status: z.enum(['monitoring', 'emerging', 'escalated', 'resolved']).optional(),
      includeReports: z.enum(['true', 'false']).default('false'),
    }),
    req.query,
  );
  const since = rangeStart(f.range as Range);
  const clauses = ['merged_into IS NULL', 'last_report_at >= @since'];
  const params: Record<string, unknown> = { since };
  if (f.category) { clauses.push('category = @category'); params.category = f.category; }
  if (f.areaId) { clauses.push('area_id = @areaId'); params.areaId = f.areaId; }
  if (f.status) { clauses.push('status = @status'); params.status = f.status; }
  else clauses.push(`status <> 'resolved'`);
  const patterns = db.prepare(`SELECT * FROM patterns WHERE ${clauses.join(' AND ')} ORDER BY confidence DESC`).all(params) as PatternRow[];

  let reports: unknown;
  if (f.includeReports === 'true' && can(req.staff!.role, 'reports:view')) {
    const rc = ['r.created_at >= @since', `r.status IN ('active','confirmed')`];
    const rp: Record<string, unknown> = { since };
    if (f.category) { rc.push('r.category = @category'); rp.category = f.category; }
    if (f.areaId) { rc.push('r.area_id = @areaId'); rp.areaId = f.areaId; }
    reports = (db.prepare(`SELECT r.id, r.category, r.lat, r.lng, r.occurred_at AS at, r.pattern_id AS patternId FROM reports r WHERE ${rc.join(' AND ')} ORDER BY r.created_at DESC LIMIT 300`).all(rp) as Array<{
      id: string; category: string; lat: number; lng: number; at: number; patternId: string | null;
    }>).map((r) => ({ ...r, at: iso(r.at) }));
  }
  res.json({
    filters: f,
    patterns: patterns.map((p) => ({ ...staffPattern(p), intensity: round(p.confidence / 100, 2) })),
    reports,
    legend: { high: 'confidence ≥ 70', medium: 'confidence 45–69', low: 'confidence < 45' },
  });
});

/** Analytics dashboard. Uses time windows only – nothing here identifies a reporter. */
authorityOverview.get('/analytics', requirePermission('patterns:view'), (req, res) => {
  const { range } = parse(z.object({ range: z.enum(['7d', '30d', '90d']).default('30d') }), req.query);
  const days = { '7d': 7, '30d': 30, '90d': 90 }[range];
  const now = Date.now();
  const since = sinceDays(days, now);
  const keys = lastDateKeys(now, days, OFF);

  const perDay = new Map(keys.map((k) => [k, { reports: 0, reporters: new Set<string>() }]));
  const blocks = Array.from({ length: 8 }, () => 0);
  const weekdays = Array.from({ length: 7 }, () => 0);
  for (const r of db.prepare('SELECT created_at AS c, occurred_at AS o, reporter_id AS rid, time_bucket AS b FROM reports WHERE created_at >= ?').all(since) as {
    c: number; o: number; rid: string; b: string;
  }[]) {
    const d = perDay.get(localParts(r.c, OFF).dateKey);
    if (d) { d.reports++; d.reporters.add(r.rid); }
    const lp = localParts(r.o, OFF);
    weekdays[lp.dow]!++;
    if (r.b !== 'today') blocks[blockOf(lp.hour)]!++;
  }

  const created = new Map(keys.map((k) => [k, { detected: 0, emerged: 0, resolved: 0 }]));
  for (const e of db.prepare(`SELECT ts, type FROM pattern_events WHERE ts >= ? AND type IN ('detected','emerged','status','auto_resolved')`).all(since) as { ts: number; type: string }[]) {
    const g = created.get(localParts(e.ts, OFF).dateKey);
    if (!g) continue;
    if (e.type === 'detected') g.detected++;
    else if (e.type === 'emerged') g.emerged++;
    else if (e.type === 'auto_resolved') g.resolved++;
  }

  const cats = db.prepare('SELECT category, COUNT(*) AS n FROM reports WHERE created_at >= ? GROUP BY category ORDER BY n DESC').all(since) as { category: string; n: number }[];
  const totalReports = cats.reduce((s, c) => s + c.n, 0);

  res.json({
    range,
    reportsOverTime: keys.map((date) => ({ date, reports: perDay.get(date)!.reports, distinctReporters: perDay.get(date)!.reporters.size })),
    categories: cats.map((c) => ({ id: c.category, label: categoryLabel(c.category, 'en'), count: c.n, share: totalReports ? round(c.n / totalReports, 3) : 0 })),
    patternsByArea: db.prepare(
      `SELECT area_label AS area, COUNT(*) AS patterns, SUM(status IN ('emerging','escalated')) AS emerging, SUM(report_count) AS reports
       FROM patterns WHERE merged_into IS NULL AND created_at >= ? GROUP BY area_label ORDER BY emerging DESC, patterns DESC LIMIT 10`,
    ).all(since),
    peakTimes: {
      byTimeBlock: blocks.map((count, i) => ({ block: windowLabel(i * 3, (i + 1) * 3), count })),
      byWeekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => ({ day, count: weekdays[i]! })),
    },
    patternGrowth: keys.map((date) => ({ date, ...created.get(date)! })),
    integrity: {
      flaggedImplausibleTravel: count('SELECT COUNT(*) AS n FROM reports WHERE created_at >= ? AND suspicious = 1', since),
      dismissedOrSpam: count(`SELECT COUNT(*) AS n FROM reports WHERE created_at >= ? AND status IN ('dismissed','spam')`, since),
    },
    methodology: {
      summary: 'Patterns are detected from repeated, independent signals – not from raw report volume.',
      signals: [
        'Distinct, trust-weighted reporters (one reporter counts once)',
        'Distinct time periods and days (recurrence beats a single incident seen by many)',
        'Geographic clustering around a shared centre',
        'Integrity checks: bursts, copy-pasted notes, brand-new sessions, implausible travel',
      ],
    },
  });
});

