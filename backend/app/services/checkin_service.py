"""
Astronaut Daily Check-in: self-reported measurements -> colour-coded, explained result.

Two evaluation layers per indicator:
  1. Reference range -> green / amber / red. Thresholds, sources and plain-English guidance live in
     app/data/indicator_ranges.json (every threshold has a source + status "literature" | "assumed").
  2. Personal baseline -> "different from your normal" when |z| >= flag_abs_z versus the astronaut's own
     earlier check-ins (plus the synthetic crew history for heart rate and sleep when the astronaut is one
     of the simulated crew). Needs >= min_prior_entries earlier values, otherwise "building your baseline".

Overall status:  any red -> ACT (contact flight surgeon); any amber or baseline flag -> WATCH; else NOMINAL.
Check-ins are kept in memory and persisted to a JSON file (backend/data/runtime/, gitignored).
Decision-support prototype, not a medical device.
"""

import json
import os
import statistics
import threading
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, model_validator

from app.core.config import BASE_DIR, settings
from app.ml.anomaly import NUTRIENT_LABELS

RANGES_FILE = settings.DATA_DIR / "indicator_ranges.json"
DEFAULT_STORE_PATH = Path(os.environ.get("CHECKIN_STORE_PATH",
                                         BASE_DIR.parent / "data" / "runtime" / "checkins.json"))
COLOR_RANK = {"green": 0, "amber": 1, "red": 2}
COLOR_TO_STATUS = {"green": "NOMINAL", "amber": "WATCH", "red": "ACT"}

# Physically possible input limits (validation, not clinical ranges)
INPUT_LIMITS: Dict[str, Tuple[float, float]] = {
    "heart_rate_bpm": (20, 250),
    "systolic_mmHg": (50, 260),
    "diastolic_mmHg": (20, 160),
    "blood_glucose_mg_dl": (20, 600),
    "body_temp_c": (30.0, 44.0),
    "sleep_hours": (0, 24),
    "mood_1_5": (1, 5),
}
MEASUREMENT_FIELDS = list(INPUT_LIMITS)
# Synthetic crew vitals usable as personal history (app.ml.crew_data column -> check-in field)
SYNTHETIC_HISTORY_COLUMNS = {"heart_rate_bpm": "hr_rest", "sleep_hours": "sleep_h"}


def _lim(name: str, i: int) -> float:
    return INPUT_LIMITS[name][i]


class CheckinIn(BaseModel):
    astronaut_id: str = Field(..., pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$", examples=["CDR-01"])
    sol: int = Field(..., ge=0, le=settings.EXTENDED_MISSION_SOLS)
    heart_rate_bpm: float = Field(..., ge=_lim("heart_rate_bpm", 0), le=_lim("heart_rate_bpm", 1))
    systolic_mmHg: float = Field(..., ge=_lim("systolic_mmHg", 0), le=_lim("systolic_mmHg", 1))
    diastolic_mmHg: float = Field(..., ge=_lim("diastolic_mmHg", 0), le=_lim("diastolic_mmHg", 1))
    blood_glucose_mg_dl: float = Field(..., ge=_lim("blood_glucose_mg_dl", 0), le=_lim("blood_glucose_mg_dl", 1))
    body_temp_c: float = Field(..., ge=_lim("body_temp_c", 0), le=_lim("body_temp_c", 1))
    sleep_hours: float = Field(..., ge=_lim("sleep_hours", 0), le=_lim("sleep_hours", 1))
    mood_1_5: int = Field(..., ge=1, le=5)
    notes: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def _diastolic_below_systolic(self) -> "CheckinIn":
        if self.diastolic_mmHg >= self.systolic_mmHg:
            raise ValueError("diastolic_mmHg must be lower than systolic_mmHg")
        return self


# ---------------------------------------------------------------------------
# Reference ranges
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def load_ranges() -> Dict[str, Any]:
    with open(RANGES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _hit(value: float, t: Dict[str, Any]) -> bool:
    v, inclusive = t["value"], t["inclusive"]
    if t["direction"] == "below":
        return value < v or (inclusive and value == v)
    return value > v or (inclusive and value == v)


def classify(value: float, thresholds: List[Dict[str, Any]]) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Colour of one value: red thresholds first, then amber, else green. Returns (color, threshold hit)."""
    for color in ("red", "amber"):
        for t in thresholds:
            if t["color"] == color and _hit(value, t):
                return color, t
    return "green", None


def _band_key(color: str, threshold: Optional[Dict[str, Any]]) -> str:
    if color == "green" or threshold is None:
        return "green"
    return f"{color}_{'low' if threshold['direction'] == 'below' else 'high'}"


def _source_rows(indicator: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [{"field": field, "color": t["color"], "direction": t["direction"], "value": t["value"],
             "inclusive": t["inclusive"], "status": t["status"], "source": t["source"],
             "where_in_source": t.get("where_in_source")}
            for field, ths in indicator["thresholds"].items() for t in ths]


def _sources_for(indicator: Dict[str, Any], sources: Dict[str, Any]) -> List[Dict[str, Any]]:
    ids: List[str] = []
    for ths in indicator["thresholds"].values():
        for t in ths:
            if t["source"] not in ids:
                ids.append(t["source"])
    return [{"id": sid, "citation": sources[sid]["citation"], "doi_or_url": sources[sid]["doi_or_url"],
             "access": sources[sid]["access"]} for sid in ids]


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------
class CheckinStore:
    """In-memory list of check-ins mirrored to a JSON file. One entry per (astronaut, Sol): resubmitting replaces."""

    def __init__(self, path: Path = DEFAULT_STORE_PATH):
        self.path = Path(path)
        self._lock = threading.Lock()
        self._entries: List[Dict[str, Any]] = self._load()

    def _load(self) -> List[Dict[str, Any]]:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            entries = data.get("checkins", []) if isinstance(data, dict) else []
            return [e for e in entries if isinstance(e, dict) and "astronaut_id" in e and "sol" in e]
        except FileNotFoundError:
            return []
        except (OSError, ValueError):
            # unreadable file: keep it aside for inspection and start empty
            try:
                os.replace(self.path, self.path.with_suffix(".corrupt.json"))
            except OSError:
                pass
            return []

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"checkins": self._entries}, indent=1), encoding="utf-8")
        os.replace(tmp, self.path)

    def upsert(self, entry: Dict[str, Any]) -> None:
        with self._lock:
            self._entries = [e for e in self._entries
                             if not (e["astronaut_id"] == entry["astronaut_id"] and e["sol"] == entry["sol"])]
            self._entries.append(entry)
            self._entries.sort(key=lambda e: (e["astronaut_id"], e["sol"]))
            self._save()

    def for_astronaut(self, astronaut_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(e) for e in self._entries if e["astronaut_id"] == astronaut_id]


def streak(sols: List[int]) -> Dict[str, Any]:
    """Consecutive Sols with a check-in, ending at the most recent check-in."""
    uniq = sorted(set(sols))
    if not uniq:
        return {"current_sols": 0, "last_sol": None, "total_checkins": 0}
    n = 1
    for a, b in zip(reversed(uniq[:-1]), reversed(uniq[1:])):
        if b - a != 1:
            break
        n += 1
    return {"current_sols": n, "last_sol": uniq[-1], "total_checkins": len(uniq)}


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class CheckinService:
    def __init__(self, store: Optional[CheckinStore] = None, crew_service: Any = None):
        self.store = store if store is not None else CheckinStore()
        self.crew_service = crew_service      # CrewHealthService, for synthetic history + nutrition forecast

    # --- personal baseline -------------------------------------------------
    def _synthetic_history(self, astronaut_id: str) -> Dict[str, List[float]]:
        """Personal-baseline window (Sols 0..baseline_sols-1, nominal scenario) of the simulated crew member."""
        if self.crew_service is None:
            return {}
        sc = self.crew_service.build_scenario(failure_enabled=False)
        if astronaut_id not in sc.crew:
            return {}
        df = self.crew_service.get_analysis(sc).data.crew_df
        g = df[(df.astronaut == astronaut_id) & (df.sol < sc.baseline_sols)]
        return {field: [float(v) for v in g[col]] for field, col in SYNTHETIC_HISTORY_COLUMNS.items()}

    @staticmethod
    def _field_baseline(field: str, value: float, own: List[float], synthetic: List[float],
                        cfg: Dict[str, Any]) -> Dict[str, Any]:
        priors = synthetic + own
        need = cfg["min_prior_entries"]
        base = {"field": field, "prior_entries": len(priors), "own_checkins": len(own),
                "synthetic_entries": len(synthetic), "needed": need}
        if len(priors) < need:
            return {**base, "status": "building", "flag": False, "mean": None, "sd": None, "z": None}
        mean = statistics.fmean(priors)
        sd = max(statistics.stdev(priors), cfg["sd_floor"][field])
        z = (value - mean) / sd
        return {**base, "status": "ready", "flag": bool(abs(z) >= cfg["flag_abs_z"]),
                "mean": round(mean, 2), "sd": round(sd, 2), "z": round(z, 2)}

    # --- nutrition forecast link ---------------------------------------------
    def nutrition_link(self, astronaut_id: str, sol: int) -> Optional[Dict[str, Any]]:
        if self.crew_service is None:
            return None
        sc = self.crew_service.build_scenario()
        if astronaut_id not in sc.crew:
            return None
        s = min(sol, sc.mission_sols - 1)
        snap = self.crew_service.crew_snapshot(sc, s)
        member = next(c for c in snap["crew"] if c["astronaut_id"] == astronaut_id)
        a = member.get("assessment")
        base = {"scenario_sol": s, "forecast_status": member["status"],
                "source": "Food & Vitamins / Crew Health forecast (synthetic mission scenario: cooling failure at "
                          f"Sol {sc.cooling_failure_sol})"}
        if member["status"] not in ("WATCH", "ACT") or not a or not a.get("nutrient"):
            return {**base, "active": False, "nutrient": None,
                    "message": "Your vitamin forecast has no active alert."}
        label = NUTRIENT_LABELS.get(a["nutrient"], a["nutrient"])
        rec = a.get("recommendation")
        s2r = a.get("sols_to_risk")
        when = f"about {s2r:.0f} Sols until your body stores reach the risk level" if s2r is not None else "trending down"
        eat = (f"{rec['food_name']}, {rec['servings_per_sol']:.1f} servings per Sol" if rec and rec.get("servings_per_sol")
               else a.get("action", "follow the Food & Vitamins plan"))
        return {**base, "active": True, "nutrient": a["nutrient"], "nutrient_label": label,
                "sols_to_risk": s2r, "food": rec["food_name"] if rec else None,
                "servings_per_sol": rec.get("servings_per_sol") if rec else None,
                "message": f"Your {label} forecast is low ({when}). Eat: {eat}."}

    # --- evaluation ----------------------------------------------------------
    def evaluate(self, payload: CheckinIn, prior_entries: List[Dict[str, Any]],
                 synthetic: Optional[Dict[str, List[float]]] = None) -> Dict[str, Any]:
        """Pure evaluation of one check-in against reference ranges and earlier entries (no side effects)."""
        ranges = load_ranges()
        sources, bcfg = ranges["sources"], ranges["baseline"]
        synthetic = synthetic or {}
        values = payload.model_dump()
        prior = [e for e in prior_entries if e["sol"] < payload.sol]

        indicators = []
        for key, ind in ranges["indicators"].items():
            fields = ind["fields"]
            # layer 1: reference range (worst colour across fields, e.g. systolic vs diastolic)
            color, hit, hit_field = "green", None, None
            for f in fields:
                c, t = classify(values[f], ind["thresholds"][f])
                if COLOR_RANK[c] > COLOR_RANK[color]:
                    color, hit, hit_field = c, t, f
            band = _band_key(color, hit)
            g = ind["guidance"]

            # layer 2: personal baseline
            per_field = {f: self._field_baseline(f, values[f], [float(e[f]) for e in prior if f in e],
                                                 synthetic.get(f, []), bcfg) for f in fields}
            building = any(b["status"] == "building" for b in per_field.values())
            flagged = [b for b in per_field.values() if b["flag"]]
            if flagged:
                parts = [f"{'higher' if b['z'] > 0 else 'lower'} than your usual "
                         f"{b['mean']:.1f}{'' if ind['unit'] == '1-5' else ' ' + ind['unit']}"
                         f"{' (' + b['field'].split('_')[0] + ')' if len(fields) > 1 else ''} (z {b['z']:+.1f})"
                         for b in flagged]
                bmsg = "Different from your normal: " + "; ".join(parts) + "."
            elif building:
                n = min(b["prior_entries"] for b in per_field.values())
                bmsg = f"Building your baseline ({n}/{bcfg['min_prior_entries']} check-ins)."
            else:
                bmsg = "Within your normal range."

            escalate = color == "red"
            what_to_do = g["what_to_do"][band]
            if flagged and color == "green":
                what_to_do = ("In range, but unusual for you: re-measure, and note what changed "
                              "(sleep, food, exercise, stress). Check again next Sol.")
            if len(fields) == 1:
                value: Any = values[fields[0]]
                display = f"{value:g} {ind['unit']}"
            else:
                value = {f: values[f] for f in fields}
                display = f"{values['systolic_mmHg']:g}/{values['diastolic_mmHg']:g} {ind['unit']}"
            indicators.append({
                "key": key,
                "label": ind["label"],
                "unit": ind["unit"],
                "value": value,
                "display_value": display,
                "status_color": color,
                "status": COLOR_TO_STATUS[color],
                "band": band,
                "triggered_by": None if hit is None else {"field": hit_field, **{k: hit[k] for k in
                                                          ("direction", "value", "inclusive", "source", "status")}},
                "meaning": g["meaning"][band],
                "reference": {"range_text": ind["range_text"], "thresholds": _source_rows(ind),
                              "sources": _sources_for(ind, sources)},
                "guidance": {
                    "how_to_measure": g["how_to_measure"],
                    "why_it_matters_in_space": g["why_it_matters_in_space"],
                    "hazard": g["hazard"],
                    "what_to_do": what_to_do,
                    "escalate_to_flight_surgeon": {
                        "required": escalate,
                        "reason": g["escalate_reason"][band] if escalate else
                        "Not needed for this reading; follow the self-care step and re-check next Sol.",
                    },
                },
                "personal_baseline": {"status": "building" if building else "ready",
                                      "flag": bool(flagged), "message": bmsg, "fields": per_field},
            })

        reds = [i for i in indicators if i["status_color"] == "red"]
        ambers = [i for i in indicators if i["status_color"] == "amber"]
        flags = [i for i in indicators if i["personal_baseline"]["flag"]]
        reasons = ([f"{i['label']}: RED, {i['meaning']}" for i in reds]
                   + [f"{i['label']}: AMBER, {i['meaning']}" for i in ambers]
                   + [f"{i['label']}: {i['personal_baseline']['message']}" for i in flags
                      if i["status_color"] == "green"])
        if reds:
            overall = {"status": "ACT", "color": "red", "contact_flight_surgeon": True,
                       "headline": "Contact the flight surgeon today.",
                       "what_to_do": "Follow the steps on the red cards now, then send today's numbers to the flight surgeon."}
        elif ambers or flags:
            overall = {"status": "WATCH", "color": "amber", "contact_flight_surgeon": False,
                       "headline": "Take care of yourself today.",
                       "what_to_do": "Do the self-care steps on the amber cards and check in again next Sol. "
                                     "If it is still amber in 3 check-ins, tell the flight surgeon."}
        else:
            overall = {"status": "NOMINAL", "color": "green", "contact_flight_surgeon": False,
                       "headline": "All good. See you next Sol.",
                       "what_to_do": "Nothing to do. Keep your routine."}
        overall["reasons"] = reasons
        return {"overall": overall, "indicators": indicators}

    # --- public API ----------------------------------------------------------
    @staticmethod
    def status_rules() -> Dict[str, str]:
        return {
            "ACT": "any indicator red -> contact the flight surgeon",
            "WATCH": "any indicator amber, or any value different from your personal baseline (|z| >= 2) -> self-care action",
            "NOMINAL": "otherwise",
            "baseline": f"personal baseline needs >= {load_ranges()['baseline']['min_prior_entries']} earlier entries",
        }

    def submit(self, payload: CheckinIn) -> Dict[str, Any]:
        own = self.store.for_astronaut(payload.astronaut_id)
        synthetic = self._synthetic_history(payload.astronaut_id)
        result = self.evaluate(payload, own, synthetic)
        entry = {**payload.model_dump(), "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                 "overall_status": result["overall"]["status"],
                 "colors": {i["key"]: i["status_color"] for i in result["indicators"]},
                 "baseline_flags": [i["key"] for i in result["indicators"] if i["personal_baseline"]["flag"]]}
        self.store.upsert(entry)
        sols = [e["sol"] for e in self.store.for_astronaut(payload.astronaut_id)]
        return {
            "disclaimer": load_ranges()["meta"]["disclaimer"],
            "astronaut_id": payload.astronaut_id,
            "sol": payload.sol,
            "recorded_at": entry["recorded_at"],
            "notes": payload.notes,
            **result,
            "nutrition_link": self.nutrition_link(payload.astronaut_id, payload.sol),
            "streak": streak(sols),
            "baseline_history": {"synthetic_entries": {f: len(v) for f, v in synthetic.items()},
                                 "synthetic_note": ("Simulated crew member: heart rate and sleep baselines also use the "
                                                    "synthetic Sols 0-20 personal-baseline window.") if synthetic else None},
            "status_rules": self.status_rules(),
            "next_checkin": f"Sol {payload.sol + 1}: {load_ranges()['routine']['when']}",
        }

    def history(self, astronaut_id: str) -> Dict[str, Any]:
        entries = self.store.for_astronaut(astronaut_id)
        return {
            "disclaimer": load_ranges()["meta"]["disclaimer"],
            "astronaut_id": astronaut_id,
            "count": len(entries),
            "streak": streak([e["sol"] for e in entries]),
            "checkins": entries,
        }

    @staticmethod
    def guide() -> Dict[str, Any]:
        """Form metadata: how to measure, reference ranges, sources, routine, input limits."""
        r = load_ranges()
        return {
            "disclaimer": r["meta"]["disclaimer"],
            "routine": r["routine"],
            "baseline": {"min_prior_entries": r["baseline"]["min_prior_entries"],
                         "flag_abs_z": r["baseline"]["flag_abs_z"]},
            "status_rules": CheckinService.status_rules(),
            "input_limits": {k: {"min": lo, "max": hi} for k, (lo, hi) in INPUT_LIMITS.items()},
            "indicators": [
                {"key": k, "label": ind["label"], "unit": ind["unit"], "fields": ind["fields"],
                 "range_text": ind["range_text"], "how_to_measure": ind["guidance"]["how_to_measure"],
                 "why_it_matters_in_space": ind["guidance"]["why_it_matters_in_space"],
                 "hazard": ind["guidance"]["hazard"], "thresholds": _source_rows(ind),
                 "sources": _sources_for(ind, r["sources"])}
                for k, ind in r["indicators"].items()
            ],
        }
