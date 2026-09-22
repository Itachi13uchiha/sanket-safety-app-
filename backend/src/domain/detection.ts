/**
 * Pattern detection.
 *
 * A pattern is NOT "many reports". It is repeated, independent, geographically coherent evidence
 * that survives integrity checks. Every report is reduced to signals that are hard to fake cheaply:
 *
 *   reporters  – distinct, trust-weighted reporters (one reporter counts once, however often they file)
 *   temporal   – distinct time periods and days (one incident seen by many people is weaker than a recurrence)
 *   spatial    – how tightly the reports cluster around a common centre
 *   integrity  – penalties for bursts of near-simultaneous filings, copy-pasted notes and brand-new sessions
 */
import { db, tx } from '../db/index.js';
import { config } from '../config.js';
import type { PatternRow } from '../db/types.js';
import { bbox, centroid, haversineM, meanDistanceM } from '../lib/geo.js';
import { clamp } from '../lib/http.js';
import { DAY, HOUR, MIN, blockOf, localParts } from '../lib/time.js';
import { newId } from '../lib/security.js';
import type { PatternStatus } from '../lib/i18n.js';
import { describeLocation } from './areas.js';
import { ensureAlert, pushNotification, setAlertStatus, syncAlert } from './alerts.js';
import { getSettings, type Settings } from './settings.js';
import { trustOf } from './trust.js';

export interface Evidence {
  id: string;
  reporterId: string;
  lat: number;
  lng: number;
  occurredAt: number;
  createdAt: number;
  timeBucket: string;
  noteHash: string | null;
  reporterCreatedAt: number;
  behavior: number;
  patternId: string | null;
}

export type DetectionLevel = 'none' | 'monitoring' | 'emerging';

export interface Analysis {
  reportCount: number;
  distinctReporters: number;
  effectiveReporters: number;
  distinctPeriods: number;
  distinctDays: number;
  centroid: { lat: number; lng: number };
  spreadMeters: number;
  peak: { startHour: number; endHour: number } | null;
  burstRatio: number;
  duplicateRatio: number;
  newReporterRatio: number;
  components: { reporters: number; temporal: number; spatial: number; integrity: number };
  confidence: number;
  level: DetectionLevel;
}

const EMPTY: Analysis = {
  reportCount: 0, distinctReporters: 0, effectiveReporters: 0, distinctPeriods: 0, distinctDays: 0,
  centroid: { lat: 0, lng: 0 }, spreadMeters: 0, peak: null, burstRatio: 0, duplicateRatio: 0,
  newReporterRatio: 0, components: { reporters: 0, temporal: 0, spatial: 0, integrity: 0 },
  confidence: 0, level: 'none',
};

/** Pure scoring function – no I/O, fully unit-testable. */
export function analyse(all: Evidence[], s: Settings, now: number, offsetMin = config.TIMEZONE_OFFSET_MINUTES): Analysis {
  const radius = s.detection.radiusMeters;

  // 1. Drop evidence from reporters whose trust has collapsed.
  const trust = new Map<string, number>();
  const rows = all.filter((e) => {
    const t = trustOf(e.reporterCreatedAt, e.behavior, now);
    trust.set(e.reporterId, t);
    return t >= s.antiGaming.minTrust;
  });
  if (!rows.length) return { ...EMPTY };

  // 2. Reporter diversity – each reporter contributes once, weighted by trust.
  const reporterIds = [...new Set(rows.map((r) => r.reporterId))];
  const distinctReporters = reporterIds.length;
  const effectiveReporters = reporterIds.reduce((sum, id) => sum + (trust.get(id) ?? 0), 0);

  // 3. Temporal diversity. "Earlier today" is too coarse for a 3-hour period, so it only counts for days.
  const periods = new Set<string>();
  const days = new Set<string>();
  const blockReporters: Set<string>[] = Array.from({ length: 8 }, () => new Set<string>());
  for (const r of rows) {
    const lp = localParts(r.occurredAt, offsetMin);
    days.add(lp.dateKey);
    if (r.timeBucket !== 'today') {
      periods.add(`${lp.dateKey}#${blockOf(lp.hour)}`);
      blockReporters[blockOf(lp.hour)]!.add(r.reporterId);
    }
  }
  const counts = blockReporters.map((b) => b.size);
  const max = Math.max(...counts);
  let peak: Analysis['peak'] = null;
  if (max > 0) {
    const i = counts.indexOf(max);
    let lo = i;
    let hi = i;
    while (lo > 0 && counts[lo - 1]! >= 0.6 * max) lo--;
    while (hi < 7 && counts[hi + 1]! >= 0.6 * max) hi++;
    peak = { startHour: lo * 3, endHour: (hi + 1) * 3 };
  }

  // 4. Geographic clustering.
  const c = centroid(rows);
  const spread = meanDistanceM(rows, c);

  // 5. Integrity signals.
  const n = rows.length;
  const createdSorted = rows.map((r) => r.createdAt).sort((a, b) => a - b);
  const win = s.antiGaming.burstWindowMinutes * MIN;
  let best = 0;
  for (let i = 0, j = 0; i < createdSorted.length; i++) {
    while (createdSorted[i]! - createdSorted[j]! > win) j++;
    best = Math.max(best, i - j + 1);
  }
  const burstRatio = n >= 3 ? best / n : 0;

  const byNote = new Map<string, { reporters: Set<string>; rows: number }>();
  for (const r of rows) {
    if (!r.noteHash) continue;
    const g = byNote.get(r.noteHash) ?? { reporters: new Set<string>(), rows: 0 };
    g.reporters.add(r.reporterId);
    g.rows++;
    byNote.set(r.noteHash, g);
  }
  let dupRows = 0;
  for (const g of byNote.values()) if (g.reporters.size >= 2) dupRows += g.rows;
  const duplicateRatio = dupRows / n;

  const newReporters = reporterIds.filter((id) => {
    const r = rows.find((x) => x.reporterId === id)!;
    return now - r.reporterCreatedAt < 6 * HOUR;
  }).length;
  const newReporterRatio = newReporters / distinctReporters;

  // 6. Components (each 0..1) and confidence.
  const P = periods.size;
  const Dd = days.size;
  const reportersScore = Math.max(0, 1 - Math.exp(-(effectiveReporters - 1) / 2.5));
  const temporalScore = clamp(0.65 * clamp((P - 1) / 3, 0, 1) + 0.35 * clamp((Dd - 1) / 2, 0, 1), 0, 1);
  const spatialScore = spread <= 0.4 * radius ? 1 : clamp(1 - (spread - 0.4 * radius) / (0.6 * radius), 0, 1);
  const burstPenalty = clamp((burstRatio - 0.5) / 0.5, 0, 1);
  const integrityScore = 1 - clamp(0.5 * burstPenalty + 0.3 * duplicateRatio + 0.2 * newReporterRatio, 0, 1);

  const confidence = Math.round(
    100 * (0.4 * reportersScore + 0.3 * temporalScore + 0.2 * spatialScore + 0.1 * integrityScore),
  );

  const recurrence = P >= s.detection.emergingMinPeriods || Dd >= 2;
  let level: DetectionLevel = 'none';
  if (
    distinctReporters >= s.detection.emergingMinReporters &&
    recurrence &&
    confidence >= s.detection.emergingMinConfidence
  ) {
    level = 'emerging';
  } else if (
    distinctReporters >= s.detection.monitoringMinReporters &&
    confidence >= s.detection.monitoringMinConfidence
  ) {
    level = 'monitoring';
  }

  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    reportCount: n,
    distinctReporters,
    effectiveReporters: r3(effectiveReporters),
    distinctPeriods: P,
    distinctDays: Dd,
    centroid: c,
    spreadMeters: Math.round(spread),
    peak,
    burstRatio: r3(burstRatio),
    duplicateRatio: r3(duplicateRatio),
    newReporterRatio: r3(newReporterRatio),
    components: {
      reporters: r3(reportersScore),
      temporal: r3(temporalScore),
      spatial: r3(spatialScore),
      integrity: r3(integrityScore),
    },
    confidence,
    level,
  };
}

/* ───────────────────────────── persistence ───────────────────────────── */

const EVIDENCE_SELECT = `
  SELECT r.id, r.reporter_id AS reporterId, r.lat, r.lng, r.occurred_at AS occurredAt, r.created_at AS createdAt,
         r.time_bucket AS timeBucket, r.note_hash AS noteHash, r.pattern_id AS patternId,
         rp.created_at AS reporterCreatedAt, rp.behavior AS behavior
  FROM reports r JOIN reporters rp ON rp.id = r.reporter_id`;

const LIVE = `r.status IN ('active','confirmed') AND r.suspicious = 0`;
const ACTIVE_STATUSES = `('monitoring','emerging','escalated')`;
const RANK: Record<PatternStatus, number> = { resolved: 0, monitoring: 1, emerging: 2, escalated: 3 };

function neighbourhood(category: string, at: { lat: number; lng: number }, radiusM: number, since: number): Evidence[] {
  const b = bbox(at.lat, at.lng, radiusM);
  const rows = db
    .prepare(
      `${EVIDENCE_SELECT}
       WHERE r.category = @category AND ${LIVE} AND r.occurred_at >= @since
         AND r.lat BETWEEN @minLat AND @maxLat AND r.lng BETWEEN @minLng AND @maxLng
         AND (r.pattern_id IS NULL OR r.pattern_id IN (SELECT id FROM patterns WHERE status <> 'resolved'))`,
    )
    .all({ category, since, ...b }) as Evidence[];
  return rows.filter((r) => haversineM(r.lat, r.lng, at.lat, at.lng) <= radiusM);
}

function linkedEvidence(patternIds: string[], since: number): Evidence[] {
  if (!patternIds.length) return [];
  const marks = patternIds.map(() => '?').join(',');
  return db
    .prepare(`${EVIDENCE_SELECT} WHERE r.pattern_id IN (${marks}) AND ${LIVE} AND r.occurred_at >= ?`)
    .all(...patternIds, since) as Evidence[];
}

function activePatternsNear(category: string, at: { lat: number; lng: number }, radiusM: number): PatternRow[] {
  const b = bbox(at.lat, at.lng, radiusM);
  const rows = db
    .prepare(
      `SELECT * FROM patterns
       WHERE category = @category AND status IN ${ACTIVE_STATUSES} AND merged_into IS NULL
         AND lat BETWEEN @minLat AND @maxLat AND lng BETWEEN @minLng AND @maxLng
       ORDER BY first_seen_at ASC`,
    )
    .all({ category, ...b }) as PatternRow[];
  return rows.filter((p) => haversineM(p.lat, p.lng, at.lat, at.lng) <= radiusM);
}

export function addPatternEvent(patternId: string, type: string, now: number, actor: string | null, detail?: unknown) {
  db.prepare('INSERT INTO pattern_events(pattern_id, ts, type, actor, detail) VALUES(?,?,?,?,?)').run(
    patternId, now, type, actor, detail === undefined ? null : JSON.stringify(detail),
  );
}

const getPattern = (id: string) => db.prepare('SELECT * FROM patterns WHERE id = ?').get(id) as PatternRow;

function writeMetrics(p: PatternRow, ev: Evidence[], a: Analysis, status: PatternStatus, emergedAt: number | null, now: number) {
  db.prepare(
    `UPDATE patterns SET status=@status, lat=@lat, lng=@lng, report_count=@rc, distinct_reporters=@dr,
       effective_reporters=@er, distinct_periods=@dp, distinct_days=@dd, spread_m=@sp, confidence=@cf,
       peak_start_hour=@ps, peak_end_hour=@pe, analysis_json=@aj, first_seen_at=@fs, last_report_at=@lr,
       emerged_at=@em, updated_at=@now
     WHERE id=@id`,
  ).run({
    id: p.id,
    status,
    lat: a.centroid.lat,
    lng: a.centroid.lng,
    rc: ev.length,
    dr: a.distinctReporters,
    er: a.effectiveReporters,
    dp: a.distinctPeriods,
    dd: a.distinctDays,
    sp: a.spreadMeters,
    cf: a.confidence,
    ps: a.peak?.startHour ?? null,
    pe: a.peak?.endHour ?? null,
    aj: JSON.stringify({
      components: a.components,
      burstRatio: a.burstRatio,
      duplicateRatio: a.duplicateRatio,
      newReporterRatio: a.newReporterRatio,
    }),
    fs: ev.length ? Math.min(...ev.map((e) => e.occurredAt)) : p.first_seen_at,
    lr: ev.length ? Math.max(...ev.map((e) => e.createdAt)) : p.last_report_at,
    em: emergedAt,
    now,
  });
}

/** Promote to "emerging" the first time the evidence bar is met: alert authorities, notify the area. */
function promoteIfEmerging(id: string, a: Analysis, now: number) {
  const p = getPattern(id);
  if (a.level !== 'emerging' || p.emerged_at != null || p.status === 'resolved') return;
  const status: PatternStatus = p.status === 'monitoring' ? 'emerging' : p.status; // escalated stays escalated
  db.prepare('UPDATE patterns SET status = ?, emerged_at = ?, updated_at = ? WHERE id = ?').run(status, now, now, id);
  addPatternEvent(id, 'emerged', now, null, { confidence: a.confidence, reporters: a.distinctReporters });
  ensureAlert(getPattern(id), now);
}

function mergeInto(target: PatternRow, others: PatternRow[], now: number) {
  for (const o of others) {
    db.prepare('UPDATE reports SET pattern_id = ? WHERE pattern_id = ?').run(target.id, o.id);
    db.prepare(`UPDATE patterns SET status='resolved', resolved_at=?, merged_into=?, updated_at=? WHERE id=?`).run(
      now, target.id, now, o.id,
    );
    const targetHasAlert = db.prepare('SELECT 1 FROM alerts WHERE pattern_id = ?').get(target.id);
    if (!targetHasAlert) db.prepare('UPDATE alerts SET pattern_id = ? WHERE pattern_id = ?').run(target.id, o.id);
    else setAlertStatus(o.id, 'resolved', now);
    db.prepare('UPDATE cases SET pattern_id = ? WHERE pattern_id = ?').run(target.id, o.id);
    addPatternEvent(o.id, 'merged', now, null, { into: target.id });
    addPatternEvent(target.id, 'merged_in', now, null, { from: o.id });
    if (o.emerged_at != null && (target.emerged_at == null || o.emerged_at < target.emerged_at)) {
      db.prepare('UPDATE patterns SET emerged_at = ? WHERE id = ?').run(o.emerged_at, target.id);
    }
    if (RANK[o.status] > RANK[getPattern(target.id).status]) {
      db.prepare('UPDATE patterns SET status = ? WHERE id = ?').run(o.status, target.id);
    }
  }
}

/**
 * Called after every accepted report. Gathers the local, same-category evidence, scores it, and
 * creates / updates / merges the pattern it belongs to. Idempotent for a given evidence set.
 */
export function evaluateAround(reportId: string, now = Date.now()): { patternId: string | null; level: DetectionLevel } {
  return tx(() => {
    const s = getSettings();
    const rep = db.prepare('SELECT id, category, lat, lng, status, suspicious FROM reports WHERE id = ?').get(reportId) as
      | { id: string; category: string; lat: number; lng: number; status: string; suspicious: number }
      | undefined;
    if (!rep || rep.suspicious || (rep.status !== 'active' && rep.status !== 'confirmed')) {
      return { patternId: null, level: 'none' as const };
    }

    const since = now - s.detection.windowDays * DAY;
    const R = s.detection.radiusMeters;

    // Anchor on the new report, then re-centre once on the local centroid.
    let at = { lat: rep.lat, lng: rep.lng };
    let rows = neighbourhood(rep.category, at, R, since);
    if (rows.length > 1) {
      const c = centroid(rows);
      const shifted = neighbourhood(rep.category, c, R, since);
      if (shifted.some((r) => r.id === rep.id)) {
        at = c;
        rows = shifted;
      }
    }

    const near = activePatternsNear(rep.category, at, R);
    const linked = linkedEvidence(near.map((p) => p.id), since);
    const evidence = [...new Map([...rows, ...linked].map((e) => [e.id, e])).values()];
    const a = analyse(evidence, s, now);

    let target: PatternRow | undefined = near[0];
    if (!target && a.level === 'none') return { patternId: null, level: a.level };

    if (!target) {
      const loc = describeLocation(a.centroid.lat, a.centroid.lng);
      const id = newId('PT');
      db.prepare(
        `INSERT INTO patterns(id, category, status, lat, lng, area_id, area_label, first_seen_at, last_report_at, created_at, updated_at)
         VALUES(@id, @category, 'monitoring', @lat, @lng, @areaId, @label, @now, @now, @now, @now)`,
      ).run({ id, category: rep.category, lat: a.centroid.lat, lng: a.centroid.lng, areaId: loc.areaId, label: loc.label, now });
      addPatternEvent(id, 'detected', now, null, { reporters: a.distinctReporters, confidence: a.confidence });
      target = getPattern(id);
    } else if (near.length > 1) {
      mergeInto(target, near.slice(1), now);
      target = getPattern(target.id);
    }

    for (const e of evidence) {
      if (e.patternId !== target.id) db.prepare('UPDATE reports SET pattern_id = ? WHERE id = ?').run(target.id, e.id);
    }
    writeMetrics(target, evidence, a, getPattern(target.id).status, getPattern(target.id).emerged_at, now);
    promoteIfEmerging(target.id, a, now);
    syncAlert(getPattern(target.id), now);
    return { patternId: target.id, level: a.level };
  });
}

/** Re-score a pattern from its own linked reports (after moderation, erasure or ageing). */
export function refreshPattern(patternId: string, now = Date.now()): 'updated' | 'withdrawn' | 'skipped' {
  return tx(() => {
    const p = db.prepare('SELECT * FROM patterns WHERE id = ?').get(patternId) as PatternRow | undefined;
    if (!p || p.status === 'resolved') return 'skipped';
    const s = getSettings();
    const ev = linkedEvidence([p.id], now - s.detection.windowDays * DAY);
    const a = analyse(ev, s, now);

    if (a.distinctReporters < s.detection.monitoringMinReporters) {
      const hasCase = db.prepare('SELECT 1 FROM cases WHERE pattern_id = ?').get(p.id);
      if (p.emerged_at == null && !hasCase) {
        db.prepare('UPDATE reports SET pattern_id = NULL WHERE pattern_id = ?').run(p.id);
        db.prepare('DELETE FROM patterns WHERE id = ?').run(p.id);
      } else {
        db.prepare(`UPDATE patterns SET status='resolved', resolved_at=?, updated_at=? WHERE id=?`).run(now, now, p.id);
        setAlertStatus(p.id, 'resolved', now);
        addPatternEvent(p.id, 'evidence_withdrawn', now, null);
      }
      return 'withdrawn';
    }
    writeMetrics(p, ev, a, p.status, p.emerged_at, now);
    syncAlert(getPattern(p.id), now);
    return 'updated';
  });
}

/** Periodic housekeeping: age out evidence, close quiet patterns, enforce retention. */
export function runMaintenance(now = Date.now()) {
  const s = getSettings();
  let refreshed = 0;
  let autoResolved = 0;

  const active = db.prepare(`SELECT id FROM patterns WHERE status IN ${ACTIVE_STATUSES} AND merged_into IS NULL`).all() as { id: string }[];
  for (const { id } of active) {
    refreshPattern(id, now);
    refreshed++;
  }

  const quiet = db
    .prepare(`SELECT * FROM patterns WHERE status IN ('monitoring','emerging') AND merged_into IS NULL AND last_report_at < ?`)
    .all(now - s.detection.autoResolveQuietDays * DAY) as PatternRow[];
  for (const p of quiet) {
    tx(() => {
      db.prepare(`UPDATE patterns SET status='resolved', resolved_at=?, updated_at=? WHERE id=?`).run(now, now, p.id);
      setAlertStatus(p.id, 'resolved', now);
      addPatternEvent(p.id, 'auto_resolved', now, null, { quietDays: s.detection.autoResolveQuietDays });
      pushNotification({
        audience: 'authority', type: 'system', title: 'Pattern closed automatically',
        body: `${p.area_label}: no new signals for ${s.detection.autoResolveQuietDays} days.`, patternId: p.id, now,
      });
    });
    autoResolved++;
  }

  const purged = db
    .prepare(`DELETE FROM reports WHERE created_at < ? AND id NOT IN (SELECT report_id FROM case_reports)`)
    .run(now - s.privacy.retentionDays * DAY).changes;
  db.prepare('DELETE FROM otp_challenges WHERE expires_at < ?').run(now - DAY);
  db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(now - DAY);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now - 7 * DAY);
  db.prepare(`DELETE FROM notifications WHERE created_at < ? AND audience <> 'system'`).run(now - 90 * DAY);
  return { refreshed, autoResolved, purged };
}
