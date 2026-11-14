# NurtureAI Astronaut App (offline-first PWA)

**Built Nov 14, 2026, during the hackathon.**

A small phone/tablet app for the crew's daily health check-in. It works without a network connection and syncs
to the existing backend check-in API (`/api/v1/health/checkin`) when the connection comes back. It lives in the
same repo as the main dashboard (`frontend/`) but is a separate Vite app.

## What it does

- **Onboarding (name -> pseudonym)**: the astronaut types their full name (first + last) and picks seat 1-4.
  Seat k checks in as Inspiration4 subject `C00k` (links the demo to the real NASA blood data). On the device the
  name is normalized (trim, lowercase, collapse spaces) and hashed: `SHA-256(name + ":" + APP_SALT)`
  (`src/config.ts`), code = `CREW-` + first 6 hex chars, uppercase. WebCrypto is used when available; on plain
  http (e.g. a phone on the LAN) a tested plain-JS SHA-256 gives the same result.
  The name is stored **only** in this device's IndexedDB (for "Hi, <first name>"); it is never sent. Check-ins
  carry only the seat's crew id and the anonymized code (`pseudonym`), and the dashboard shows only that code.
  It is only a pseudonym (anonymized code): the salt ships with the app, so anyone who already knows a name could
  recompute its code.
- **Check-in form**: the 6 indicators, units and ranges from `GET /api/v1/health/checkin/guide` (heart rate, blood
  pressure, blood sugar, body temperature, sleep, mood), with big +/- steppers and a mood picker. The guide is
  cached in IndexedDB, so the form works fully offline after one online start.
- **History**: the latest check-ins for the selected crew member, each with a sync badge (**Pending / Synced /
  Failed**) and, once synced, the server status in plain words (**All good / Take care / Call doctor** for NOMINAL / WATCH / ACT). Check-ins made elsewhere (e.g. in the
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

The service worker only runs in a production build, so use `preview` (port 4173, same `/api` proxy as dev):

```powershell
cd apps\astronaut
npm run build
npm run preview      # http://localhost:4173
```

1. With the backend running, open http://localhost:4173 in Chrome or Edge, enter your full name and pick a seat (e.g. Seat 1 = `C001`).
   This first online visit downloads the check-in guide and installs the service worker.
2. DevTools (F12) -> **Network** -> throttling dropdown -> **Offline**. The header switches to **Offline**.
   Reload the page: the app still loads (from the service worker) and the form still works.
3. Fill in a check-in and **Submit**. It shows **Pending** with the labelled provisional colour, and the header
   shows **1 pending**. Submit a second one (the Sol moves on by itself). "Sync now" keeps them pending.
4. Set throttling back to **No throttling**. The `online` event triggers a sync: both entries turn **Synced**
   with the server status (All good / Take care / Call doctor), and the header shows **0 pending**.
5. Optional: check `http://127.0.0.1:8001/api/v1/health/checkins?astronaut_id=C001`: one record per check-in,
   each with its `client_id`, `measured_at` and `pseudonym` (no name).

On a phone: open `http://<your-PC-IP>:4173` (see "Live demo with judges"). Note that browsers only enable service workers on `https` or
`localhost`, so over plain http on the LAN the app works online but is not installable/offline-capable (see
limitations).

### Demo seed for the Crew screen

Crew screen demo check-ins for C001–C003 are seeded test entries, not real astronaut data. They fill the
dashboard Crew screen before the demo; seat C004 stays empty so you can check in live from this app.

```powershell
cd backend; .venv\Scripts\python scripts\seed_demo_checkins.py
```

- Posts Sol 1 check-ins through the normal API (backend must be running on 8001), each with `notes = "demo seed"`.
- Pseudonyms are made with the same algorithm and salt as `src/pseudonym.ts`, from the placeholder names
  "Demo Crew One/Two/Three" (never real names).
- Values come from the backend reference ranges (`/checkin/guide`): C001 and C002 are inside every range,
  C003 has sleep in the amber band, so its card shows "Take care".
- Safe to re-run: fixed `client_id`s (`demo-seed-C00k-sol1`) mean the server returns the stored record instead of
  adding a duplicate.

## Live demo with judges

A judge scans a QR code on the dashboard, picks **Guest** in this app and checks in from their own phone. Guests
check in as `GUEST-1`…`GUEST-4` (first free one, else the one with the oldest check-in is reused); the 4 crew seats
are not touched. The dashboard Crew screen shows them in a separate "Guests" row (newest first). The name stays
on the phone; the dashboard sees only the `CREW-XXXXXX` code.

1. Find the laptop's Wi-Fi IPv4 address:

   ```powershell
   ipconfig   # "Wireless LAN adapter Wi-Fi" -> IPv4 Address, e.g. 192.168.1.23
   ```

2. Backend (terminal 1, stays on 127.0.0.1; phones reach it through the Vite proxies):

   ```powershell
   cd backend
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
   ```

3. Astronaut App, production build on the LAN (terminal 2, `host: true`, port 4173):

   ```powershell
   cd appsstronaut
   npm run build
   npm run preview      # Network: http://192.168.1.23:4173
   ```

4. Dashboard with the QR URL (terminal 3):

   ```powershell
   cd frontend
   $env:VITE_ASTRONAUT_PUBLIC_URL = "http://192.168.1.23:4173"
   npm run dev          # open http://localhost:3000 -> Crew -> "Join the crew"
   ```

   Without the variable the QR points to `http://<host of the dashboard page>:4173`, which is only right if you
   opened the dashboard via the LAN IP (`http://192.168.1.23:3000`), not via `localhost`.

5. **Windows Firewall**: the first time Node listens on the LAN, Windows asks; allow **Private networks**. If you
   missed the prompt: Windows Security -> Firewall & network protection -> Allow an app through firewall -> Node.js
   -> tick **Private**. Make sure the venue Wi-Fi is set to a **Private** network profile (Settings -> Network ->
   Wi-Fi -> network properties), otherwise the rule does not apply.

6. **Fallback**: venue Wi-Fi often blocks phone-to-laptop traffic (client isolation). Turn on a phone hotspot,
   connect the laptop to it, re-run `ipconfig`, update `VITE_ASTRONAUT_PUBLIC_URL`, restart `npm run dev`. Judges
   join the hotspot (or use the hotspot phone itself).

Over plain http the app works online but has no service worker (no offline app shell); that is expected for the
demo.

## Known limitations

- **Offline needs one online start** to download the check-in guide. Before that, the form shows a message
  instead of the indicators.
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
