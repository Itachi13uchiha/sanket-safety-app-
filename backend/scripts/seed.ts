/**
 * Usage:
 *   npm run seed              → areas + the admin account from .env
 *   npm run seed -- --demo    → also demo staff and ~10 days of realistic sample reports (development only)
 */
import { config } from '../src/config.js';
import { db } from '../src/db/index.js';
import { AREAS, seedAreas, seedSystemNotice, upsertStaff } from '../src/db/seedData.js';
import { submitReport } from '../src/domain/reports.js';
import type { Category } from '../src/lib/i18n.js';
import { DAY, HOUR, MIN, startOfLocalDay } from '../src/lib/time.js';

const demo = process.argv.includes('--demo');
if (demo && config.isProd) {
  console.error('Refusing to load demo data in production.');
  process.exit(1);
}

seedAreas();
seedSystemNotice();
const adminId = await upsertStaff({
  officialId: 'PN-ADM-0001',
  email: config.SEED_ADMIN_EMAIL,
  name: 'System Administrator',
  role: 'admin',
  password: config.SEED_ADMIN_PASSWORD,
});
console.log(`✔ Areas: ${AREAS.length}   ✔ Admin: ${config.SEED_ADMIN_EMAIL} (id ${adminId})`);

if (demo) {
  const pw = config.SEED_ADMIN_PASSWORD;
  await upsertStaff({ officialId: 'PN-SUP-0142', email: 'insp.mehta@police.gov.in', name: 'Insp. K. Mehta', role: 'supervisor', password: pw });
  await upsertStaff({ officialId: 'PN-OFC-0231', email: 'sgt.patil@police.gov.in', name: 'Sgt. R. Patil', role: 'officer', password: pw });
  await upsertStaff({ officialId: 'PN-OFC-0287', email: 'sgt.khan@police.gov.in', name: 'Sgt. A. Khan', role: 'officer', password: pw });
  await upsertStaff({ officialId: 'PN-OFC-0310', email: 'insp.joshi@police.gov.in', name: 'Insp. S. Joshi', role: 'officer', password: pw, status: 'inactive' });

  // Deterministic pseudo-random so the demo is reproducible.
  let seed = 42;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

  const now = Date.now();
  const off = config.TIMEZONE_OFFSET_MINUTES;
  const at = (daysAgo: number, hour: number, minute = 0) => startOfLocalDay(now, off) - daysAgo * DAY + hour * HOUR + minute * MIN;
  const reporters = new Map<number, number>();
  const reporter = (n: number) => {
    const id = `AN-demo-${String(n).padStart(3, '0')}`;
    if (!reporters.has(n)) {
      db.prepare('INSERT OR IGNORE INTO reporters(id, created_at) VALUES(?, ?)').run(id, now - 14 * DAY);
      reporters.set(n, 1);
    }
    return id;
  };

  type Sim = { t: number; who: number; area: (typeof AREAS)[number]['id']; cat: Category; note?: string; spot?: { lat: number; lng: number } };
  const sims: Sim[] = [];
  const area = (id: string) => AREAS.find((a) => a.id === id)!;
  const add = (daysAgo: number, hour: number, who: number, a: Sim['area'], cat: Category, note?: string) =>
    sims.push({ t: at(daysAgo, hour, Math.floor(rnd() * 50)), who, area: a, cat, note });

  // Railway Station – repeated evening harassment across days from many independent reporters → emerging
  [[5, 18, 1], [5, 19, 2], [4, 17, 3], [4, 20, 4], [3, 18, 5], [3, 19, 6], [2, 18, 7], [1, 19, 8]].forEach(([d, h, w]) =>
    add(d!, h!, w!, 'railway-station', 'harassment', w === 3 ? 'Group of men passing comments near the platform 2 exit' : undefined));
  // Central Bus Stand – late-evening suspicious activity → emerging
  [[4, 21, 9], [3, 22, 10], [2, 21, 11], [1, 22, 12], [1, 21, 13]].forEach(([d, h, w]) => add(d!, h!, w!, 'central-bus-stand', 'suspicious'));
  // College Road – following → emerging or monitoring
  [[3, 17, 14], [2, 18, 15], [2, 19, 16], [1, 17, 17]].forEach(([d, h, w]) => add(d!, h!, w!, 'college-road', 'following'));
  // Market Area – only two reporters → stays weak "monitoring"
  [[2, 12, 18], [1, 13, 19]].forEach(([d, h, w]) => add(d!, h!, w!, 'market-area', 'loitering'));
  // Park Area – three reports in one burst, one period → deliberately NOT an emerging pattern
  [[1, 16, 20], [1, 16, 21], [1, 16, 22]].forEach(([d, h, w]) => add(d!, h!, w!, 'park-area', 'unsafe-area', 'Poor lighting near the entrance'));
  // Background noise: scattered single reports across the city – must never form patterns.
  const noiseCats: Category[] = ['catcalling', 'loitering', 'unsafe-area', 'other'];
  for (let i = 0; i < 12; i++) {
    sims.push({
      t: at(1 + Math.floor(rnd() * 8), 9 + Math.floor(rnd() * 12), Math.floor(rnd() * 50)),
      who: 30 + i,
      area: 'park-area',
      cat: noiseCats[i % noiseCats.length]!,
      spot: { lat: 18.46 + rnd() * 0.12, lng: 73.78 + rnd() * 0.14 },
    });
  }

  sims.sort((a, b) => a.t - b.t);
  let ok = 0;
  for (const s of sims) {
    if (s.t > now) continue;
    const a = area(s.area);
    const r = submitReport(
      {
        reporterId: reporter(s.who),
        category: s.cat,
        lat: s.spot ? s.spot.lat : a.lat + (rnd() - 0.5) * 0.0012,
        lng: s.spot ? s.spot.lng : a.lng + (rnd() - 0.5) * 0.0012,
        locationSource: 'current',
        when: 'now',
        note: s.note,
      },
      s.t,
    );
    if (!r.duplicate) ok++;
  }
  const p = db.prepare(`SELECT status, COUNT(*) AS n FROM patterns WHERE merged_into IS NULL GROUP BY status`).all();
  console.log(`✔ Demo reports: ${ok}   Patterns:`, p);
  console.log(`\nDemo sign-ins (password for all: ${pw}):`);
  console.log('  admin       PN-ADM-0001  /', config.SEED_ADMIN_EMAIL);
  console.log('  supervisor  PN-SUP-0142  / insp.mehta@police.gov.in');
  console.log('  officer     PN-OFC-0231  / sgt.patil@police.gov.in');
  console.log('  (OTP is printed in this server console when DEV_EXPOSE_OTP=true)');
}
