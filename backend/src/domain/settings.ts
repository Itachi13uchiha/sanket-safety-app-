import { z } from 'zod';
import { db } from '../db/index.js';

const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const SettingsSchema = z.object({
  detection: z.object({
    windowDays: int(1, 60),
    radiusMeters: int(50, 1000),
    monitoringMinReporters: int(2, 20),
    monitoringMinConfidence: int(0, 100),
    emergingMinReporters: int(2, 50),
    emergingMinPeriods: int(1, 20),
    emergingMinConfidence: int(0, 100),
    autoResolveQuietDays: int(1, 90),
  }),
  antiGaming: z.object({
    maxReportsPerHour: int(1, 60),
    maxReportsPerDay: int(1, 200),
    duplicateWindowMinutes: int(1, 720),
    duplicateRadiusMeters: int(10, 1000),
    maxTravelKmh: int(20, 1000),
    burstWindowMinutes: int(1, 240),
    minTrust: z.number().min(0).max(1),
  }),
  privacy: z.object({
    minReportersForPublic: int(2, 20),
    minReportersForPublicSignal: int(2, 20),
    publicGridDegrees: z.number().min(0.001).max(0.05),
    retentionDays: int(30, 730),
  }),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const SettingsPatchSchema = SettingsSchema.deepPartial();

export const DEFAULT_SETTINGS: Settings = {
  detection: {
    windowDays: 14,
    radiusMeters: 250,
    monitoringMinReporters: 2,
    monitoringMinConfidence: 25,
    emergingMinReporters: 3,
    emergingMinPeriods: 2,
    emergingMinConfidence: 60,
    autoResolveQuietDays: 7,
  },
  antiGaming: {
    maxReportsPerHour: 5,
    maxReportsPerDay: 20,
    duplicateWindowMinutes: 30,
    duplicateRadiusMeters: 150,
    maxTravelKmh: 120,
    burstWindowMinutes: 20,
    minTrust: 0.2,
  },
  privacy: {
    minReportersForPublic: 3,
    minReportersForPublicSignal: 2,
    publicGridDegrees: 0.003,
    retentionDays: 180,
  },
};

type Json = Record<string, unknown>;
function merge<T extends Json>(base: T, patch: Json | undefined): T {
  const out: Json = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === undefined) continue;
    const cur = out[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object'
        ? merge(cur as Json, v as Json)
        : v;
  }
  return out as T;
}

let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'app'`).get() as { value: string } | undefined;
  const stored = row ? (JSON.parse(row.value) as Json) : undefined;
  const merged = SettingsSchema.safeParse(merge(DEFAULT_SETTINGS as unknown as Json, stored));
  cache = merged.success ? merged.data : DEFAULT_SETTINGS;
  return cache;
}

export function updateSettings(patch: z.infer<typeof SettingsPatchSchema>): { before: Settings; after: Settings } {
  const before = getSettings();
  const after = SettingsSchema.parse(merge(before as unknown as Json, patch as Json));
  if (after.detection.emergingMinReporters < after.detection.monitoringMinReporters) {
    throw new Error('emergingMinReporters must be ≥ monitoringMinReporters');
  }
  db.prepare(
    `INSERT INTO settings(key, value, updated_at) VALUES('app', @v, @t)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run({ v: JSON.stringify(after), t: Date.now() });
  cache = after;
  return { before, after };
}

export const resetSettingsCache = () => {
  cache = null;
};
