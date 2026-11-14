# NurtureAI Astronaut App (offline-first PWA)

**Built Nov 14, 2026, during the hackathon.**

A small phone/tablet app for the crew's daily health check-in. It works without a network connection and syncs
to the existing backend check-in API (`/api/v1/health/checkin`) when the connection comes back. It lives in the
same repo as the main dashboard (`frontend/`) but is a separate Vite app.

## What it does

- **Crew select**: crew IDs come from the backend (`GET /api/v1/health/crew`), cached on the device. The last
  choice is remembered. You can also type another crew ID.
- **Check-in form**: the 6 indicators, units and ranges from `GET /api/v1/health/checkin/guide` (heart rate, blood
  pressure, blood sugar, body temperature, sleep, mood), with big +/- steppers and a mood picker. The guide is
  cached in IndexedDB, so the form works fully offline after one online start.
- **History**: the latest check-ins for the selected crew member, each with a sync badge (**Pending / Synced /
  Failed**) and, once synced, the server status (**NOMINAL / WATCH / ACT**). Check-ins made elsewhere (e.g. in the
  main dashboard) are shown too, labelled "from server".
- **Header**: Online/Offline indicator, "N pending", and a manual **Sync now** button.

### Offline-first design

- Every check-in is written to **IndexedDB first** (via `idb`), with a client-generated UUID `client_id` and its
  `created_at` time (sent to the server as `measured_at`).
- While an entry is not synced, the app shows a **provisional colour** computed on the device from the cached
  guide ranges only, always labelled *"Provisional (range check only, offline) — personal baseline applies after
  sync"*. It is never shown as the final status: the server also checks the crew member's personal baseline,
  so the final status can differ (e.g. provisional green, server WATCH).
- **Sync queue** (`src/sync.ts`): runs on app start, on the browser `online` event, on "Sync now", right after a
  submit, and every 10 s while entries are waiting for a retry. Entries are sent oldest first.
  - 2xx: **Synced**, server status stored.
  - Network error, 5xx, 408, 429: stays **Pending**, exponential backoff (5 s, 10 s, 20 s ... max 5 min). The run
    stops there so later entries are never sent before earlier ones. "Sync now" ignores the backoff.
  - Other 4xx (e.g. 422 validation): **Failed**, the server's message is shown; the entry can be discarded.
- **Idempotency**: retries resend the same `client_id`. The backend stores it and, if it sees a `client_id` again,
  returns the stored record (`200`, `duplicate: true`) instead of inserting a second check-in.
- The service worker (vite-plugin-pwa / Workbox) precaches the app shell only. API data is never cached by the
  service worker; it lives in IndexedDB.

## How to run (Windows PowerShell)

Backend (from the repo root, first terminal):

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Astronaut App, dev mode (second terminal):

```powershell
cd apps\astronaut
npm install
npm run dev          # http://localhost:3001  (proxies /api -> http://127.0.0.1:8001)
```

Main dashboard (optional, third terminal; it has an "Open Astronaut App" link in Crew Health -> Daily Check-in):

```powershell
cd frontend
npm run dev          # http://localhost:3000
```

Unit tests for the sync queue and the provisional range check:

```powershell
cd apps\astronaut
npm test
```

## How to demo offline

The service worker only runs in a production build, so use `preview` (same port and `/api` proxy as dev):

```powershell
cd apps\astronaut
npm run build
npm run preview      # http://localhost:3001
```

1. With the backend running, open http://localhost:3001 in Chrome or Edge, pick a crew member (e.g. `CDR-01`).
   This first online visit downloads the guide and crew list and installs the service worker.
2. DevTools (F12) -> **Network** -> throttling dropdown -> **Offline**. The header switches to **Offline**.
   Reload the page: the app still loads (from the service worker) and the form still works.
3. Fill in a check-in and **Submit**. It shows **Pending** with the labelled provisional colour, and the header
   shows **1 pending**. Submit a second one (the Sol moves on by itself). "Sync now" keeps them pending.
4. Set throttling back to **No throttling**. The `online` event triggers a sync: both entries turn **Synced**
   with the server status (NOMINAL / WATCH / ACT), and the header shows **0 pending**.
5. Optional: check `http://127.0.0.1:8001/api/v1/health/checkins?astronaut_id=CDR-01`: one record per check-in,
   each with its `client_id` and `measured_at`.

On a phone: open `http://<your-PC-IP>:3001`. Note that browsers only enable service workers on `https` or
`localhost`, so over plain http on the LAN the app works online but is not installable/offline-capable (see
limitations).

## Known limitations

- **Offline needs one online start** to download the guide and crew list. Before that, the form shows a message
  instead of the indicators (crew IDs can still be typed in).
- **Service worker only on https or localhost.** On a phone over plain http (LAN IP) there is no app-shell
  caching; IndexedDB storage and the sync queue still work while the page stays open. A real deployment needs
  https.
- **The server keeps one check-in per astronaut per Sol** (existing backend rule): a second check-in for the same
  Sol replaces the first. The History marks a synced local entry as "replaced" when that happened.
- The provisional colour is a **range check only** (no personal baseline, no nutrition link). The final status is
  always the server's.
- No background sync while the app is closed (Background Sync API is not used); syncing happens when the app is
  open.
- No login: anyone using the device can check in for any crew ID. Local data is per browser/device.
- The service worker updates automatically on the next visit after a new build (`registerType: autoUpdate`).
- Icons are simple generated shapes (`npm run icons`, `scripts/make-icons.mjs`); no agency logos are used.
- Decision-support prototype, not a medical device. All ranges and their sources come from the backend
  (`backend/app/data/indicator_ranges.json` via `/checkin/guide`); this app adds no health thresholds of its own
  (its only own numbers are UI settings: stepper sizes, retry timings, and the demo default Sol 250 used by the
  main dashboard too, when there is no history yet).
