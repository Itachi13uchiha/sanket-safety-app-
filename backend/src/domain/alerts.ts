import { db } from '../db/index.js';
import type { AlertRow, PatternRow } from '../db/types.js';
import { categoryLabel } from '../lib/i18n.js';
import { newId } from '../lib/security.js';
import { snapPoint } from '../lib/geo.js';
import { windowLabel } from '../lib/time.js';
import { getSettings } from './settings.js';

export type AlertLevel = 'low' | 'medium' | 'high';

export function alertLevel(confidence: number, status: string): AlertLevel {
  if (status === 'escalated') return 'high';
  return confidence >= 85 ? 'high' : confidence >= 70 ? 'medium' : 'low';
}

export function peakWindowOf(p: Pick<PatternRow, 'peak_start_hour' | 'peak_end_hour'>) {
  if (p.peak_start_hour == null || p.peak_end_hour == null) return null;
  return {
    startHour: p.peak_start_hour,
    endHour: p.peak_end_hour,
    label: windowLabel(p.peak_start_hour, p.peak_end_hour),
  };
}

/** Rule-based, non-accusatory next step for officers. Never names or targets individuals. */
export function recommendedAction(p: PatternRow): string {
  const win = peakWindowOf(p);
  const when = win ? ` during ${win.label}` : '';
  switch (p.category) {
    case 'harassment':
    case 'catcalling':
    case 'following':
    case 'intimidation':
      return `Increase visible patrol presence around ${p.area_label}${when} and review CCTV coverage and lighting for the approach routes.`;
    case 'loitering':
    case 'suspicious':
      return `Schedule periodic patrol checks around ${p.area_label}${when}; keep monitoring before taking any further step.`;
    case 'unsafe-area':
      return `Inspect lighting, footpaths and sightlines at ${p.area_label} and coordinate with the civic body responsible for the site.`;
    default:
      return `Review the contributing reports for ${p.area_label} and keep the pattern under monitoring.`;
  }
}

export function pushNotification(n: {
  audience: 'citizen' | 'authority' | 'system';
  type: string;
  title: string;
  body: string;
  level?: AlertLevel | null;
  patternId?: string | null;
  lat?: number | null;
  lng?: number | null;
  userId?: string | null;
  now?: number;
}): string {
  const id = newId('NT', 8);
  db.prepare(
    `INSERT INTO notifications(id, audience, type, title, body, level, pattern_id, lat, lng, user_id, created_at)
     VALUES(@id, @audience, @type, @title, @body, @level, @patternId, @lat, @lng, @userId, @now)`,
  ).run({
    id,
    audience: n.audience,
    type: n.type,
    title: n.title,
    body: n.body,
    level: n.level ?? null,
    patternId: n.patternId ?? null,
    lat: n.lat ?? null,
    lng: n.lng ?? null,
    userId: n.userId ?? null,
    now: n.now ?? Date.now(),
  });
  return id;
}

/** Create (once) the authority alert for a pattern; `announce` also notifies officers and the local area. */
export function ensureAlert(p: PatternRow, now: number, announce = true): AlertRow {
  const existing = db.prepare('SELECT * FROM alerts WHERE pattern_id = ?').get(p.id) as AlertRow | undefined;
  if (existing) return existing;

  const level = alertLevel(p.confidence, p.status);
  const alert: AlertRow = {
    id: newId('AL'),
    pattern_id: p.id,
    level,
    status: 'open',
    title: 'Emerging Pattern Detected',
    body:
      `${categoryLabel(p.category, 'en')} signals from ${p.distinct_reporters} independent reporters across ` +
      `${Math.max(p.distinct_periods, p.distinct_days)} distinct time periods near ${p.area_label}.`,
    recommended_action: recommendedAction(p),
    created_at: now,
    updated_at: now,
    handled_by: null,
  };
  db.prepare(
    `INSERT INTO alerts(id, pattern_id, level, status, title, body, recommended_action, created_at, updated_at, handled_by)
     VALUES(@id, @pattern_id, @level, @status, @title, @body, @recommended_action, @created_at, @updated_at, @handled_by)`,
  ).run(alert);

  if (!announce) return alert;

  const grid = getSettings().privacy.publicGridDegrees;
  const pub = snapPoint(p.lat, p.lng, grid);
  pushNotification({
    audience: 'authority',
    type: 'emerging_pattern',
    title: 'Emerging pattern detected',
    body: `${categoryLabel(p.category, 'en')} near ${p.area_label} (confidence ${p.confidence}%).`,
    level,
    patternId: p.id,
    now,
  });
  pushNotification({
    audience: 'citizen',
    type: 'emerging_pattern',
    title: 'Emerging Pattern Nearby',
    body: `Multiple independent reports have been detected around ${p.area_label}.`,
    level,
    patternId: p.id,
    lat: pub.lat,
    lng: pub.lng,
    now,
  });
  return alert;
}

/** Keep an alert's level/recommendation in step with its pattern's latest evidence. */
export function syncAlert(p: PatternRow, now: number): void {
  db.prepare(
    `UPDATE alerts SET level = @level, recommended_action = @rec, updated_at = @now
     WHERE pattern_id = @id AND status <> 'resolved'`,
  ).run({ level: alertLevel(p.confidence, p.status), rec: recommendedAction(p), now, id: p.id });
}

export function setAlertStatus(patternId: string, status: AlertRow['status'], now: number, handledBy?: string | null) {
  db.prepare(
    `UPDATE alerts SET status = @status, updated_at = @now, handled_by = COALESCE(@by, handled_by),
       level = CASE WHEN @status = 'escalated' THEN 'high' ELSE level END
     WHERE pattern_id = @id`,
  ).run({ status, now, by: handledBy ?? null, id: patternId });
}
