"""
Seed DEMO check-ins for the dashboard Crew screen (seats C001, C002, C003). Seat C004 is left empty on purpose
so a live check-in can be made from the Astronaut App during the demo.

These are labeled test entries, NOT real astronaut data:
  - notes = "demo seed" on every record
  - pseudonyms come from placeholder names ("Demo Crew One/Two/Three"), hashed exactly like the Astronaut App
    (apps/astronaut/src/pseudonym.ts: "CREW-" + first 6 hex of SHA-256(normalize(name) + ":" + APP_SALT),
    with APP_SALT read from apps/astronaut/src/config.ts)
  - values are derived from the backend's own reference ranges (GET /api/v1/health/checkin/guide):
    C001 and C002 inside the green range for every indicator, C003 with ONE indicator (sleep) in the amber band,
    so its card shows "Take care of yourself today."

Posts through the existing API only. The payloads come from app/services/demo_seed.py, which the backend also uses
to seed an empty store on startup (hosted backend). Idempotent: each seat uses a fixed client_id, so re-running returns the
stored record (duplicate=True) instead of inserting again.

Usage (PowerShell, backend running on 8001):
    cd backend; .venv\\Scripts\\python scripts\\seed_demo_checkins.py
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/, for app.services.demo_seed
from app.services.demo_seed import SeedError, SOL, build_payloads  # noqa: E402  (same payloads as the startup seed)

API = "http://127.0.0.1:8001/api/v1/health"


# --- HTTP -----------------------------------------------------------------------------------------------------
def request(method: str, path: str, body: Any = None) -> Dict[str, Any]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> HTTP {e.code}: {e.read().decode('utf-8', 'replace')}")
    except urllib.error.URLError as e:
        sys.exit(f"Backend not reachable at {API} ({e.reason}). Start it first.")


def main() -> None:
    guide = request("GET", "/checkin/guide")
    try:
        payloads = build_payloads(guide)
    except SeedError as e:
        sys.exit(str(e))
    for payload, out_field in payloads:
        r = request("POST", "/checkin", payload)
        out = f", out of range: {out_field}={payload[out_field]}" if out_field else ""
        print(f"{payload['astronaut_id']} {payload['pseudonym']} sol {SOL}: {r['overall']['status']} "
              f"({r['overall']['headline']}) duplicate={r['duplicate']}{out}")
    print("C004 left empty for the live demo check-in.")


if __name__ == "__main__":
    main()
