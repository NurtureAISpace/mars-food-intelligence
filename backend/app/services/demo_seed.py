"""
Labeled DEMO check-ins for the dashboard Crew screen (seats C001, C002, C003). Seat C004 stays empty on purpose so a
live check-in can be made from the Astronaut App.

These are test entries, NOT real astronaut data:
  - notes = "demo seed" on every record
  - pseudonyms come from placeholder names ("Demo Crew One/Two/Three"), hashed exactly like the Astronaut App
    (apps/astronaut/src/pseudonym.ts: "CREW-" + first 6 hex of SHA-256(normalize(name) + ":" + APP_SALT))
  - values are derived from the backend's own reference ranges (the check-in guide):
    C001 and C002 inside the green range for every indicator, C003 with ONE indicator (sleep) in the amber band.

Used in two places (same payloads):
  - backend/scripts/seed_demo_checkins.py posts them to a running backend (laptop demo)
  - app.main seeds them on startup when the check-in store is empty (hosted backend: the free Render disk is wiped on
    every restart, so the dashboard is never blank)
Each seat has a fixed client_id, so seeding twice never inserts twice.
"""

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[3]
ASTRONAUT_CONFIG = REPO_ROOT / "apps" / "astronaut" / "src" / "config.ts"
# Copy of APP_SALT in apps/astronaut/src/config.ts, used only when that file is not deployed next to the backend.
DEFAULT_APP_SALT = "nurtureai-space-pseudonym-v1"
SOL = 1
NOTE = "demo seed"
INTEGER_FIELDS = {"heart_rate_bpm", "systolic_mmHg", "diastolic_mmHg", "blood_glucose_mg_dl", "mood_1_5"}

# seat -> (placeholder name, position inside the green range 0..1, out-of-range indicator or None)
SEEDS: List[Tuple[str, str, float, Any]] = [
    ("C001", "Demo Crew One", 0.40, None),
    ("C002", "Demo Crew Two", 0.60, None),
    ("C003", "Demo Crew Three", 0.50, "sleep_hours"),
]


class SeedError(RuntimeError):
    pass


# --- pseudonym: same algorithm and salt as apps/astronaut/src/pseudonym.ts ------------------------------------
def app_salt() -> str:
    try:
        m = re.search(r"APP_SALT\s*=\s*'([^']+)'", ASTRONAUT_CONFIG.read_text(encoding="utf-8"))
    except OSError:
        return DEFAULT_APP_SALT
    return m.group(1) if m else DEFAULT_APP_SALT


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
        raise SeedError(f"could not place {field} inside its green range ({lo}..{hi})")
    return v


def amber_value(field: str, rows: List[Dict[str, Any]]) -> float:
    """Midpoint of the low amber band (between the red-below and amber-below thresholds)."""
    amber = max(t["value"] for t in rows if t["color"] == "amber" and t["direction"] == "below")
    red = max((t["value"] for t in rows if t["color"] == "red" and t["direction"] == "below"), default=amber - 1)
    v = _round(field, (amber + red) / 2)
    if color_of(v, rows) != "amber":
        raise SeedError(f"could not place {field} in its amber band ({red}..{amber})")
    return v


def build_payloads(guide: Dict[str, Any], salt: Optional[str] = None,
                   now: Optional[str] = None) -> List[Tuple[Dict[str, Any], Optional[str]]]:
    """(check-in payload, out-of-range field or None) per seeded seat, from a check-in guide
    (GET /health/checkin/guide or CheckinService.guide())."""
    salt = salt or app_salt()
    now = now or datetime.now(timezone.utc).isoformat(timespec="seconds")
    limits = guide["input_limits"]
    rows_by_field: Dict[str, List[Dict[str, Any]]] = {}
    for ind in guide["indicators"]:
        for f in ind["fields"]:
            rows_by_field[f] = [t for t in ind["thresholds"] if t["field"] == f]

    out = []
    for seat, name, pos, out_field in SEEDS:
        values = {f: green_value(f, rows, limits[f], pos) for f, rows in rows_by_field.items()}
        if out_field:
            values[out_field] = amber_value(out_field, rows_by_field[out_field])
        out.append(({"astronaut_id": seat, "sol": SOL, **values, "notes": NOTE,
                     "client_id": f"demo-seed-{seat}-sol{SOL}", "measured_at": now,
                     "pseudonym": pseudonym_for(name, salt)}, out_field))
    return out


def seed_if_empty(service: Any) -> int:
    """Submit the demo check-ins through `service` (a CheckinService) when its store holds no check-ins at all.
    Returns how many were stored."""
    from app.services.checkin_service import CheckinIn  # local import: no import cycle with checkin_service

    if service.store.count():
        return 0
    n = 0
    for payload, _ in build_payloads(service.guide()):
        if not service.submit(CheckinIn(**payload))["duplicate"]:
            n += 1
    return n
