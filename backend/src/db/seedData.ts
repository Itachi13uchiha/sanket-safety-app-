import { db } from './index.js';
import { hashPassword } from '../domain/passwords.js';
import { pushNotification } from '../domain/alerts.js';
import { newId } from '../lib/security.js';

/** Illustrative monitored areas (Pune). Replace with your city's real zones. */
export const AREAS = [
  { id: 'central-bus-stand', name: 'Central Bus Stand', city: 'Pune', lat: 18.5018, lng: 73.8636 },
  { id: 'market-area', name: 'Market Area', city: 'Pune', lat: 18.5116, lng: 73.8561 },
  { id: 'college-road', name: 'College Road', city: 'Pune', lat: 18.5236, lng: 73.8415 },
  { id: 'railway-station', name: 'Railway Station', city: 'Pune', lat: 18.5289, lng: 73.8744 },
  { id: 'station-road', name: 'Station Road', city: 'Pune', lat: 18.5345, lng: 73.8801 },
  { id: 'park-area', name: 'Park Area', city: 'Pune', lat: 18.5085, lng: 73.849 },
] as const;

export function seedAreas() {
  const stmt = db.prepare('INSERT OR IGNORE INTO areas(id, name, city, lat, lng, radius_m) VALUES(?,?,?,?,?,500)');
  for (const a of AREAS) stmt.run(a.id, a.name, a.city, a.lat, a.lng);
}

export interface StaffSeed {
  officialId: string;
  email: string;
  name: string;
  role: 'officer' | 'supervisor' | 'admin';
  password: string;
  status?: 'active' | 'inactive';
}

/** Create the user if missing (never overwrites an existing password). Returns its id. */
export async function upsertStaff(u: StaffSeed): Promise<string> {
  const existing = db.prepare('SELECT id FROM users WHERE lower(email) = ? OR lower(official_id) = ?')
    .get(u.email.toLowerCase(), u.officialId.toLowerCase()) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = newId('US', 8);
  const now = Date.now();
  db.prepare(
    `INSERT INTO users(id, official_id, email, name, password_hash, role, status, created_at, updated_at)
     VALUES(?,?,?,?,?,?,?,?,?)`,
  ).run(id, u.officialId, u.email.toLowerCase(), u.name, await hashPassword(u.password), u.role, u.status ?? 'active', now, now);
  return id;
}

export function seedSystemNotice() {
  const has = db.prepare(`SELECT 1 FROM notifications WHERE audience = 'system' AND type = 'system_update'`).get();
  if (!has) {
    pushNotification({
      audience: 'system', type: 'system_update', title: "You're up to date",
      body: 'Sanket v1.0.0 – Small Signals. Safer Spaces.',
    });
  }
}
