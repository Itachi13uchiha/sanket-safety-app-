import { db, tx } from '../db/index.js';
import { ApiError, Errors } from '../lib/errors.js';
import type { AreaRow, ReportRow } from '../db/types.js';
import { bbox, haversineM } from '../lib/geo.js';
import type { Category, TimeBucket } from '../lib/i18n.js';
import { HOUR, MIN, startOfLocalDay } from '../lib/time.js';
import { newId, sanitizeNote } from '../lib/security.js';
import { config } from '../config.js';
import { describeLocation } from './areas.js';
import { evaluateAround, refreshPattern } from './detection.js';
import { getSettings } from './settings.js';
import { penalise, recordReview, type ReviewDecision } from './trust.js';

export interface SubmitInput {
  reporterId: string;
  category: Category;
  lat?: number;
  lng?: number;
  areaId?: string;
  locationSource: 'current' | 'map' | 'manual';
  when: TimeBucket;
  note?: string;
  idempotencyKey?: string;
}

/** Reporters only say roughly when it happened, so we store the midpoint of the chosen window. */
export function estimateOccurredAt(bucket: TimeBucket, now: number, offsetMin = config.TIMEZONE_OFFSET_MINUTES): number {
  let from: number;
  let to: number;
  if (bucket === 'now') {
    from = now - 5 * MIN;
    to = now;
  } else if (bucket === 'hour') {
    from = now - 60 * MIN;
    to = now - 5 * MIN;
  } else {
    from = startOfLocalDay(now, offsetMin);
    to = now - 60 * MIN;
    if (to - from < HOUR) {
      from = now - 3 * HOUR;
    }
  }
  return Math.round((from + to) / 2);
}

export function submitReport(input: SubmitInput, now = Date.now()): { report: ReportRow; duplicate: boolean } {
  const s = getSettings();
  return tx(() => {
    // Location: coordinates from the device/map, or the centre of a monitored area for manual entry.
    let lat = input.lat;
    let lng = input.lng;
    let areaId: string | null = null;
    if (lat == null || lng == null) {
      if (!input.areaId) {
        throw new ApiError(422, 'LOCATION_REQUIRED', 'A location is required: share coordinates or choose an area.');
      }
      const area = db.prepare('SELECT * FROM areas WHERE id = ? AND active = 1').get(input.areaId) as AreaRow | undefined;
      if (!area) throw Errors.notFound('Area');
      lat = area.lat;
      lng = area.lng;
      areaId = area.id;
    }

    // Idempotent retries (flaky networks): the same key returns the original report.
    if (input.idempotencyKey) {
      const prior = db
        .prepare('SELECT * FROM reports WHERE reporter_id = ? AND idem_key = ?')
        .get(input.reporterId, input.idempotencyKey) as ReportRow | undefined;
      if (prior) return { report: prior, duplicate: true };
    }

    // The same reporter re-filing the same thing in the same place is one signal, not two.
    const dupBox = bbox(lat, lng, s.antiGaming.duplicateRadiusMeters);
    const dupCandidates = db
      .prepare(
        `SELECT * FROM reports WHERE reporter_id = @rid AND category = @cat AND created_at > @since
           AND lat BETWEEN @minLat AND @maxLat AND lng BETWEEN @minLng AND @maxLng`,
      )
      .all({
        rid: input.reporterId,
        cat: input.category,
        since: now - s.antiGaming.duplicateWindowMinutes * MIN,
        ...dupBox,
      }) as ReportRow[];
    const dup = dupCandidates.find((r) => haversineM(r.lat, r.lng, lat!, lng!) <= s.antiGaming.duplicateRadiusMeters);
    if (dup) return { report: dup, duplicate: true };

    // Per-reporter volume limits (persisted, so they survive restarts and multiple instances).
    for (const [windowMs, max] of [
      [HOUR, s.antiGaming.maxReportsPerHour],
      [24 * HOUR, s.antiGaming.maxReportsPerDay],
    ] as const) {
      const row = db
        .prepare('SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM reports WHERE reporter_id = ? AND created_at > ?')
        .get(input.reporterId, now - windowMs) as { n: number; oldest: number | null };
      if (row.n >= max) {
        const retry = Math.max(1, Math.ceil(((row.oldest ?? now) + windowMs - now) / 1000));
        throw Errors.rateLimited(retry, 'You have reached the reporting limit for now. Please try again later.');
      }
    }

    // Implausible travel between two of this reporter's recent reports suggests scripted/spoofed input.
    let suspicious = 0;
    const last = db
      .prepare('SELECT lat, lng, created_at FROM reports WHERE reporter_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1')
      .get(input.reporterId, now - 6 * HOUR) as { lat: number; lng: number; created_at: number } | undefined;
    if (last) {
      const km = haversineM(last.lat, last.lng, lat, lng) / 1000;
      const hours = Math.max((now - last.created_at) / HOUR, 1 / 60);
      if (km > 2 && km / hours > s.antiGaming.maxTravelKmh) {
        suspicious = 1;
        penalise(input.reporterId, 0.7);
      }
    }

    const loc = describeLocation(lat, lng);
    const note = sanitizeNote(input.note);
    const row = {
      reporter_id: input.reporterId,
      category: input.category,
      lat,
      lng,
      location_source: input.locationSource,
      area_id: areaId ?? loc.areaId,
      area_label: loc.label,
      time_bucket: input.when,
      occurred_at: estimateOccurredAt(input.when, now),
      created_at: now,
      note: note.text,
      note_hash: note.hash,
      suspicious,
      idem_key: input.idempotencyKey ?? null,
    };

    let id = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      id = newId('SP');
      try {
        db.prepare(
          `INSERT INTO reports(id, reporter_id, category, lat, lng, location_source, area_id, area_label, time_bucket,
             occurred_at, created_at, note, note_hash, suspicious, idem_key)
           VALUES(@id, @reporter_id, @category, @lat, @lng, @location_source, @area_id, @area_label, @time_bucket,
             @occurred_at, @created_at, @note, @note_hash, @suspicious, @idem_key)`,
        ).run({ id, ...row });
        break;
      } catch (err) {
        if (attempt === 4 || !String((err as Error).message).includes('UNIQUE')) throw err;
      }
    }

    if (!suspicious) evaluateAround(id, now);
    return { report: db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow, duplicate: false };
  });
}

/** Authority moderation. Outcomes feed back into reporter trust so abuse costs the abuser. */
export function reviewReport(reportId: string, decision: ReviewDecision, note: string | undefined, actorLabel: string, now = Date.now()) {
  return tx(() => {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as ReportRow | undefined;
    if (!r) throw Errors.notFound('Report');
    if (r.status !== 'active') throw Errors.conflict('This report has already been reviewed', 'ALREADY_REVIEWED');
    const status = decision === 'confirm' ? 'confirmed' : decision === 'dismiss' ? 'dismissed' : 'spam';
    db.prepare('UPDATE reports SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(
      status, note ?? null, actorLabel, now, r.id,
    );
    recordReview(r.reporter_id, decision);
    if (r.pattern_id) refreshPattern(r.pattern_id, now);
    return db.prepare('SELECT * FROM reports WHERE id = ?').get(r.id) as ReportRow;
  });
}

/** Right to erasure: remove reports (or the whole anonymous identity) and re-score what they supported. */
export function eraseReports(reporterId: string, opts: { reportId?: string; everything?: boolean }, now = Date.now()): number {
  return tx(() => {
    const where = opts.reportId ? 'reporter_id = ? AND id = ?' : 'reporter_id = ?';
    const args = opts.reportId ? [reporterId, opts.reportId] : [reporterId];
    const affected = db.prepare(`SELECT DISTINCT pattern_id FROM reports WHERE ${where} AND pattern_id IS NOT NULL`).all(...args) as { pattern_id: string }[];
    const removed = db.prepare(`DELETE FROM reports WHERE ${where}`).run(...args).changes;
    if (opts.everything) db.prepare('DELETE FROM reporters WHERE id = ?').run(reporterId);
    for (const { pattern_id } of affected) refreshPattern(pattern_id, now);
    return removed;
  });
}
