process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.BCRYPT_ROUNDS = '4';
process.env.DEV_EXPOSE_OTP = 'true';
process.env.JOBS_ENABLED = 'false';

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import type { Server } from 'node:http';

const { createApp } = await import('../src/app.js');
const { db } = await import('../src/db/index.js');
const { seedAreas, upsertStaff } = await import('../src/db/seedData.js');
const { submitReport } = await import('../src/domain/reports.js');
const { analyse } = await import('../src/domain/detection.js');
const { DEFAULT_SETTINGS } = await import('../src/domain/settings.js');
const { DAY, HOUR, MIN, startOfLocalDay } = await import('../src/lib/time.js');
const { config } = await import('../src/config.js');
type Evidence = import('../src/domain/detection.js').Evidence;

let server: Server;
let base = '';
const PW = 'Sanket-Test-2026';

async function api(method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* csv etc. */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function staffLogin(identifier: string, password = PW) {
  const a = await api('POST', '/v1/auth/login', { body: { identifier, password } });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  const b = await api('POST', '/v1/auth/verify-otp', { body: { challengeId: a.json.challengeId, otp: a.json.devOtp } });
  assert.equal(b.status, 200, JSON.stringify(b.json));
  return b.json.accessToken as string;
}

async function anonToken(n: string) {
  const r = await api('POST', '/v1/anon/session', { body: { deviceKey: `device-key-${n}`.padEnd(40, 'x') } });
  assert.equal(r.status, 201);
  return r.json.token as string;
}

const RAIL = { lat: 18.5289, lng: 73.8744 };
const now0 = Date.now();
const at = (daysAgo: number, hour: number, minute = 0) =>
  startOfLocalDay(now0, config.TIMEZONE_OFFSET_MINUTES) - daysAgo * DAY + hour * HOUR + minute * MIN;
const agedReporter = (id: string, ageMs = 10 * DAY) =>
  db.prepare('INSERT OR IGNORE INTO reporters(id, created_at) VALUES(?, ?)').run(id, Date.now() - ageMs);

before(async () => {
  seedAreas();
  await upsertStaff({ officialId: 'T-ADM', email: 'admin@test.local', name: 'Admin', role: 'admin', password: PW });
  await upsertStaff({ officialId: 'T-SUP', email: 'sup@test.local', name: 'Supervisor', role: 'supervisor', password: PW });
  await upsertStaff({ officialId: 'T-OFC', email: 'ofc@test.local', name: 'Officer One', role: 'officer', password: PW });
  await upsertStaff({ officialId: 'T-OFC2', email: 'ofc2@test.local', name: 'Officer Two', role: 'officer', password: PW });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

/* ───────────────────────── detection maths (pure) ───────────────────────── */
describe('detection scoring', () => {
  const ev = (over: Partial<Evidence>): Evidence => ({
    id: Math.random().toString(36), reporterId: 'r', lat: 18.5, lng: 73.8, occurredAt: at(2, 18), createdAt: at(2, 18),
    timeBucket: 'now', noteHash: null, reporterCreatedAt: now0 - 20 * DAY, behavior: 1, patternId: null, ...over,
  });

  test('independent reporters across periods and days → emerging', () => {
    const rows = [ev({ reporterId: 'a', occurredAt: at(3, 18), createdAt: at(3, 18) }),
      ev({ reporterId: 'b', occurredAt: at(2, 17, 20), createdAt: at(2, 17, 20) }),
      ev({ reporterId: 'c', occurredAt: at(1, 19), createdAt: at(1, 19) })];
    const a = analyse(rows, DEFAULT_SETTINGS, now0);
    assert.equal(a.level, 'emerging');
    assert.ok(a.confidence >= 60);
  });

  test('one reporter filing many times is one signal', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ev({ reporterId: 'same', occurredAt: at(3 - (i % 3), 18), createdAt: at(3 - (i % 3), 18, i) }));
    const a = analyse(rows, DEFAULT_SETTINGS, now0);
    assert.equal(a.distinctReporters, 1);
    assert.equal(a.level, 'none');
  });

  test('a burst from brand-new sessions never reaches emerging', () => {
    const t = at(0, 1);
    const rows = Array.from({ length: 10 }, (_, i) =>
      ev({ reporterId: `n${i}`, occurredAt: t, createdAt: t + i * MIN, reporterCreatedAt: t - 2 * MIN }));
    const a = analyse(rows, DEFAULT_SETTINGS, t + 20 * MIN);
    assert.notEqual(a.level, 'emerging');
    assert.ok(a.burstRatio > 0.9);
  });

  test('copy-pasted notes from different reporters lower integrity', () => {
    const hash = 'same-note-hash';
    const rows = ['a', 'b', 'c'].map((r, i) => ev({ reporterId: r, noteHash: hash, occurredAt: at(3 - i, 18), createdAt: at(3 - i, 18) }));
    const withDup = analyse(rows, DEFAULT_SETTINGS, now0);
    const clean = analyse(rows.map((r) => ({ ...r, noteHash: null })), DEFAULT_SETTINGS, now0);
    assert.ok(withDup.components.integrity < clean.components.integrity);
  });

  test('reporters with collapsed trust are ignored', () => {
    const rows = ['a', 'b', 'c'].map((r, i) => ev({ reporterId: r, behavior: 0.05, occurredAt: at(3 - i, 18), createdAt: at(3 - i, 18) }));
    assert.equal(analyse(rows, DEFAULT_SETTINGS, now0).distinctReporters, 0);
  });
});

/* ───────────────────────── citizen flow ───────────────────────── */
describe('citizen API', () => {
  test('meta is localised', async () => {
    const r = await api('GET', '/v1/meta?lang=hi');
    assert.equal(r.status, 200);
    assert.equal(r.json.categories.find((c: any) => c.id === 'harassment').label, 'उत्पीड़न');
  });

  test('anonymous session → report → duplicate → my reports', async () => {
    const token = await anonToken('citizen-1');
    const body = { category: 'catcalling', when: 'now', ...RAIL, locationSource: 'current', note: 'Call me on 9876543210 or a@b.com, MH12AB1234' };
    const a = await api('POST', '/v1/reports', { token, body });
    assert.equal(a.status, 201);
    assert.match(a.json.id, /^SP-[A-Z0-9]{6}$/);
    assert.equal(a.json.anonymous, true);
    assert.equal(a.json.location.label, 'Railway Station');

    const dup = await api('POST', '/v1/reports', { token, body });
    assert.equal(dup.status, 200);
    assert.equal(dup.json.duplicate, true);
    assert.equal(dup.json.id, a.json.id);

    const detail = await api('GET', `/v1/reports/mine/${a.json.id}`, { token });
    assert.equal(detail.status, 200);
    assert.ok(!/9876543210|a@b\.com|MH12AB1234/.test(detail.json.note), `PII leaked: ${detail.json.note}`);

    const list = await api('GET', '/v1/reports/mine', { token });
    assert.equal(list.json.counts.all, 1);
  });

  test('validation, missing location and auth errors use one error shape', async () => {
    const token = await anonToken('citizen-2');
    const bad = await api('POST', '/v1/reports', { token, body: { category: 'nope', when: 'now' } });
    assert.equal(bad.status, 422);
    assert.equal(bad.json.error.code, 'VALIDATION_ERROR');
    const noLoc = await api('POST', '/v1/reports', { token, body: { category: 'harassment', when: 'now' } });
    assert.equal(noLoc.status, 422);
    assert.equal(noLoc.json.error.code, 'LOCATION_REQUIRED');
    const manual = await api('POST', '/v1/reports', { token, body: { category: 'other', when: 'hour', areaId: 'market-area', locationSource: 'manual' } });
    assert.equal(manual.status, 201);
    const noAuth = await api('POST', '/v1/reports', { body: { category: 'other', when: 'now', ...RAIL } });
    assert.equal(noAuth.status, 401);
    assert.ok(noAuth.json.error.requestId);
  });

  test('per-reporter rate limit', async () => {
    const token = await anonToken('citizen-3');
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const r = await api('POST', '/v1/reports', { token, body: { category: 'other', when: 'now', lat: 18.4 + i * 0.05, lng: 73.7 + i * 0.001 } });
      last = r.status;
      if (r.status === 429) { assert.ok(r.headers.get('retry-after')); break; }
    }
    assert.equal(last, 429);
  });

  test('erasure removes the reporter and their reports', async () => {
    const token = await anonToken('citizen-erase');
    await api('POST', '/v1/reports', { token, body: { category: 'other', when: 'now', ...RAIL } });
    const del = await api('DELETE', '/v1/anon/me', { token });
    assert.equal(del.status, 200);
    assert.equal(del.json.reportsRemoved, 1);
    assert.equal((await api('GET', '/v1/reports/mine', { token })).status, 401);
  });
});

/* ───────────────────── pattern detection end-to-end ───────────────────── */
describe('pattern detection through the service layer', () => {
  const sim = (who: string, t: number, cat: any, where = RAIL, jitter = 0) =>
    submitReport({ reporterId: who, category: cat, lat: where.lat + jitter, lng: where.lng + jitter, locationSource: 'current', when: 'now' }, t);

  test('repeated independent evening reports become an emerging pattern with an alert', () => {
    const plan: [string, number][] = [
      ['e1', at(3, 18, 10)], ['e2', at(3, 19, 40)], ['e3', at(2, 17, 20)],
      ['e4', at(2, 21, 30)], ['e5', at(1, 18, 5)], ['e6', at(1, 19, 30)],
    ];
    plan.forEach(([who, t], i) => { agedReporter(who); sim(who, t, 'harassment', RAIL, (i % 3) * 0.0004); });
    const p = db.prepare(`SELECT * FROM patterns WHERE category='harassment' AND merged_into IS NULL`).get() as any;
    assert.ok(p, 'pattern created');
    assert.equal(p.status, 'emerging');
    assert.equal(p.distinct_reporters, 6);
    assert.ok(p.confidence >= 80, `confidence ${p.confidence}`);
    assert.equal(p.peak_start_hour, 18);
    assert.ok(db.prepare('SELECT 1 FROM alerts WHERE pattern_id = ?').get(p.id));
    assert.equal((db.prepare('SELECT COUNT(*) n FROM patterns WHERE category = ?').get('harassment') as any).n, 1, 'no duplicate patterns');
  });

  test('a burst of brand-new sessions in one hour is not promoted', () => {
    const t = at(0, 1);
    for (let i = 0; i < 6; i++) {
      db.prepare('INSERT OR IGNORE INTO reporters(id, created_at) VALUES(?, ?)').run(`burst${i}`, t - MIN);
      sim(`burst${i}`, t + i * MIN, 'loitering', { lat: 18.5116, lng: 73.8561 }, i * 0.00005);
    }
    const p = db.prepare(`SELECT * FROM patterns WHERE category='loitering'`).get() as any;
    assert.ok(!p || p.status === 'monitoring');
    assert.ok(!p || p.emerged_at == null);
  });

  test('the public sees aggregates only', async () => {
    const r = await api('GET', `/v1/patterns/nearby?lat=${RAIL.lat}&lng=${RAIL.lng}&radiusKm=3`);
    assert.equal(r.status, 200);
    assert.equal(r.json.patterns.length, 1, 'only the emerging pattern is public (burst is hidden)');
    const p = r.json.patterns[0];
    assert.equal(p.distinctReports, 6);
    assert.equal(p.category.id, 'harassment');
    assert.ok(!('reports' in p) && !JSON.stringify(p).includes('SP-'));
    assert.notEqual(p.location.lat, RAIL.lat, 'coordinates are grid-snapped');

    const detail = await api('GET', `/v1/patterns/${p.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.trend.length, 7);
    assert.match(detail.json.summary, /Repeated harassment signals/);

    const home = await api('GET', `/v1/home?lat=${RAIL.lat}&lng=${RAIL.lng}`);
    assert.equal(home.json.status.level, 'moderate');
    const alerts = await api('GET', `/v1/alerts?lat=${RAIL.lat}&lng=${RAIL.lng}`);
    assert.equal(alerts.json.notifications[0].title, 'Emerging Pattern Nearby');
    assert.equal((await api('GET', '/v1/patterns/PT-NOPE00')).status, 404);
  });
});

/* ───────────────────── authority: auth, RBAC, audit ───────────────────── */
describe('authority API', () => {
  test('sign-in needs password AND OTP; wrong OTP is rejected; unknown users get the same error', async () => {
    const bad = await api('POST', '/v1/auth/login', { body: { identifier: 'nobody@x.y', password: 'whatever123' } });
    const bad2 = await api('POST', '/v1/auth/login', { body: { identifier: 'T-OFC', password: 'wrong-password1' } });
    assert.equal(bad.status, 401);
    assert.deepEqual(bad.json.error.code, bad2.json.error.code);

    const a = await api('POST', '/v1/auth/login', { body: { identifier: 'ofc@test.local', password: PW } });
    assert.equal(a.status, 200);
    assert.match(a.json.destination, /^o\*+@test\.local$/);
    const wrong = await api('POST', '/v1/auth/verify-otp', { body: { challengeId: a.json.challengeId, otp: a.json.devOtp === '000000' ? '111111' : '000000' } });
    assert.equal(wrong.status, 401);
    const early = await api('POST', '/v1/auth/resend-otp', { body: { challengeId: a.json.challengeId } });
    assert.equal(early.status, 429);
    const ok = await api('POST', '/v1/auth/verify-otp', { body: { challengeId: a.json.challengeId, otp: a.json.devOtp } });
    assert.equal(ok.status, 200);
    const reuse = await api('POST', '/v1/auth/verify-otp', { body: { challengeId: a.json.challengeId, otp: a.json.devOtp } });
    assert.equal(reuse.status, 401, 'OTP is single-use');
  });

  test('account locks after repeated failures', async () => {
    let last: any;
    for (let i = 0; i < 5; i++) last = await api('POST', '/v1/auth/login', { body: { identifier: 'T-OFC2', password: 'wrong-password1' } });
    assert.equal(last.status, 401);
    const locked = await api('POST', '/v1/auth/login', { body: { identifier: 'T-OFC2', password: PW } });
    assert.equal(locked.status, 423);
    assert.ok(locked.headers.get('retry-after'));
  });

  test('citizen tokens cannot reach authority routes; missing token is 401', async () => {
    const citizen = await anonToken('citizen-x');
    assert.equal((await api('GET', '/v1/authority/dashboard', { token: citizen })).status, 401);
    assert.equal((await api('GET', '/v1/authority/dashboard')).status, 401);
  });

  test('RBAC matches the access-control matrix and denials are audited', async () => {
    const officer = await staffLogin('T-OFC');
    const supervisor = await staffLogin('T-SUP');
    const admin = await staffLogin('T-ADM');

    assert.equal((await api('GET', '/v1/authority/reports', { token: officer })).status, 200);
    assert.equal((await api('GET', '/v1/authority/audit-logs', { token: officer })).status, 403);
    assert.equal((await api('GET', '/v1/authority/users', { token: supervisor })).status, 403);
    assert.equal((await api('GET', '/v1/authority/audit-logs', { token: supervisor })).status, 200);
    assert.equal((await api('GET', '/v1/authority/users', { token: admin })).status, 200);

    const matrix = await api('GET', '/v1/authority/access/roles', { token: admin });
    assert.equal(matrix.json.matrix.officer['cases:manage'], false);
    assert.equal(matrix.json.matrix.supervisor['cases:manage'], true);
    assert.equal(matrix.json.matrix.supervisor['users:manage'], false);
    assert.equal(matrix.json.matrix.citizen['patterns:view'], true);

    const denied = await api('GET', '/v1/authority/audit-logs?result=denied', { token: supervisor });
    assert.ok(denied.json.logs.some((l: any) => l.actor.label === 'T-OFC' && l.action === 'access.denied'));
  });

  test('dashboard, reports table, report detail (audited), review feeds back into the pattern', async () => {
    const officer = await staffLogin('T-OFC');
    const dash = await api('GET', '/v1/authority/dashboard', { token: officer });
    assert.equal(dash.status, 200);
    assert.equal(dash.json.metrics.activeEmergingPatterns.value, 1);
    assert.ok(dash.json.metrics.reportsToday.value >= 0);
    assert.equal(dash.json.emergingPatterns[0].category.id, 'harassment');

    const hp = (db.prepare(`SELECT id FROM patterns WHERE category='harassment'`).get() as any).id;
    const list = await api('GET', `/v1/authority/reports?status=linked&patternId=${hp}&sort=time&pageSize=5`, { token: officer });
    assert.equal(list.status, 200);
    assert.ok(list.json.reports.length >= 1);
    assert.ok(!('note' in list.json.reports[0]));
    assert.equal((await api('GET', '/v1/authority/reports?sort=; DROP TABLE reports', { token: officer })).status, 422);
    assert.equal((await api('GET', "/v1/authority/reports?q=%25'%20OR%201=1--", { token: officer })).status, 200);

    const id = list.json.reports[0].id as string;
    const detail = await api('GET', `/v1/authority/reports/${id}`, { token: officer });
    assert.equal(detail.status, 200);
    assert.ok(!JSON.stringify(detail.json).includes('reporter_id'));

    const sup = await staffLogin('T-SUP');
    const audit = await api('GET', '/v1/authority/audit-logs?action=report.view', { token: sup });
    assert.ok(audit.json.logs.some((l: any) => l.resource === id && l.actor.label === 'T-OFC'));

    const before = (db.prepare(`SELECT distinct_reporters d FROM patterns WHERE category='harassment'`).get() as any).d;
    const rev = await api('POST', `/v1/authority/reports/${id}/review`, { token: officer, body: { decision: 'spam' } });
    assert.equal(rev.status, 200);
    assert.equal(rev.json.status, 'dismissed');
    const after = (db.prepare(`SELECT distinct_reporters d FROM patterns WHERE category='harassment'`).get() as any).d;
    assert.equal(after, before - 1, 'pattern re-scored without the spam report');
    assert.equal((await api('POST', `/v1/authority/reports/${id}/review`, { token: officer, body: { decision: 'confirm' } })).status, 409);
  });

  test('alert workflow: start monitoring → escalate → resolve, with citizen notification and audit trail', async () => {
    const officer = await staffLogin('T-OFC');
    const alerts = await api('GET', '/v1/authority/alerts', { token: officer });
    assert.equal(alerts.status, 200);
    const alert = alerts.json.alerts[0];
    assert.equal(alert.status, 'open');

    const mon = await api('POST', `/v1/authority/alerts/${alert.id}/action`, { token: officer, body: { action: 'start_monitoring' } });
    assert.equal(mon.status, 200);
    assert.equal(mon.json.pattern.status.code, 'monitoring');
    assert.equal(mon.json.alert.status, 'acknowledged');
    const pub = await api('GET', `/v1/alerts?lat=${RAIL.lat}&lng=${RAIL.lng}`);
    assert.ok(pub.json.notifications.some((n: any) => n.title === 'Monitoring Active'));

    const dupe = await api('POST', `/v1/authority/alerts/${alert.id}/action`, { token: officer, body: { action: 'start_monitoring' } });
    assert.equal(dupe.status, 409);

    const esc = await api('POST', `/v1/authority/alerts/${alert.id}/action`, { token: officer, body: { action: 'escalate', note: 'Requesting patrol support' } });
    assert.equal(esc.json.alert.level, 'high');
    assert.ok(esc.json.history.some((h: any) => h.type === 'status' && h.detail.to === 'escalated'));

    const sup = await staffLogin('T-SUP');
    const logs = await api('GET', '/v1/authority/audit-logs?action=alert.escalate', { token: sup });
    assert.equal(logs.json.logs[0].result, 'success');
  });

  test('cases: only supervisors manage; officers see only their assigned case', async () => {
    const officer = await staffLogin('T-OFC');
    const officer2 = await staffLogin('T-OFC2').catch(() => null);
    const sup = await staffLogin('T-SUP');
    const pid = (db.prepare(`SELECT id FROM patterns WHERE category='harassment'`).get() as any).id;
    const ofcId = (db.prepare(`SELECT id FROM users WHERE official_id='T-OFC'`).get() as any).id;

    assert.equal((await api('POST', '/v1/authority/cases', { token: officer, body: { patternId: pid } })).status, 403);
    const created = await api('POST', '/v1/authority/cases', { token: sup, body: { patternId: pid, assignedOfficerId: ofcId } });
    assert.equal(created.status, 201);
    assert.match(created.json.id, /^CS-\d{4}$/);
    assert.equal((await api('POST', '/v1/authority/cases', { token: sup, body: { patternId: pid } })).status, 409);

    const mine = await api('GET', '/v1/authority/cases', { token: officer });
    assert.equal(mine.json.cases.length, 1);
    const detail = await api('GET', `/v1/authority/cases/${created.json.id}`, { token: officer });
    assert.equal(detail.status, 200);
    assert.ok(detail.json.reports.length >= 1);
    assert.equal((await api('POST', `/v1/authority/cases/${created.json.id}/notes`, { token: officer, body: { body: 'Visited the site' } })).status, 201);
    assert.equal((await api('PATCH', `/v1/authority/cases/${created.json.id}`, { token: officer, body: { status: 'closed' } })).status, 403);
    assert.equal((await api('PATCH', `/v1/authority/cases/${created.json.id}`, { token: sup, body: { status: 'in_progress' } })).status, 200);
    if (officer2) assert.equal((await api('GET', `/v1/authority/cases/${created.json.id}`, { token: officer2 })).status, 404);
  });

  test('user administration guards: no self-change, last admin protected, sessions revoked on change', async () => {
    const admin = await staffLogin('T-ADM');
    const me = (db.prepare(`SELECT id FROM users WHERE official_id='T-ADM'`).get() as any).id;
    assert.equal((await api('PATCH', `/v1/authority/users/${me}`, { token: admin, body: { role: 'officer' } })).status, 403);

    const created = await api('POST', '/v1/authority/users', { token: admin, body: { officialId: 'T-NEW', name: 'New Officer', email: 'new@test.local', role: 'officer', password: 'Another-Pass-1' } });
    assert.equal(created.status, 201);
    assert.equal((await api('POST', '/v1/authority/users', { token: admin, body: { officialId: 'T-NEW', name: 'x y', email: 'new@test.local', role: 'officer', password: 'Another-Pass-1' } })).status, 409);
    assert.equal((await api('POST', '/v1/authority/users', { token: admin, body: { officialId: 'T-WEAK', name: 'Weak', email: 'weak@test.local', role: 'officer', password: 'short' } })).status, 422);

    const newToken = await staffLogin('T-NEW', 'Another-Pass-1');
    assert.equal((await api('GET', '/v1/auth/me', { token: newToken })).status, 200);
    const promoted = await api('PATCH', `/v1/authority/users/${created.json.id}`, { token: admin, body: { role: 'supervisor' } });
    assert.equal(promoted.status, 200);
    assert.equal((await api('GET', '/v1/auth/me', { token: newToken })).status, 401, 'old session revoked after role change');
  });

  test('logout revokes the session', async () => {
    const t = await staffLogin('T-SUP');
    assert.equal((await api('POST', '/v1/auth/logout', { token: t })).status, 204);
    assert.equal((await api('GET', '/v1/authority/dashboard', { token: t })).status, 401);
  });

  test('analytics, map, notifications, settings and CSV export', async () => {
    const sup = await staffLogin('T-SUP');
    const admin = await staffLogin('T-ADM');
    const an = await api('GET', '/v1/authority/analytics?range=7d', { token: sup });
    assert.equal(an.status, 200);
    assert.equal(an.json.reportsOverTime.length, 7);
    assert.equal(an.json.peakTimes.byTimeBlock.length, 8);
    const map = await api('GET', '/v1/authority/map?range=month&includeReports=true', { token: sup });
    assert.equal(map.status, 200);
    assert.ok(map.json.patterns.length >= 1);
    const notes = await api('GET', '/v1/authority/notifications', { token: sup });
    assert.ok(notes.json.unreadCount >= 1);
    assert.equal((await api('POST', '/v1/authority/notifications/read-all', { token: sup })).status, 200);
    assert.equal((await api('GET', '/v1/authority/notifications?unread=true', { token: sup })).json.unreadCount, 0);

    const csv = await api('GET', '/v1/authority/reports/export.csv', { token: sup });
    assert.equal(csv.status, 200);
    assert.match(csv.text, /^report_id,category/);
    assert.equal((await api('GET', '/v1/authority/settings', { token: sup })).status, 403);
    const upd = await api('PUT', '/v1/authority/settings', { token: admin, body: { detection: { emergingMinConfidence: 65 } } });
    assert.equal(upd.json.settings.detection.emergingMinConfidence, 65);
    assert.equal((await api('PUT', '/v1/authority/settings', { token: admin, body: { detection: { emergingMinReporters: 1 } } })).status, 422);
    await api('PUT', '/v1/authority/settings', { token: admin, body: { detection: { emergingMinConfidence: 60 } } });
    assert.equal((await api('POST', '/v1/authority/jobs/maintenance', { token: admin })).status, 200);
  });

  test('audit log is hash-chained and tampering is detected', async () => {
    const sup = await staffLogin('T-SUP');
    const ok = await api('GET', '/v1/authority/audit-logs/verify', { token: sup });
    assert.equal(ok.json.valid, true);
    assert.ok(ok.json.checked > 10);
    db.prepare(`UPDATE audit_logs SET result = 'success' WHERE seq = (SELECT MIN(seq) FROM audit_logs WHERE result = 'failed')`).run();
    const bad = await api('GET', '/v1/authority/audit-logs/verify', { token: sup });
    assert.equal(bad.json.valid, false);
    assert.ok(bad.json.brokenAtSeq > 0);
  });

  test('unknown routes and bad JSON return the standard error envelope', async () => {
    const nf = await api('GET', '/v1/nope');
    assert.equal(nf.status, 404);
    assert.equal(nf.json.error.code, 'NOT_FOUND');
    const res = await fetch(`${base}/v1/anon/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as any).error.code, 'INVALID_JSON');
  });
});
