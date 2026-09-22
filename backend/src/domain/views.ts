import { db } from '../db/index.js';
import { config } from '../config.js';
import type { PatternRow, ReportRow } from '../db/types.js';
import { bbox, haversineM, snapPoint } from '../lib/geo.js';
import { round } from '../lib/http.js';
import { iso } from '../lib/http.js';
import {
  categoryLabel, signalTermLabel, statusLabel, timeLabel, type Lang, type SignalTerm,
} from '../lib/i18n.js';
import { DAY, HOUR, lastDateKeys, localParts, startOfLocalDay } from '../lib/time.js';
import { alertLevel, peakWindowOf } from './alerts.js';
import { getSettings } from './settings.js';
import { trustOf } from './trust.js';

const LIVE = `r.status IN ('active','confirmed') AND r.suspicious = 0`;

/* ───────────── time range filters shared by the map endpoints ───────────── */
export type Range = 'today' | 'week' | 'month';
export function rangeStart(range: Range, now = Date.now()): number {
  if (range === 'today') return startOfLocalDay(now, config.TIMEZONE_OFFSET_MINUTES);
  return now - (range === 'week' ? 7 : 30) * DAY;
}

/* ───────────── patterns (citizen-safe view) ───────────── */
function dayPart(startHour: number): string {
  if (startHour < 5) return 'night';
  if (startHour < 12) return 'morning';
  if (startHour < 17) return 'afternoon';
  if (startHour < 21) return 'evening';
  return 'night';
}

export function publicPatternSummary(p: PatternRow): string {
  const win = peakWindowOf(p);
  const when = win ? ` during ${dayPart(win.startHour)} hours (${win.label})` : '';
  return `Repeated ${categoryLabel(p.category, 'en').toLowerCase()} signals have been reported around ${p.area_label}${when}.`;
}

const termOf = (p: PatternRow): SignalTerm => (p.status === 'monitoring' ? 'monitoring' : 'emerging_pattern');

/** Distinct reporters per local day for the last `days` days – counts, never individual reports. */
export function trendFor(patternId: string, days = 7, now = Date.now()) {
  const keys = lastDateKeys(now, days, config.TIMEZONE_OFFSET_MINUTES);
  const rows = db
    .prepare(`SELECT r.reporter_id AS rid, r.occurred_at AS at FROM reports r WHERE r.pattern_id = ? AND ${LIVE} AND r.occurred_at >= ?`)
    .all(patternId, now - (days + 1) * DAY) as { rid: string; at: number }[];
  const per = new Map<string, Set<string>>(keys.map((k) => [k, new Set<string>()]));
  for (const r of rows) per.get(localParts(r.at, config.TIMEZONE_OFFSET_MINUTES).dateKey)?.add(r.rid);
  return keys.map((date) => ({ date, reports: per.get(date)!.size }));
}

export function publicPattern(p: PatternRow, lang: Lang, from?: { lat: number; lng: number }) {
  const s = getSettings();
  const at = snapPoint(p.lat, p.lng, s.privacy.publicGridDegrees);
  const term = termOf(p);
  return {
    id: p.id,
    area: p.area_label,
    category: { id: p.category, label: categoryLabel(p.category, lang) },
    status: { code: p.status, label: statusLabel(p.status, lang) },
    term: { code: term, label: signalTermLabel(term, lang) },
    level: alertLevel(p.confidence, p.status),
    distinctReports: p.distinct_reporters,
    distinctPeriods: Math.max(p.distinct_periods, p.distinct_days),
    daysObserved: p.distinct_days,
    peakWindow: peakWindowOf(p),
    firstDetectedAt: iso(p.emerged_at ?? p.first_seen_at),
    lastSignalAt: iso(p.last_report_at),
    location: at,
    distanceKm: from ? round(haversineM(from.lat, from.lng, at.lat, at.lng) / 1000, 1) : undefined,
    summary: publicPatternSummary(p),
  };
}

/** Patterns the public may see: past the "emerging" bar at least once, and backed by enough reporters (k-anonymity). */
export function visiblePatterns(opts: { lat?: number; lng?: number; radiusKm?: number; category?: string; limit?: number } = {}): PatternRow[] {
  const s = getSettings();
  const params: Record<string, unknown> = { k: s.privacy.minReportersForPublic };
  let sql = `SELECT * FROM patterns WHERE merged_into IS NULL AND status IN ('emerging','monitoring','escalated')
             AND emerged_at IS NOT NULL AND distinct_reporters >= @k`;
  if (opts.category) {
    sql += ' AND category = @category';
    params.category = opts.category;
  }
  if (opts.lat != null && opts.lng != null) {
    Object.assign(params, bbox(opts.lat, opts.lng, (opts.radiusKm ?? 5) * 1000));
    sql += ' AND lat BETWEEN @minLat AND @maxLat AND lng BETWEEN @minLng AND @maxLng';
  }
  sql += ' ORDER BY confidence DESC, last_report_at DESC';
  let rows = db.prepare(sql).all(params) as PatternRow[];
  if (opts.lat != null && opts.lng != null) {
    rows = rows.filter((p) => haversineM(opts.lat!, opts.lng!, p.lat, p.lng) <= (opts.radiusKm ?? 5) * 1000);
  }
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}

/* ───────────── aggregated "signals" (k-anonymous grid cells) ───────────── */
export function signalsNear(
  lat: number, lng: number, radiusKm: number, since: number, lang: Lang, category?: string, now = Date.now(),
) {
  const s = getSettings();
  const params: Record<string, unknown> = { since, ...bbox(lat, lng, radiusKm * 1000) };
  let sql = `SELECT r.category, r.lat, r.lng, r.reporter_id AS rid, r.occurred_at AS at, rp.created_at AS rcreated, rp.behavior
             FROM reports r JOIN reporters rp ON rp.id = r.reporter_id
             WHERE ${LIVE} AND r.occurred_at >= @since
               AND r.lat BETWEEN @minLat AND @maxLat AND r.lng BETWEEN @minLng AND @maxLng`;
  if (category) {
    sql += ' AND r.category = @category';
    params.category = category;
  }
  const rows = db.prepare(sql).all(params) as {
    category: string; lat: number; lng: number; rid: string; at: number; rcreated: number; behavior: number;
  }[];

  const cells = new Map<string, { category: string; lat: number; lng: number; reporters: Set<string>; lastAt: number }>();
  for (const r of rows) {
    if (haversineM(lat, lng, r.lat, r.lng) > radiusKm * 1000) continue;
    if (trustOf(r.rcreated, r.behavior, now) < s.antiGaming.minTrust) continue;
    const c = snapPoint(r.lat, r.lng, s.privacy.publicGridDegrees);
    const key = `${r.category}|${c.lat}|${c.lng}`;
    const cell = cells.get(key) ?? { category: r.category, ...c, reporters: new Set<string>(), lastAt: 0 };
    cell.reporters.add(r.rid);
    cell.lastAt = Math.max(cell.lastAt, r.at);
    cells.set(key, cell);
  }

  return [...cells.values()]
    .filter((c) => c.reporters.size >= s.privacy.minReportersForPublicSignal)
    .map((c) => {
      const n = c.reporters.size;
      const term: SignalTerm = n >= 3 ? 'increased_activity' : 'repeated_reports';
      return {
        location: { lat: c.lat, lng: c.lng },
        category: { id: c.category, label: categoryLabel(c.category, lang) },
        distinctReports: n,
        level: n >= 5 ? ('high' as const) : n >= 3 ? ('medium' as const) : ('low' as const),
        term: { code: term, label: signalTermLabel(term, lang) },
        lastSignalAt: iso(c.lastAt),
        recency: now - c.lastAt < HOUR ? ('now' as const) : c.lastAt >= startOfLocalDay(now, config.TIMEZONE_OFFSET_MINUTES) ? ('today' as const) : ('earlier' as const),
        distanceKm: round(haversineM(lat, lng, c.lat, c.lng) / 1000, 1),
      };
    })
    .sort((a, b) => Date.parse(b.lastSignalAt!) - Date.parse(a.lastSignalAt!));
}

/* ───────────── reports ───────────── */
export type CitizenReportStatus = 'open' | 'resolved';

export function citizenReport(r: ReportRow, lang: Lang, patternStatus?: string | null, detail = false) {
  const closed = r.status === 'dismissed' || r.status === 'spam' || patternStatus === 'resolved';
  return {
    id: r.id,
    category: { id: r.category, label: categoryLabel(r.category, lang) },
    location: { label: r.area_label, ...(detail ? { lat: r.lat, lng: r.lng } : {}) },
    time: { bucket: r.time_bucket, label: timeLabel(r.time_bucket, lang), occurredAt: iso(r.occurred_at) },
    status: (closed ? 'resolved' : 'open') as CitizenReportStatus,
    submittedAt: iso(r.created_at),
    anonymous: true as const,
    ...(detail ? { note: r.note } : {}),
  };
}
