const EARTH_RADIUS_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bounding box around a point; used as an index-friendly prefilter before haversine. */
export function bbox(lat: number, lng: number, radiusM: number) {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(0.01, Math.cos(rad(lat))));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

/** Snap a coordinate to the centre of a grid cell (public maps never expose exact points). */
export function snap(value: number, step: number): number {
  return Math.round((Math.floor(value / step) + 0.5) * step * 1e6) / 1e6;
}

export function snapPoint(lat: number, lng: number, step: number) {
  return { lat: snap(lat, step), lng: snap(lng, step) };
}

export function centroid(points: { lat: number; lng: number }[]) {
  if (!points.length) return { lat: 0, lng: 0 };
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

export function meanDistanceM(points: { lat: number; lng: number }[], c: { lat: number; lng: number }) {
  if (!points.length) return 0;
  let sum = 0;
  for (const p of points) sum += haversineM(p.lat, p.lng, c.lat, c.lng);
  return sum / points.length;
}
