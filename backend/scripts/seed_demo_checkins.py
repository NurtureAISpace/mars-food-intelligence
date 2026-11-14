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

Posts through the existing API only. Idempotent: each seat uses a fixed client_id, so re-running returns the
stored record (duplicate=True) instead of inserting again.

Usage (PowerShell, backend running on 8001):
    cd backend; .venv\\Scripts\\python scripts\\seed_demo_checkins.py
"""

import hashlib
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

API = "http://127.0.0.1:8001/api/v1/health"
REPO_ROOT = Path(__file__).resolve().parents[2]
ASTRONAUT_CONFIG = REPO_ROOT / "apps" / "astronaut" / "src" / "config.ts"
SOL = 1
NOTE = "demo seed"
INTEGER_FIELDS = {"heart_rate_bpm", "systolic_mmHg", "diastolic_mmHg", "blood_glucose_mg_dl", "mood_1_5"}

# seat -> (placeholder name, position inside the green range 0..1, out-of-range indicator or None)
SEEDS: List[Tuple[str, str, float, Any]] = [
    ("C001", "Demo Crew One", 0.40, None),
    ("C002", "Demo Crew Two", 0.60, None),
    ("C003", "Demo Crew Three", 0.50, "sleep_hours"),
]


# --- pseudonym: same algorithm and salt as apps/astronaut/src/pseudonym.ts ------------------------------------
def app_salt() -> str:
    m = re.search(r"APP_SALT\s*=\s*'([^']+)'", ASTRONAUT_CONFIG.read_text(encoding="utf-8"))
    if not m:
        sys.exit(f"APP_SALT not found in {ASTRONAUT_CONFIG}")
    return m.group(1)


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def pseudonym_for(name: str, salt: str) -> str:
    digest = hashlib.sha256(f"{normalize_name(name)}:{salt}".encode("utf-8")).hexdigest()
    return f"CREW-{digest[:6].upper()}"


# --- values from the guide's thresholds -----------------------------------------------------------------------
def _hit(value: float, t: Dict[str, Any]) -> bool:
    if t["direction"] == "below":
        return value < t["value"] or (t["inclusive"] and value == t["value"])
    return value > t["value"] or (t["inclusive"] and value == t["value"])


def color_of(value: float, rows: List[Dict[str, Any]]) -> str:
    for color in ("red", "amber"):
        if any(t["color"] == color and _hit(value, t) for t in rows):
            return color
    return "green"


def _round(field: str, v: float) -> float:
    return int(round(v)) if field in INTEGER_FIELDS else round(v, 1)


def green_value(field: str, rows: List[Dict[str, Any]], limits: Dict[str, float], pos: float) -> float:
    below = [t["value"] for t in rows if t["direction"] == "below"]
    above = [t["value"] for t in rows if t["direction"] == "above"]
    lo = max(below) if below else limits["min"]
    hi = min(above) if above else limits["max"]
    v = _round(field, lo + (hi - lo) * pos)
    if color_of(v, rows) != "green":
        sys.exit(f"could not place {field} inside its green range ({lo}..{hi})")
    return v


def amber_value(field: str, rows: List[Dict[str, Any]]) -> float:
    """Midpoint of the low amber band (between the red-below and amber-below thresholds)."""
    amber = max(t["value"] for t in rows if t["color"] == "amber" and t["direction"] == "below")
    red = max((t["value"] for t in rows if t["color"] == "red" and t["direction"] == "below"), default=amber - 1)
    v = _round(field, (amber + red) / 2)
    if color_of(v, rows) != "amber":
        sys.exit(f"could not place {field} in its amber band ({red}..{amber})")
    return v


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
    limits = guide["input_limits"]
    rows_by_field: Dict[str, List[Dict[str, Any]]] = {}
    for ind in guide["indicators"]:
        for f in ind["fields"]:
            rows_by_field[f] = [t for t in ind["thresholds"] if t["field"] == f]

    salt = app_salt()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for seat, name, pos, out_field in SEEDS:
        values = {f: green_value(f, rows, limits[f], pos) for f, rows in rows_by_field.items()}
        if out_field:
            values[out_field] = amber_value(out_field, rows_by_field[out_field])
        payload = {"astronaut_id": seat, "sol": SOL, **values, "notes": NOTE,
                   "client_id": f"demo-seed-{seat}-sol{SOL}", "measured_at": now,
                   "pseudonym": pseudonym_for(name, salt)}
        r = request("POST", "/checkin", payload)
        out = f", out of range: {out_field}={values[out_field]}" if out_field else ""
        print(f"{seat} {payload['pseudonym']} sol {SOL}: {r['overall']['status']} "
              f"({r['overall']['headline']}) duplicate={r['duplicate']}{out}")
    print("C004 left empty for the live demo check-in.")


if __name__ == "__main__":
    main()
