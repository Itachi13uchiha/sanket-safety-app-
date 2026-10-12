# Sanket Backend (API)

> This is the API half of the Sanket app. For the full app (web UI + API) start from the **README.md one folder up**.

API for **Sanket – Small Signals. Safer Spaces.** Anonymous micro-reporting for citizens, pattern detection
that resists gaming, and a role-based portal for authorities.

Stack: Node.js · TypeScript · Express 5 · SQLite (better-sqlite3, zero setup) · zod · JWT · bcrypt.

---

## 1. Run it in VS Code (5 minutes)

**Prerequisites**
- [Node.js 22 LTS](https://nodejs.org) (20.12+ works). Check with `node -v`.
- VS Code.

**Steps**

1. Unzip, then in VS Code: **File → Open Folder…** → choose the `sanket-backend` folder.
   When VS Code offers *"Install recommended extensions?"*, click **Install** (REST Client + SQLite Viewer).
2. Open the terminal: **Ctrl + `** (backtick).
3. Install packages:
   ```bash
   npm install
   ```
4. Create your environment file:
   ```bash
   # macOS / Linux / Git Bash
   cp .env.example .env
   # Windows PowerShell
   Copy-Item .env.example .env
   # Windows cmd
   copy .env.example .env
   ```
   The defaults work as-is for local development (leave `JWT_SECRET` and `PEPPER` empty).
5. Load the demo data (areas, staff accounts and ~10 days of sample reports):
   ```bash
   npm run seed -- --demo
   ```
6. Start the API with auto-reload:
   ```bash
   npm run dev
   ```
   Open <http://localhost:4000/health> → `{"status":"ok"}`.

**Try it**
- Open `api.http`, click **Send Request** above each block, top to bottom
  (session → report → login → OTP → dashboard).
- The **OTP** for authority login is returned in the login response as `devOtp` *and* printed in the terminal
  (development only).
- Demo sign-ins (password `ChangeMe-Now-2026`):

  | Role | Official ID | E-mail |
  |---|---|---|
  | Admin | `PN-ADM-0001` | admin@sanket.local |
  | Supervisor | `PN-SUP-0142` | insp.mehta@police.gov.in |
  | Officer | `PN-OFC-0231` | sgt.patil@police.gov.in |

- Look inside the database: click `data/sanket.db` in the Explorer (SQLite Viewer).

**Other commands**

| Command | What it does |
|---|---|
| `npm test` | 25 end-to-end + unit tests (in-memory DB, nothing touches your data) |
| `npm run typecheck` | TypeScript check |
| `npm run build` → `npm start` | Compile to `dist/` and run the production build |
| **F5** in VS Code | Debug the API with breakpoints ("Debug API (tsx)") |

**Reset the demo data:** stop the server, delete `data/sanket.db*`, run the seed again.

**Windows note:** `better-sqlite3` ships prebuilt binaries for current Node LTS releases. If `npm install`
tries to compile and fails, switch to Node 22 LTS.

---

## 2. Connect your React/Vite frontend

In the frontend's `vite.config.ts` proxy API calls so there is no CORS friction:

```ts
export default defineConfig({
  server: { proxy: { '/v1': 'http://localhost:4000' } },
});
```

Then call `fetch('/v1/...')`. (Direct calls also work: CORS allows `http://localhost:5173` by default;
change `CORS_ORIGINS` in `.env` for other origins.)

**Client contract in one paragraph.** Citizens generate a random `deviceKey` once, keep it in local storage,
call `POST /v1/anon/session`, and send the returned token as `Authorization: Bearer …`. Authorities sign in
with two calls (`/auth/login` → `/auth/verify-otp`). Every error looks like
`{ "error": { "code", "message", "details?", "requestId" } }` – map `code` to your empty / error /
offline / permission-denied states. Add `?lang=hi|mr` (or `Accept-Language`) for localized labels.

### Screen → endpoint map

| UI screen | Endpoint |
|---|---|
| Location denied → "enter manually" | `GET /v1/areas`, then `POST /v1/reports` with `areaId` |
| Home | `GET /v1/home?lat&lng` |
| Report incident (categories, time options) | `GET /v1/meta`, `POST /v1/reports` |
| Report submitted | response of `POST /v1/reports` |
| Safety map / hotspots | `GET /v1/map?lat&lng&range=today\|week\|month&category=` |
| Nearby alerts (patterns, notifications, system) | `GET /v1/alerts?lat&lng` |
| Pattern details | `GET /v1/patterns/:id` |
| My reports / report details | `GET /v1/reports/mine`, `GET /v1/reports/mine/:id` |
| Privacy & data / delete my data | `GET /v1/privacy`, `DELETE /v1/anon/me` |
| Authority login + OTP + resend | `POST /v1/auth/login`, `/verify-otp`, `/resend-otp` |
| Forgot password | `POST /v1/auth/forgot-password`, `/reset-password` |
| Dashboard | `GET /v1/authority/dashboard` |
| Live pattern map | `GET /v1/authority/map` |
| Emerging patterns / pattern details | `GET /v1/authority/patterns`, `/patterns/:id`, `POST /patterns/:id/status` |
| Alerts (Start monitoring / Escalate / Resolve) | `GET /v1/authority/alerts`, `/alerts/:id`, `POST /alerts/:id/action` |
| Report management | `GET /v1/authority/reports`, `/reports/:id`, `POST /reports/:id/review`, `/reports/export.csv` |
| Case management | `GET/POST /v1/authority/cases`, `GET/PATCH /cases/:id`, `/cases/:id/notes`, `/reports`, `/attachments` |
| Analytics | `GET /v1/authority/analytics?range=7d\|30d\|90d` |
| Access control (RBAC matrix, users) | `GET /v1/authority/access/roles`, `GET/POST /users`, `PATCH /users/:id` |
| Audit logs | `GET /v1/authority/audit-logs`, `/audit-logs/verify` |
| Notifications | `GET /v1/authority/notifications`, `POST /notifications/:id/read`, `/read-all` |
| Settings (detection thresholds) | `GET/PUT /v1/authority/settings` |

Deliberately **not** in the API: citizen sign-up/OTP/biometrics (reporting is anonymous by design),
SOS/emergency dispatch (the app should dial **112**; `GET /v1/meta` returns the number), and dark mode /
language preference storage (client-side).

---

## 3. How pattern detection works

A pattern is **repeated, independent, geographically coherent evidence** – not a report count. After each
report the engine collects same-category reports within `radiusMeters` (default 250 m) over `windowDays`
(default 14) and scores four signals:

| Signal | Weight | Meaning |
|---|---|---|
| Reporters | 40 % | Distinct, trust-weighted reporters. One reporter counts once, however often they file. |
| Temporal | 30 % | Distinct 3-hour periods and days. A recurrence beats one incident seen by many people. |
| Spatial | 20 % | How tightly reports cluster around a common centre. |
| Integrity | 10 % | Penalties for bursts of near-simultaneous filings, copy-pasted notes, brand-new sessions. |

Status ladder: **monitoring** (≥2 reporters, confidence ≥25) → **emerging** (≥3 reporters, recurrence across
periods or days, confidence ≥60; creates an alert) → **escalated / resolved** by officers only. Quiet patterns
close automatically after 7 days. All thresholds are editable at runtime via `PUT /v1/authority/settings`.

**Anti-gaming, concretely**
- Anonymous identity = keyed hash of a device key. New sessions carry 60 % weight, rising to 100 % over 72 h,
  so mass-created sessions add little.
- Officer moderation feeds back: *dismiss* / *spam* lowers that reporter's future weight; *confirm* raises it.
- Per-reporter limits (5/hour, 20/day), near-duplicate suppression, implausible-travel flagging,
  Idempotency-Key support for safe retries.
- Notes are scrubbed of phone numbers, e-mails, ID numbers and vehicle plates.

**Privacy by design**
- No name, phone, e-mail or IP is stored with reports; access logs never include IPs, queries or bodies.
- The public API returns aggregates only: grid-snapped coordinates, counts of independent reporters, and only
  for patterns backed by ≥3 reporters (k-anonymity). No individual reports, notes or exact points.
- Right to erasure (`DELETE /v1/anon/me`) removes the reports and re-scores the patterns they supported.
- Retention: reports older than 180 days (configurable) are purged unless attached to a case.

**Security**
- RBAC matches the Access Control screen exactly (`src/domain/permissions.ts` is the single source of truth);
  denials are audited. Officers see only cases assigned to them.
- Two-step staff sign-in (password + single-use OTP), lockout after 5 failures, revocable server-side sessions,
  role/status changes revoke live sessions, last-admin and self-modification guards.
- Audit log is append-only and **hash-chained**; `GET /audit-logs/verify` detects edits or deletions.
- helmet, CORS allow-list, body size limit, rate limits, parameterized SQL only, sort columns whitelisted,
  CSV export neutralises spreadsheet-formula injection.

---

## 4. Deploying for real

### Recommended deployment for the current SQLite implementation (Render)

The current application uses `better-sqlite3`; it does **not** use the `DATABASE_URL` shown in older example environment files. Do not point this code at a PostgreSQL URL without migrating the database layer.

A Render blueprint is included at the repository root in `render.yaml`. It deploys the backend with a persistent disk mounted at `/var/data`, stores SQLite at `/var/data/sanket.db`, seeds the built-in demo areas/staff/reports once, and exposes `/health` as the health check. Persistent disks require a paid Render web-service plan and support a single backend instance for this SQLite setup.

1. In Render, choose **New → Blueprint**, connect this GitHub repository, and apply `render.yaml`.
2. Wait for the service to deploy and confirm its `/health` endpoint returns `{"status":"ok"}`.
3. Copy the Render service URL (for example, `https://sanket-backend.onrender.com`).
4. In the Vercel **frontend** project's environment variables, set `VITE_API_URL` to that Render URL (no trailing slash), then redeploy the frontend.
5. In the Render service environment, ensure `CORS_ORIGINS` includes the exact origin of the deployed frontend. Keep `JWT_SECRET`, `PEPPER`, and `SEED_ADMIN_PASSWORD` secret and do not rotate `PEPPER` after real anonymous identities have been created.

The blueprint enables the demo seed explicitly for initial setup. The seed script uses a marker in the persistent database so subsequent deploys/restarts do not duplicate demo reports. If the database already contains real data, back it up before changing deployment or seeding.

### Vercel limitation

The Vercel `/tmp` SQLite file is temporary and can differ between serverless instances. It is not a persistent production database. The current synchronous SQLite code therefore needs a persistent-volume host such as the Render blueprint above, or a deliberate database-layer migration to a serverless-compatible managed database. Do not expect records from a local `data/sanket.db` file to appear on a newly deployed service automatically; importing that file is a separate recovery step.

1. Set `NODE_ENV=production`, and **strong `JWT_SECRET` and `PEPPER`** (the server refuses to start without them).
   Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
   Never change `PEPPER` afterwards – it would orphan every anonymous identity.
2. Put it behind HTTPS (nginx / a platform load balancer) and set `TRUST_PROXY=1`.
3. `DEV_EXPOSE_OTP` must be off (enforced). Wire real delivery once at boot:
   ```ts
   import { setTransport } from './lib/notifier.js';
   setTransport(async ({ to, subject, text }) => { /* SMTP / SMS / e-mail API */ });
   ```
4. Persist and back up `DATABASE_PATH` (SQLite WAL mode). One API instance per database file is the supported
   setup; for horizontal scaling move to PostgreSQL + PostGIS (queries are isolated in `src/domain/*`).
5. Attachments: the API stores metadata + SHA-256 only; put file bytes in object storage and save the key.
6. Replace the seeded Pune areas (`src/db/seedData.ts`) with your city's real zones.

## 5. Project layout

```
src/
  config.ts            env validation (fails fast, blocks insecure production config)
  app.ts / server.ts   Express app, graceful shutdown, hourly maintenance job
  db/                  schema + migrations, row types, seed data
  domain/              detection engine, trust, alerts, reports, audit chain, permissions, settings
  middleware/          auth (anon + staff JWT), RBAC, rate limits, error envelope
  routes/              public, reports, auth, authority/*
  lib/                 geo, time, security, i18n (en/hi/mr), errors, logger, notifier
scripts/seed.ts        areas, admin and optional demo data
test/e2e.test.ts       25 tests: scoring maths, anti-gaming, privacy, RBAC, audit, cases
api.http               ready-to-run requests for the REST Client extension
```
