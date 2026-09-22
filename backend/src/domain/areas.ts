import { db } from '../db/index.js';
import type { AreaRow } from '../db/types.js';
import { haversineM } from '../lib/geo.js';

export function activeAreas(): AreaRow[] {
  return db.prepare('SELECT * FROM areas WHERE active = 1 ORDER BY name').all() as AreaRow[];
}

/**
 * Resolve a coordinate to a monitored area. The label is what the public sees, so when no area
 * matches we fall back to a coarse (~1 km) description instead of exact coordinates.
 */
export function describeLocation(lat: number, lng: number): { areaId: string | null; label: string } {
  let best: { area: AreaRow; d: number } | null = null;
  for (const a of activeAreas()) {
    const d = haversineM(lat, lng, a.lat, a.lng);
    if (d <= a.radius_m * 2 && (!best || d < best.d)) best = { area: a, d };
  }
  if (best) return { areaId: best.area.id, label: best.area.name };
  return { areaId: null, label: `Near ${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E` };
}
