import { db } from '../db/index.js';
import { config } from '../config.js';
import type { AlertRow, PatternRow, ReportRow } from '../db/types.js';
import { iso } from '../lib/http.js';
import { categoryLabel, statusLabel, timeLabel } from '../lib/i18n.js';
import { DAY, blockOf, lastDateKeys, localParts, windowLabel } from '../lib/time.js';
import { peakWindowOf } from './alerts.js';
import { getSettings } from './settings.js';
import { trustBand } from './trust.js';

export const REPORT_STATUS_SQL = `CASE WHEN r.status = 'confirmed' THEN 'confirmed'
  WHEN r.status IN ('dismissed','spam') THEN 'dismissed'
  WHEN r.pattern_id IS NOT NULL THEN 'linked' ELSE 'new' END`;

export interface StaffReportRow extends ReportRow {
  rcreated: number;
  rbehavior: number;
  display_status: 'new' | 'linked' | 'confirmed' | 'dismissed';
}

export function staffReport(r: StaffReportRow, detail = false, now = Date.now()) {
  return {
    id: r.id,
    category: { id: r.category, label: categoryLabel(r.category, 'en') },
    location: { label: r.area_label, lat: r.lat, lng: r.lng, source: r.location_source },
    time: { bucket: r.time_bucket, label: timeLabel(r.time_bucket, 'en'), occurredAt: iso(r.occurred_at) },
    submittedAt: iso(r.created_at),
    status: r.display_status,
    patternId: r.pattern_id,
    integrity: {
      reporterTrust: trustBand(r.rcreated, r.rbehavior, now),
      flaggedImplausibleTravel: !!r.suspicious,
    },
    ...(detail
      ? { note: r.note, review: r.reviewed_at ? { decision: r.status, note: r.review_note, by: r.reviewed_by, at: iso(r.reviewed_at) } : null }
      : {}),
  };
}

export const REPORT_SELECT = `SELECT r.*, rp.created_at AS rcreated, rp.behavior AS rbehavior, ${REPORT_STATUS_SQL} AS display_status
  FROM reports r JOIN reporters rp ON rp.id = r.reporter_id`;

export function staffPattern(p: PatternRow) {
  return {
    id: p.id,
    category: { id: p.category, label: categoryLabel(p.category, 'en') },
    area: p.area_label,
    location: { lat: p.lat, lng: p.lng },
    status: { code: p.status, label: statusLabel(p.status, 'en') },
    confidence: p.confidence,
    reportCount: p.report_count,
    distinctReporters: p.distinct_reporters,
    distinctPeriods: Math.max(p.distinct_periods, p.distinct_days),
    peakWindow: peakWindowOf(p),
    firstSeenAt: iso(p.first_seen_at),
    lastSignalAt: iso(p.last_report_at),
    emergedAt: iso(p.emerged_at),
    resolvedAt: iso(p.resolved_at),
    updatedAt: iso(p.updated_at),
  };
}

export function staffAlert(a: AlertRow) {
  return {
    id: a.id,
    patternId: a.pattern_id,
    level: a.level,
    status: a.status,
    title: a.title,
    body: a.body,
    recommendedAction: a.recommended_action,
    createdAt: iso(a.created_at),
    updatedAt: iso(a.updated_at),
    handledBy: a.handled_by,
  };
}

/** Reports-per-day and per-time-block breakdown for a pattern's "reporting timeline". */
export function reportingTimeline(patternId: string, now = Date.now()) {
  const off = config.TIMEZONE_OFFSET_MINUTES;
  const days = getSettings().detection.windowDays;
  const keys = lastDateKeys(now, days, off);
  const rows = db
    .prepare(`SELECT reporter_id AS rid, occurred_at AS at, time_bucket AS bucket FROM reports
              WHERE pattern_id = ? AND status IN ('active','confirmed') AND suspicious = 0`)
    .all(patternId) as { rid: string; at: number; bucket: string }[];
  const perDay = new Map(keys.map((k) => [k, { reports: 0, reporters: new Set<string>() }]));
  const blocks = Array.from({ length: 8 }, () => 0);
  for (const r of rows) {
    const lp = localParts(r.at, off);
    const d = perDay.get(lp.dateKey);
    if (d) {
      d.reports++;
      d.reporters.add(r.rid);
    }
    if (r.bucket !== 'today') blocks[blockOf(lp.hour)]!++;
  }
  return {
    perDay: keys.map((date) => ({ date, reports: perDay.get(date)!.reports, reporters: perDay.get(date)!.reporters.size })),
    perTimeBlock: blocks.map((count, i) => ({ block: windowLabel(i * 3, (i + 1) * 3), count })),
  };
}

export function patternEvents(patternId: string) {
  return (db.prepare('SELECT ts, type, actor, detail FROM pattern_events WHERE pattern_id = ? ORDER BY ts ASC, id ASC').all(patternId) as {
    ts: number; type: string; actor: string | null; detail: string | null;
  }[]).map((e) => ({ at: iso(e.ts), type: e.type, actor: e.actor, detail: e.detail ? JSON.parse(e.detail) : null }));
}

export function allowedNextStatuses(status: PatternRow['status']): string[] {
  return { emerging: ['monitoring', 'escalated', 'resolved'], monitoring: ['escalated', 'resolved'], escalated: ['monitoring', 'resolved'], resolved: ['monitoring'] }[status];
}

export const sinceDays = (days: number, now = Date.now()) => now - days * DAY;
