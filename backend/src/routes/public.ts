import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import type { AreaRow } from '../db/types.js';
import { activeAreas } from '../domain/areas.js';
import { getSettings } from '../domain/settings.js';
import { publicPattern, rangeStart, signalsNear, trendFor, visiblePatterns, publicPatternSummary, type Range } from '../domain/views.js';
import { eraseReports } from '../domain/reports.js';
import { Errors } from '../lib/errors.js';
import { bbox, haversineM } from '../lib/geo.js';
import { iso, param, parse } from '../lib/http.js';
import {
  CATEGORIES, allCategoryLabels, allStatusLabels, allTimeLabels, areaLevelLabel, getLang, tipText,
  type AreaLevel,
} from '../lib/i18n.js';
import { hmac, sha256 } from '../lib/security.js';
import { requireAnon, signAnonToken } from '../middleware/auth.js';
import { sessionLimiter } from '../middleware/core.js';
import { DAY } from '../lib/time.js';

export const publicRouter = Router();

const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);
const geo = z.object({ lat, lng, radiusKm: z.coerce.number().min(0.1).max(50).default(5) });
const category = z.enum(CATEGORIES);

/** Everything the client needs to render forms and labels in the chosen language. */
publicRouter.get('/meta', (req, res) => {
  const lang = getLang(req);
  res.json({
    language: lang,
    supportedLanguages: ['en', 'hi', 'mr'],
    categories: allCategoryLabels(lang),
    timeOptions: allTimeLabels(lang),
    patternStatuses: allStatusLabels(lang),
    locationSources: ['current', 'map', 'manual'],
    limits: { noteMaxLength: 200 },
    emergencyNumber: '112',
  });
});

/** Monitored areas – powers "enter location manually" when GPS is unavailable or denied. */
publicRouter.get('/areas', (_req, res) => {
  res.json({
    areas: activeAreas().map((a) => ({ id: a.id, name: a.name, city: a.city, lat: a.lat, lng: a.lng })),
  });
});

/**
 * Start an anonymous session. The client keeps a random device key locally and sends it once;
 * the server stores only a keyed hash of it. No name, phone, e-mail or IP is stored.
 */
publicRouter.post('/anon/session', sessionLimiter, (req, res) => {
  const { deviceKey } = parse(z.object({ deviceKey: z.string().min(32).max(256) }), req.body);
  const reporterId = `AN-${hmac(`device:${deviceKey}`).slice(0, 32)}`;
  db.prepare('INSERT OR IGNORE INTO reporters(id, created_at) VALUES(?, ?)').run(reporterId, Date.now());
  const { token, expiresInSeconds } = signAnonToken(reporterId);
  res.status(201).json({ token, tokenType: 'Bearer', expiresInSeconds, anonymous: true });
});

/** "Delete my data": removes every report from this anonymous identity and the identity itself. */
publicRouter.delete('/anon/me', requireAnon, (req, res) => {
  const removed = eraseReports(req.anon!.reporterId, { everything: true });
  res.json({ deleted: true, reportsRemoved: removed });
});

/** Home dashboard: area status, nearby patterns, recent community signals, a safety tip. */
publicRouter.get('/home', (req, res) => {
  const lang = getLang(req);
  const q = parse(geo, req.query);
  const now = Date.now();
  const nearbyKm = Math.min(q.radiusKm, 2);

  const patterns = visiblePatterns({ lat: q.lat, lng: q.lng, radiusKm: q.radiusKm, limit: 3 });
  const close = visiblePatterns({ lat: q.lat, lng: q.lng, radiusKm: nearbyKm });
  const signals = signalsNear(q.lat, q.lng, q.radiusKm, now - 7 * DAY, lang, undefined, now);
  const closeSignals = signals.filter((s) => s.distanceKm <= nearbyKm);

  let level: AreaLevel = 'calm';
  if (close.some((p) => p.status === 'escalated') || close.filter((p) => p.status === 'emerging').length >= 2) level = 'elevated';
  else if (close.length || closeSignals.length) level = 'moderate';

  const areas = activeAreas();
  let nearest: AreaRow | null = null;
  let best = Infinity;
  for (const a of areas) {
    const d = haversineM(q.lat, q.lng, a.lat, a.lng);
    if (d < best) { best = d; nearest = a; }
  }
  const tipIndex = Math.floor(now / DAY) % 4;

  res.json({
    area: nearest && best <= nearest.radius_m * 4 ? { id: nearest.id, name: nearest.name, city: nearest.city } : null,
    status: { level, label: areaLevelLabel(level, lang), nearbyPatterns: close.length, nearbySignals: closeSignals.length },
    nearbyPatterns: patterns.map((p) => publicPattern(p, lang, q)),
    recentSignals: signals.slice(0, 5),
    tip: tipText(tipIndex, lang),
    generatedAt: iso(now),
  });
});

/** Safety map: emerging patterns plus aggregated (grid-snapped, k-anonymous) signals. */
publicRouter.get('/map', (req, res) => {
  const lang = getLang(req);
  const q = parse(
    geo.extend({ range: z.enum(['today', 'week', 'month']).default('week'), category: category.optional() }),
    req.query,
  );
  const now = Date.now();
  const since = rangeStart(q.range as Range, now);
  const patterns = visiblePatterns({ lat: q.lat, lng: q.lng, radiusKm: q.radiusKm, category: q.category });
  res.json({
    center: { lat: q.lat, lng: q.lng },
    radiusKm: q.radiusKm,
    range: q.range,
    patterns: patterns.filter((p) => p.last_report_at >= since).map((p) => publicPattern(p, lang, q)),
    signals: signalsNear(q.lat, q.lng, q.radiusKm, since, lang, q.category, now),
    legend: { low: 'Repeated Reports', medium: 'Increased Activity', high: 'Emerging Pattern' },
  });
});

publicRouter.get('/patterns/nearby', (req, res) => {
  const lang = getLang(req);
  const q = parse(geo.extend({ category: category.optional() }), req.query);
  const list = visiblePatterns({ lat: q.lat, lng: q.lng, radiusKm: q.radiusKm, category: q.category });
  res.json({
    patterns: list
      .map((p) => publicPattern(p, lang, q))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)),
  });
});

/** Pattern detail: counts and time windows only – never individual reports or precise points. */
publicRouter.get('/patterns/:id', (req, res) => {
  const lang = getLang(req);
  const id = param(req, 'id');
  const found = visiblePatterns().find((p) => p.id === id);
  if (!found) throw Errors.notFound('Pattern');
  res.json({
    ...publicPattern(found, lang),
    summary: publicPatternSummary(found),
    trend: trendFor(found.id),
    note: 'Patterns are built from independent, repeated signals – not from the number of reports alone.',
  });
});

/** Alerts screen: nearby patterns, area notifications and system updates. */
publicRouter.get('/alerts', (req, res) => {
  const lang = getLang(req);
  const q = parse(
    z.object({ lat: lat.optional(), lng: lng.optional(), radiusKm: z.coerce.number().min(0.1).max(50).default(10) })
      .refine((v) => (v.lat == null) === (v.lng == null), { message: 'lat and lng must be provided together' }),
    req.query,
  );
  const located = q.lat != null && q.lng != null;
  const patterns = located ? visiblePatterns({ lat: q.lat, lng: q.lng, radiusKm: q.radiusKm }) : [];

  let notifications: Record<string, unknown>[] = [];
  if (located) {
    const b = bbox(q.lat!, q.lng!, q.radiusKm * 1000);
    notifications = (db
      .prepare(
        `SELECT id, type, title, body, level, pattern_id, lat, lng, created_at FROM notifications
         WHERE audience = 'citizen' AND created_at > ? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
         ORDER BY created_at DESC LIMIT 30`,
      )
      .all(Date.now() - 30 * DAY, b.minLat, b.maxLat, b.minLng, b.maxLng) as Array<{
        id: string; type: string; title: string; body: string; level: string | null; pattern_id: string | null;
        lat: number; lng: number; created_at: number;
      }>)
      .filter((n) => haversineM(q.lat!, q.lng!, n.lat, n.lng) <= q.radiusKm * 1000)
      .map((n) => ({
        id: n.id, type: n.type, title: n.title, body: n.body, level: n.level, patternId: n.pattern_id,
        createdAt: iso(n.created_at),
      }));
  }
  const system = (db
    .prepare(`SELECT id, type, title, body, created_at FROM notifications WHERE audience = 'system' ORDER BY created_at DESC LIMIT 10`)
    .all() as Array<{ id: string; type: string; title: string; body: string; created_at: number }>)
    .map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, createdAt: iso(n.created_at) }));

  res.json({
    nearbyPatterns: patterns.map((p) => publicPattern(p, lang, located ? { lat: q.lat!, lng: q.lng! } : undefined)),
    notifications,
    system,
  });
});

/** Machine-readable privacy facts for the Privacy & Data screen. */
publicRouter.get('/privacy', (_req, res) => {
  const s = getSettings();
  res.json({
    anonymousReporting: true,
    stores: ['category', 'approximate time', 'location the reporter chose to share', 'optional short note (contact details are stripped)'],
    neverStores: ['name', 'phone number', 'e-mail', 'IP address', 'device identifiers in readable form'],
    publicViewShows: ['aggregated patterns', 'grid-snapped locations', 'counts of independent reporters'],
    publicViewNeverShows: ['individual reports', 'exact coordinates', 'notes'],
    minimumReportersBeforePublic: s.privacy.minReportersForPublic,
    retentionDays: s.privacy.retentionDays,
    deletion: { endpoint: 'DELETE /v1/anon/me', description: 'Deletes all reports linked to this device session.' },
    generatedAt: iso(Date.now()),
    hash: sha256(JSON.stringify([s.privacy.minReportersForPublic, s.privacy.retentionDays])).slice(0, 12),
  });
});

