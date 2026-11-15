"""
Export a static JSON snapshot of every API response the static demo site needs (VITE_STATIC_DEMO=1).

Writes frontend/public/snapshot/*.json (dashboard: Crew, NASA Evidence, Food & Vitamins) and
apps/astronaut/public/snapshot/*.json (Astronaut App: check-in guide). The file name is derived from the request
path + query exactly like snapshotKey() in frontend/src/api.ts and apps/astronaut/src/api.ts.

Guest histories (GUEST-1..4) are written EMPTY on purpose: the public site shows only the labeled demo seed
check-ins on C001-C004, never check-ins made by people on their phones.

Usage (backend running on 127.0.0.1:8001):
    python scripts/export_snapshot.py
"""

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "http://127.0.0.1:8001"
ROOT = Path(__file__).resolve().parents[1]
DASH_OUT = ROOT / "frontend" / "public" / "snapshot"
APP_OUT = ROOT / "apps" / "astronaut" / "public" / "snapshot"
CREW = ["C001", "C002", "C003", "C004"]
GUESTS = ["GUEST-1", "GUEST-2", "GUEST-3", "GUEST-4"]


def snapshot_key(url: str) -> str:
    """'/api/v1/health/crew?scenario=x' -> 'health_crew_scenario_x.json' (same rule as the TypeScript side)."""
    return re.sub(r"[^A-Za-z0-9._-]+", "_", re.sub(r"^/api/v1/", "", url)) + ".json"


def empty_history(gid: str):
    return {"disclaimer": "Decision-support prototype, not a medical device.", "astronaut_id": gid, "pseudonym": None,
            "count": 0, "streak": {"current_sols": 0, "last_sol": None, "total_checkins": 0}, "checkins": []}


def get(url: str):
    with urllib.request.urlopen(API + url, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def write(out: Path, url: str, data) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / snapshot_key(url)).write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")


def main() -> int:
    for out in (DASH_OUT, APP_OUT):
        if out.exists():
            for f in out.glob("*.json"):
                f.unlink()

    dash = {}
    skipped = []
    scen = get("/api/v1/health/scenarios")
    dash["/api/v1/health/scenarios"] = scen
    dash["/api/v1/real-data/i4"] = get("/api/v1/real-data/i4")

    ids = [s["id"] for s in scen["scenarios"]]
    horizons = sorted({d["horizon_sols"] for d in scen.get("destinations", [])})
    for sid in ids:
        q = urllib.parse.urlencode({"scenario": sid})
        dash[f"/api/v1/health/crew?{q}"] = get(f"/api/v1/health/crew?{q}")
        for h in horizons:
            # Same parameter order as fetchCrewPresetHorizon() / fetchAlertsPreset() in frontend/src/api.ts
            q = urllib.parse.urlencode({"scenario": sid, "horizon_sols": str(h)})
            dash[f"/api/v1/health/crew?{q}"] = get(f"/api/v1/health/crew?{q}")
            u = f"/api/v1/health/alerts?sol={h}&scenario={urllib.parse.quote(sid, safe='')}"
            try:  # not called by the 3 screens; exported when the backend accepts the Sol
                dash[u] = get(u)
            except urllib.error.HTTPError as e:
                skipped.append(f"{u} (HTTP {e.code})")

    for cid in CREW:
        u = f"/api/v1/health/checkins?astronaut_id={cid}"
        hist = get(u)
        demo = [e for e in hist.get("checkins", []) if e.get("notes") == "demo seed"]
        if len(demo) != len(hist.get("checkins", [])):
            sys.exit(f"{cid} has check-ins that are not 'demo seed': clean the store first")
        dash[u] = hist
    for gid in GUESTS:
        dash[f"/api/v1/health/checkins?astronaut_id={gid}"] = empty_history(gid)

    guide = get("/api/v1/health/checkin/guide")
    dash["/api/v1/health/checkin/guide"] = guide

    for url, data in dash.items():
        write(DASH_OUT, url, data)
    write(APP_OUT, "/api/v1/health/checkin/guide", guide)
    for gid in GUESTS:
        write(APP_OUT, f"/api/v1/health/checkins?astronaut_id={gid}", empty_history(gid))

    print(f"dashboard: {len(dash)} files -> {DASH_OUT.relative_to(ROOT)}")
    for u in skipped:
        print(f"skipped: {u}")
    print(f"astronaut: {1 + len(GUESTS)} files -> {APP_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
