# Sanket – Small Signals. Safer Spaces.

One folder, one command: the **web app** (React + Vite + Tailwind) already connected to the **API**
(Node + Express + SQLite). Citizens report anonymously; the system detects *patterns* (not just volume);
authorities work in a role-based portal.

```
sanket/
├─ frontend/   React app  → http://localhost:5173   (citizen phone UI + authority portal)
├─ backend/    REST API   → http://localhost:4000   (SQLite database, no setup needed)
└─ package.json            root scripts that run both together
```

---

## 1. Run it in VS Code

**You need:** [Node.js 22 LTS](https://nodejs.org) (check with `node -v`; 20.19+ also works) and VS Code.

1. Unzip, then **File → Open Folder…** → select the `sanket` folder.
   Click **Install** if VS Code offers the recommended extensions.
2. Open the terminal: **Ctrl + `** and run these three commands, one at a time:

   ```bash
   npm run setup      # installs everything + creates backend/.env   (≈1–2 min, once)
   npm run seed       # loads demo areas, staff accounts and ~10 days of sample reports
   npm run dev        # starts the API (blue) and the web app (green) together
   ```
3. Open **<http://localhost:5173>**. That's the app. Stop it with **Ctrl + C**.

> **Alternative:** press **Ctrl+Shift+B** in VS Code to run the "Run Sanket (API + Web)" task.

### What to try (2-minute tour)

**Citizen app** (phone-shaped screen):
1. Let the splash finish → **Skip** → **Enter Location Manually** → **Railway Station**.
   *(The demo data is in Pune. If you tap "Allow Location" from another city you'll see a calm map.)*
2. Home shows the live area status, nearby patterns and signals. Tap **Report a Safety Concern** → choose
   *Harassment* → *Use Current Location* → *Just Now* → **Submit Anonymously**.
3. **Profile → My Reports** lists it. **Nearby** shows the map; tap a cluster → **View Pattern**.
4. **Profile → हिंदी** switches incident types and statuses to Hindi (or Marathi).

**Authority portal** – tap **Authority Portal** (top right):

| Role | Sign-in | Password | Can do |
|---|---|---|---|
| Supervisor | `PN-SUP-0142` | `ChangeMe-Now-2026` | alerts, reports, cases, audit logs, export |
| Officer | `PN-OFC-0231` | `ChangeMe-Now-2026` | view reports/patterns, escalate alerts, own cases |
| Admin | `PN-ADM-0001` | `ChangeMe-Now-2026` | everything + users & permissions, settings |

After the password you get a 6-digit OTP. In development the screen shows it with an **Autofill** button
(and the API terminal prints it). Then try: **Alerts → Start Monitoring / Escalate**, **Reports → Confirm /
Dismiss**, **Create a case**, **Audit Logs → Verify Integrity**, and (as admin) **Users & Access**.

---

## 2. Run it as a single server (production-style)

```bash
npm run start:prod
```
Builds the frontend and backend, then serves **everything from <http://localhost:4000>** (the API also serves
the built web app). Useful for demos and for hosting on a single machine.

## 3. Commands

| Command | What it does |
|---|---|
| `npm run setup` | Install all packages, create `backend/.env` |
| `npm run seed` | Load demo data (delete `backend/data/sanket.db*` first to start over) |
| `npm run dev` | API + web with auto-reload |
| `npm run start:prod` | Build + run everything on port 4000 |
| `npm test` | 25 backend tests (scoring maths, anti-gaming, privacy, RBAC, audit chain) |
| `npm run typecheck` | TypeScript check for both projects |
| **F5** in VS Code | Debug the API with breakpoints |

## 4. How the front end is connected to the API

- `frontend/vite.config.ts` **proxies `/v1` → `http://localhost:4000`**, so the browser only talks to one origin
  (no CORS setup). Point it elsewhere with `VITE_API_PROXY_TARGET`, or set `VITE_API_URL` for a hosted API
  (then add the site's origin to `CORS_ORIGINS` in `backend/.env`).
- `frontend/src/api/` is the whole integration layer: `http.ts` (requests, errors, anonymous session),
  `index.ts` (one typed function per endpoint), `types.ts` (response shapes).
- **Anonymous identity:** the browser creates a random device key once (localStorage); the API stores only a
  keyed hash, so reports are linked to "this device", never to a person. *Profile → Reset Anonymous Identity*
  starts fresh; *Privacy → Delete My Data* erases everything reported from the device.
- **Authority session:** token kept in `sessionStorage` (cleared when the tab closes); expired or revoked
  sessions send you back to the login screen automatically.
- Every screen has **loading, empty and error states** (offline banner, retry buttons, "access restricted"
  for missing permissions).
- Language: incident types, statuses and area messages come translated (English / हिंदी / मराठी) from the API.
  Static button text stays English.

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| `EADDRINUSE` / port already in use | Something else uses 4000 or 5173. Close it, or change `PORT` in `backend/.env` (and `VITE_API_PROXY_TARGET`) |
| App says *"Can't reach the Sanket server"* | The API isn't running. Use `npm run dev` (starts both) and check the terminal for errors |
| `npm install` fails building `better-sqlite3` | Use Node 22 LTS (prebuilt binaries exist for it) |
| Login says *account locked* | 5 wrong passwords lock for 15 min. Reset: stop, delete `backend/data/sanket.db*`, `npm run seed`, `npm run dev` |
| *Invalid or expired code* | The OTP is single-use and lasts 5 min. Go back and press Login again |
| Home shows "Calm", no patterns | You're outside the demo area. Use **Enter Location Manually → Railway Station** |
| Want to see the DB | Click `backend/data/sanket.db` in VS Code (SQLite Viewer extension) |
| Test on a phone | `npm run dev --prefix frontend -- --host`, open `http://<your-PC-IP>:5173`. Browsers only allow GPS on HTTPS, so use *Enter Location Manually* |
| Fonts look different offline | The Inter font loads from Google Fonts; the app works without it (system font fallback) |

## 6. Before you put it on the internet

1. In `backend/.env` set `NODE_ENV=production` and strong `JWT_SECRET` and `PEPPER`
   (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`). The server refuses to
   start in production without them, or with the development OTP display enabled.
2. Serve over HTTPS and set `TRUST_PROXY=1` behind a reverse proxy.
3. Plug in real OTP / password-reset delivery (`setTransport` in `backend/src/lib/notifier.ts`).
4. Change the seeded admin password, delete demo accounts, replace the Pune areas in
   `backend/src/db/seedData.ts` with your city's zones. Back up `backend/data/`.

More detail on detection, privacy and the full API: `backend/README.md`.
