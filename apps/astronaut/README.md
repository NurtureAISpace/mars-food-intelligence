# NurtureAI Astronaut App (offline-first PWA)

**Built Nov 14, 2026, during the hackathon.**

A small phone/tablet app for the crew's daily health check-in. It works without a network connection and syncs
to the existing backend check-in API (`/api/v1/health/checkin`) when the connection comes back. It lives in the
same repo as the main dashboard (`frontend/`) but is a separate Vite app.

## What it does

- **Onboarding (Name -> Code)**: the user types their full name (first + last); there is no seat choice. Everyone
  is a guest: the app assigns `GUEST-1`…`GUEST-4` itself (first free one, else the one with the oldest check-in;
  `src/guest.ts`). `C001`–`C004` are reserved for the NASA Inspiration4 data and the seeded demo check-ins: the app
  never sends them (`seatToCrewId` only maps guest seats, `makeLocalCheckin` and the sync queue refuse `C00x`).
  Profiles saved by older builds with a crew seat are moved to a guest seat on the next start, together with any
  unsent check-ins. On the device the name is normalized (trim, lowercase, collapse spaces) and hashed: `SHA-256(name + ":" + APP_SALT)`
  (`src/config.ts`), code = `CREW-` + first 6 hex chars, uppercase. WebCrypto is used when available; on plain
  http (e.g. a phone on the LAN) a tested plain-JS SHA-256 gives the same result.
  The name is stored **only** in this device's IndexedDB (for "Hi, <first name>"); it is never sent. Check-ins
  carry only the guest id and the anonymized code (`pseudonym`), and the dashboard shows only that code.
  It is only a pseudonym (anonymized code): the salt ships with the app, so anyone who already knows a name could
  recompute its code.
- **Check-in form**: the 6 indicators, units and ranges from `GET /api/v1/health/checkin/guide` (heart rate, blood
  pressure, blood sugar, body temperature, sleep, mood), with big +/- steppers and a mood picker. The guide is
  cached in IndexedDB, so the form works fully offline after one online start.
- **History**: the latest check-ins for this phone's guest id, each with a sync badge (**Pending / Synced /
  Failed**) and, once synced, the server status in plain words (**All good / Take care / Call doctor** for NOMINAL / WATCH / ACT). Check-ins made elsewhere (e.g. in the
  main dashboard) are shown too, labelled "from server".
- **Header**: "Hi, <first name> · CREW-XXXXXX" and a small "Change name" link.
- **Sync banner** (top, always visible): green "All check-ins sent" / amber "N check-in(s) waiting — they send
  automatically when you're back online" / red when the server rejected an entry or cannot be reached while online.
  There is no manual sync button: sending is automatic.

### Offline-first design

- Every check-in is written to **IndexedDB first** (via `idb`), with a client-generated UUID `client_id` and its
  `created_at` time (sent to the server as `measured_at`).
- While an entry is not synced, the app shows a **provisional colour** computed on the device from the cached
  guide ranges only, always labelled *"Provisional (range check only, offline) — personal baseline applies after
  sync"*. It is never shown as the final status: the server also checks the crew member's personal baseline,
  so the final status can differ (e.g. provisional green, server WATCH).
- **Sync queue** (`src/sync.ts`): runs on app start, on the browser `online` event, right after a submit, and every
  10 s while entries are waiting for a retry. Entries are sent oldest first.
  - 2xx: **Synced**, server status stored.
  - Network error, 5xx, 408, 429: stays **Pending**, exponential backoff (5 s, 10 s, 20 s ... max 5 min). The run
    stops there so later entries are never sent before earlier ones.
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

**Demo = the production build on port 4173, only.** The dashboard's "Open Astronaut App" button and the "Join the
crew" QR both open this build (one shared link, `frontend/src/appLink.ts`):

```powershell
cd apps\astronaut
npm install
npm run build; npm run preview     # http://localhost:4173  (proxies /api -> http://127.0.0.1:8001)
```

The footer shows `build <git hash> · <build time>`, so you can see which build is open. Rebuild after every pull.

`npm run dev` (http://localhost:3001) is for code changes only; nothing links to it and its footer says
"dev server (not the demo build)".

Main dashboard (optional, third terminal; "Open Astronaut App" button on the Crew screen):

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

1. With the backend running, open http://localhost:4173 in Chrome or Edge and enter your full name (you get a guest id, e.g. `GUEST-1`).
   This first online visit downloads the check-in guide and installs the service worker.
2. DevTools (F12) -> **Network** -> throttling dropdown -> **Offline**.
   Reload the page: the app still loads (from the service worker) and the form still works.
3. Fill in a check-in and **Submit**. It shows **Pending** with the labelled provisional colour, and the amber banner
   says **1 check-in waiting**. Submit a second one (the Sol moves on by itself).
4. Set throttling back to **No throttling**. The `online` event triggers a sync: both entries turn **Synced**
   with the server status (All good / Take care / Call doctor), and the banner turns green: **All check-ins sent**.
5. Optional: check `http://127.0.0.1:8001/api/v1/health/checkins?astronaut_id=GUEST-1`: one record per check-in,
   each with its `client_id`, `measured_at` and `pseudonym` (no name).

On a phone: use the QR link (see "Live demo with judges"). Browsers only enable service workers on `https` or
`localhost`: over the https tunnel the app is offline-capable; over plain http on the LAN it works online only.

### Demo seed for the Crew screen

Crew screen demo check-ins for C001–C003 are seeded test entries, not real astronaut data. They fill the
dashboard Crew screen before the demo; C004 stays empty. Live check-ins from this app always land in the Guests row.

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

A judge scans the QR code on the dashboard (Crew -> **Join the crew**), types their name and checks in from their
own phone. Everyone is a guest (`GUEST-1`…`GUEST-4`, first free one, else the one with the oldest check-in); the
dashboard shows them in the **Guests** row right under the crew cards (newest first). The name stays on the phone;
the dashboard sees only the `CREW-XXXXXX` code.

The QR code and the **Open Astronaut App** button use one shared link. Set it in the QR window's **App link** field
(saved in that browser); default: `VITE_ASTRONAUT_PUBLIC_URL`, else `http://<host of the dashboard page>:4173`.

### Why same-Wi-Fi phones failed (diagnosis, 2026-11-15)

- **Most likely: the QR pointed to `localhost`.** With the dashboard opened as `http://localhost:3000` and no
  `VITE_ASTRONAUT_PUBLIC_URL`, the default link was `http://localhost:4173`, which on a phone opens the phone itself.
  The QR window now warns when the link contains `localhost` / `127.0.0.1`.
- **Windows Firewall:** on the demo laptop, `node.exe` is allowed inbound only for the **Public** profile. On a
  network Windows marks as **Private** (default inbound = block), phones cannot reach port 4173.
- **Client isolation:** venue Wi-Fi and some hotspots block phone-to-laptop traffic; no laptop setting fixes that.
- Not the cause: binding (`host: true` = all interfaces) and Vite's host check (IP addresses are always allowed).
  The host check matters only for the tunnel name, so `preview.allowedHosts` lists `.trycloudflare.com`.

### Recommended: Cloudflare quick tunnel (works on any network, no account)

Install once (then open a new terminal so `cloudflared` is on the PATH):

```powershell
winget install --id Cloudflare.cloudflared
```

Four terminals:

```powershell
# 1. Backend (stays on 127.0.0.1; the app reaches it through the Vite /api proxy)
cd backend; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001

# 2. Astronaut App, demo build
cd apps\astronaut; npm run build; npm run preview          # http://localhost:4173

# 3. Tunnel: prints https://<random-words>.trycloudflare.com -> copy it
cloudflared tunnel --url http://localhost:4173

# 4. Dashboard
cd frontend; npm run dev                                   # open http://localhost:3000
```

Then Crew -> **Join the crew** -> paste the `https://….trycloudflare.com` link into **App link**. The QR code and
the **Open Astronaut App** button change at once. Quick check from any device: `<tunnel>/api/v1/health/checkin/guide`
returns JSON.

- The tunnel URL changes every time `cloudflared` starts: paste the new one.
- Over https the service worker works, so the app is installable and offline-capable on the phone.
- The laptop needs internet. Quick tunnels are meant for testing (no uptime guarantee). Traffic passes through
  Cloudflare: only guest ids, anonymized codes and readings, never names.

### LAN-only fallback (same Wi-Fi, no internet needed)

1. `ipconfig` -> "Wireless LAN adapter Wi-Fi" -> IPv4 Address, e.g. `192.168.1.23`.
2. Allow port 4173 once (PowerShell **as Administrator**):

   ```powershell
   New-NetFirewallRule -DisplayName "NurtureAI 4173" -Direction Inbound -LocalPort 4173 -Protocol TCP -Action Allow -Profile Private,Public
   ```

3. Terminals 1, 2 and 4 as above (no tunnel). In **App link** enter `http://192.168.1.23:4173`
   (or start the dashboard with `$env:VITE_ASTRONAUT_PUBLIC_URL = "http://192.168.1.23:4173"`).
4. Still nothing on the phone: the network isolates clients. Use the tunnel, or a phone hotspot for the laptop
   and the judges.

Over plain http the app works online but has no service worker (no offline app shell); that is expected for the
LAN fallback.

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
- No login: whoever uses the device checks in as its guest id. Local data is per browser/device.
- The service worker updates automatically on the next visit after a new build (`registerType: autoUpdate`).
- Icons are the official NurtureAISpace logo (`public/logo/`, `favicon.ico`, `apple-touch-icon.png`, same files as the dashboard); no agency logos are used.
- Decision-support prototype, not a medical device. All ranges and their sources come from the backend
  (`backend/app/data/indicator_ranges.json` via `/checkin/guide`); this app adds no health thresholds of its own
  (its only own numbers are UI settings: stepper sizes, retry timings, and the demo default Sol 250 used by the
  main dashboard too, when there is no history yet).
