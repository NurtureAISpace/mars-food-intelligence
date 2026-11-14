"""
Crew Health orchestration: scenario -> synthetic crew -> anomaly analysis -> JSON payloads.

The full mission analysis is computed once per (normalized) scenario and cached in memory.
The `sol` query parameter only selects a point in time: every value reported at a Sol is
computed from data up to that Sol (z-scores, turnover estimate, forecast), never from later Sols.
"""

import math
import threading
from collections import OrderedDict
from typing import Dict, Any, List, Optional

import numpy as np

from app.ml import DATA_PROVENANCE
from app.ml.anomaly import (CrewAnalysis, analyze_crew, explain, STATUS_RANK, WATCH_Z, WATCH_SOLS_TO_RISK,
                            ACT_SOLS_TO_RISK, VITD, VITALS_REFERENCE_LAG_SOLS)
from app.ml.crew_data import CrewScenario, generate_crew
from app.ml.literature_check import run_checks, summary
from app.core.constants import SOL_IN_EARTH_DAYS
from app.ml.params import parameter_provenance, parameter_table, load_params_file, param_entry, sources
from app.ml.physiology import BIOMARKERS, NUTRIENTS, VITALS, VITAMIN_D

_CACHE_MAX = 16

SCENARIO_TYPE = "hypothetical stress test"

# Demo presets. Physics / literature parameters / detector thresholds are identical in every preset;
# only the hypothetical cooling-failure event changes.
SCENARIO_PRESETS: Dict[str, Dict[str, Any]] = {
    "nominal": {
        "label": "Normal mission",
        "description": ("No equipment failure. Food storage stays cold for the whole 450-Sol mission, so vitamins "
                        "in the packaged food degrade only at the normal rate."),
        "params": {"failure_enabled": False},
    },
    "mild_cooling_failure": {
        "label": "Small storage failure",
        "description": ("At Sol 150 the food-storage cooling fails for 45 Sols and peaks at 29.5 °C; the greenhouse "
                        "goes offline. Vitamins in stored food break down faster. This is the default scenario."),
        "params": {"failure_enabled": True, "cooling_failure_sol": 150, "failure_duration_sols": 45,
                   "failure_peak_temp_c": 29.5},
    },
    "severe_cooling_failure": {
        "label": "Major storage failure",
        "description": ("At Sol 150 the food-storage cooling fails for 60 Sols and peaks at 30 °C; the greenhouse goes "
                        "offline. This is the mildest failure (searched over 60-240 Sols x 30-45 °C) in which an "
                        "astronaut's vitamin B1 body store actually falls below its risk threshold."),
        "params": {"failure_enabled": True, "cooling_failure_sol": 150, "failure_duration_sols": 60,
                   "failure_peak_temp_c": 30.0},
    },
}
DEFAULT_PRESET = "mild_cooling_failure"

# Mission destinations. A destination changes ONLY the mission length, i.e. the forecast horizon: how many Sols of
# the same simulated crew are reported. Physics, parameters and detector thresholds are identical for all three.
# Gravity and resupply are context labels only; the model simulates neither.
DESTINATIONS: List[Dict[str, str]] = [
    {"id": "earth_orbit", "label": "Earth orbit", "length_param": "mission.earth_orbit_days", "unit": "day",
     "gravity": "Microgravity", "resupply": "Yes"},
    {"id": "moon", "label": "Moon", "length_param": "mission.moon_days", "unit": "day",
     "gravity": "1/6 g", "resupply": "Short trip"},
    {"id": "mars", "label": "Mars", "length_param": "mission.mars_sols", "unit": "sol",
     "gravity": "1/3 g", "resupply": "None"},
]
DEFAULT_DESTINATION = "mars"
HORIZON_NUTRIENTS = ("vitamin_c", "thiamine_b1", VITD)


def _day(sol: int) -> int:
    """Mission day number for a model Sol (1 Sol = 1.02749 Earth days)."""
    return int(round(sol * SOL_IN_EARTH_DAYS))


def _when(sol: Optional[int]) -> Optional[Dict[str, int]]:
    return None if sol is None else {"sol": int(sol), "day": _day(int(sol))}


def _clean(x: Any, nd: int = 3) -> Any:
    """JSON-safe scalar: numpy -> python, NaN/inf -> None, floats rounded."""
    if x is None:
        return None
    if isinstance(x, (np.bool_, bool)):
        return bool(x)
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        return round(float(x), nd) if math.isfinite(x) else None
    return x


class CrewHealthService:
    def __init__(self):
        self._cache: "OrderedDict[CrewScenario, CrewAnalysis]" = OrderedDict()
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Scenario + cache
    # ------------------------------------------------------------------
    @staticmethod
    def build_scenario(
        failure_enabled: bool = True,
        cooling_failure_sol: int = 150,
        failure_duration_sols: int = 45,
        failure_peak_temp_c: float = 29.5,
    ) -> CrewScenario:
        return CrewScenario(
            failure_enabled=failure_enabled,
            cooling_failure_sol=cooling_failure_sol,
            failure_duration_sols=failure_duration_sols,
            failure_peak_temp_c=failure_peak_temp_c,
        ).normalized()

    @classmethod
    def preset_scenario(cls, name: str) -> CrewScenario:
        if name not in SCENARIO_PRESETS:
            raise KeyError(f"Unknown scenario '{name}'. Valid: {list(SCENARIO_PRESETS)}")
        return cls.build_scenario(**SCENARIO_PRESETS[name]["params"])

    @classmethod
    def preset_name(cls, scenario: CrewScenario) -> Optional[str]:
        key = scenario.normalized()
        return next((n for n in SCENARIO_PRESETS if cls.preset_scenario(n) == key), None)

    @classmethod
    def scenarios(cls) -> Dict[str, Any]:
        return {
            "default": DEFAULT_PRESET,
            "scenarios": [
                {"id": n, "label": p["label"], "description": p["description"], "scenario_type": SCENARIO_TYPE,
                 "parameters": cls._scenario_dict(cls.preset_scenario(n))}
                for n, p in SCENARIO_PRESETS.items()
            ],
            "default_destination": DEFAULT_DESTINATION,
            "destinations": cls.destinations(),
        }

    @staticmethod
    def destinations() -> List[Dict[str, Any]]:
        """Destination cards: mission length (with source + status) and the matching horizon in model Sols."""
        srcs = sources()
        max_sols = CrewScenario().mission_sols
        out = []
        for d in DESTINATIONS:
            e = param_entry(d["length_param"])
            if d["unit"] == "sol":
                horizon = int(e["value"])
            else:
                horizon = int(round(float(e["value"]) / SOL_IN_EARTH_DAYS))
            horizon = max(1, min(horizon, max_sols))
            out.append({
                "id": d["id"], "label": d["label"], "unit": d["unit"],
                "mission_length": e["value"], "mission_length_unit": e["unit"],
                "horizon_sols": horizon, "horizon_days": _day(horizon),
                "gravity": d["gravity"], "resupply": d["resupply"],
                "status": e["status"], "source": e["source"],
                "source_citation": srcs.get(e["source"], {}).get("citation"),
                "where_in_source": e["where_in_source"], "note": e["note"],
                "parameter": d["length_param"],
            })
        return out

    @staticmethod
    def _horizon(analysis: CrewAnalysis, sol: int, horizon_sols: int) -> Dict[str, Any]:
        """Mission-level forecast summary for a horizon (mission length). Uses only alerts raised up to `sol`
        (causal); a problem counts only if it is forecast to start within the mission."""
        sc = analysis.data.scenario
        last = horizon_sols - 1
        raised = [a for a in analysis.alerts
                  if a["sol"] <= sol and a.get("nutrient") and a.get("projected_risk_sol") is not None]
        in_mission = [a for a in raised if a["projected_risk_sol"] <= last]
        focus = min(in_mission, key=lambda a: (a["sol"], a["projected_risk_sol"]), default=None)

        per_astronaut = []
        for astronaut in sc.crew:
            res = analysis.astronauts[astronaut]
            vit = {}
            for n in HORIZON_NUTRIENTS:
                forecast = min((a["projected_risk_sol"] for a in in_mission
                                if a["astronaut_id"] == astronaut and a["nutrient"] == n), default=None)
                crossed = res.threshold_crossing_sol.get(n)
                crossed = crossed if crossed is not None and crossed <= sol else None
                low = forecast if forecast is not None else crossed
                vit[n] = {"runs_low": _when(low),
                          "basis": None if low is None else ("forecast" if forecast is not None else "simulated")}
            per_astronaut.append({"astronaut_id": astronaut, "vitamins": vit})

        any_low = any(v["runs_low"] for p in per_astronaut for v in p["vitamins"].values())
        first = None
        if focus is not None:
            w, p = focus["sol"], focus["projected_risk_sol"]
            first = {"astronaut_id": focus["astronaut_id"], "nutrient": focus["nutrient"],
                     "warning": _when(w), "problem": _when(p),
                     "lead_sols": int(p - w), "lead_days": _day(p) - _day(w),
                     "recommendation": focus.get("recommendation")}
        cooling = None
        if sc.failure_enabled:
            start, end = sc.cooling_failure_sol, min(sc.mission_sols, sc.cooling_failure_sol + sc.failure_duration_sols)
            cooling = {"start": _when(start), "end": _when(min(end, horizon_sols)), "duration_sols": end - start,
                       "duration_days": _day(end) - _day(start),
                       "peak_temp_c": sc.failure_peak_temp_c, "in_mission": start <= last}
        return {
            "horizon_sols": horizon_sols,
            "horizon_days": _day(horizon_sols),
            "last": _when(last),
            "assessed": _when(sol),
            "sol_in_earth_days": SOL_IN_EARTH_DAYS,
            "first_warning": first,
            "vitamins_last_whole_mission": not any_low,
            "cooling_failure": cooling,
            "per_astronaut": per_astronaut,
            "note": ("Mission length only changes how many Sols of the same simulation are reported; "
                     "the model is unchanged. Resupply and gravity are not simulated."),
        }

    def get_analysis(self, scenario: CrewScenario) -> CrewAnalysis:
        key = scenario.normalized()
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
        analysis = analyze_crew(generate_crew(key))
        with self._lock:
            self._cache[key] = analysis
            self._cache.move_to_end(key)
            while len(self._cache) > _CACHE_MAX:
                self._cache.popitem(last=False)
        return analysis

    def cache_size(self) -> int:
        return len(self._cache)

    # ------------------------------------------------------------------
    # Payload helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _scenario_dict(sc: CrewScenario) -> Dict[str, Any]:
        return {
            "seed": sc.seed,
            "mission_sols": sc.mission_sols,
            "baseline_sols": sc.baseline_sols,
            "calibration_sols": sc.calibration_sols,
            "failure_enabled": sc.failure_enabled,
            "cooling_failure_sol": sc.cooling_failure_sol if sc.failure_enabled else None,
            "failure_duration_sols": sc.failure_duration_sols if sc.failure_enabled else None,
            "failure_peak_temp_c": sc.failure_peak_temp_c if sc.failure_enabled else None,
            "greenhouse_outage_sols": sc.greenhouse_outage_sols if sc.failure_enabled else None,
            "nominal_storage_temp_c": sc.nominal_storage_temp_c,
            "crew": list(sc.crew),
        }

    @staticmethod
    def _rules() -> Dict[str, Any]:
        return {
            "ACT": f"forecast Sols-to-risk <= {ACT_SOLS_TO_RISK} (vitamin C, B1 pools or vitamin D status)",
            "WATCH": (f"forecast Sols-to-risk <= {WATCH_SOLS_TO_RISK} or |z| of any vital >= {WATCH_Z} "
                      f"(vs a trend-following personal reference lagged {VITALS_REFERENCE_LAG_SOLS} Sols)"),
            "driver": (f"largest contributor relative to its rule threshold: {WATCH_SOLS_TO_RISK} / Sols-to-risk "
                       f"(nutrient forecast) vs |z| / {WATCH_Z} (vital); ACT is always forecast-driven"),
            "NOMINAL": "otherwise",
            "CALIBRATING": "personal baseline + trend window not yet available",
        }

    @staticmethod
    def _nutrient_meta() -> Dict[str, Any]:
        return {n: {"label": c["label"], "pool_max_mg": c["pool_max_mg"], "risk_threshold_mg": c["risk_threshold_mg"],
                    "absorption": c["absorption"], "population_turnover_per_day": c["turnover_per_day"],
                    "requirement_mg_day": c["requirement_mg_day"]}
                for n, c in NUTRIENTS.items()}

    @staticmethod
    def _vitamin_d_meta() -> Dict[str, Any]:
        vd = VITAMIN_D
        return {
            "label": vd["label"],
            "status_unit": vd["status_unit"],
            "intake_unit": vd["intake_unit"],
            "risk_threshold_nmol_l": vd["risk_threshold_nmol_l"],
            "optimal_nmol_l": vd["optimal_nmol_l"],
            "requirement_ug_day": vd["requirement_ug_day"],
            "supplement_ug_day": vd["supplement_ug_day"],
            "iss_decline_rate_per_day": vd["decline_rate_per_day_iss"],
            "uv_synthesis": False,
            "model": "25-OH-D declines exponentially (no UV in flight); rate scales with intake shortfall vs 25 ug/day",
        }

    @staticmethod
    def _events(sc: CrewScenario) -> Dict[str, Any]:
        if not sc.failure_enabled:
            return {"cooling_failure": None, "greenhouse_outage": None}
        return {
            "cooling_failure": {"start_sol": sc.cooling_failure_sol,
                                "end_sol": min(sc.mission_sols, sc.cooling_failure_sol + sc.failure_duration_sols),
                                "peak_temp_c": sc.failure_peak_temp_c},
            "greenhouse_outage": {"start_sol": sc.cooling_failure_sol,
                                  "end_sol": min(sc.mission_sols, sc.cooling_failure_sol + sc.greenhouse_outage_sols)},
        }

    @staticmethod
    def _horizon_sols(sc: CrewScenario, horizon_sols: Optional[int]) -> int:
        if horizon_sols is None:
            return sc.mission_sols
        return int(min(max(horizon_sols, 1), sc.mission_sols))

    def _clamp_sol(self, sc: CrewScenario, sol: Optional[int], horizon_sols: Optional[int] = None) -> int:
        last = self._horizon_sols(sc, horizon_sols) - 1
        if sol is None:
            return last
        return int(min(max(sol, 0), last))

    def _base(self, analysis: CrewAnalysis) -> Dict[str, Any]:
        sc = analysis.data.scenario
        name = self.preset_name(sc)
        preset = None if name is None else {
            "id": name, "label": SCENARIO_PRESETS[name]["label"],
            "description": SCENARIO_PRESETS[name]["description"], "scenario_type": SCENARIO_TYPE}
        return {"data_provenance": DATA_PROVENANCE, "parameter_sources": parameter_provenance(),
                "scenario": self._scenario_dict(sc), "scenario_preset": preset, "events": self._events(sc)}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def crew_snapshot(self, scenario: CrewScenario, sol: Optional[int] = None,
                      horizon_sols: Optional[int] = None) -> Dict[str, Any]:
        """Snapshot at `sol`. `horizon_sols` (mission length, default: full simulated mission) caps `sol`, sets its
        default to the last mission Sol and adds the `horizon` forecast summary; the model is unchanged."""
        analysis = self.get_analysis(scenario)
        sc = analysis.data.scenario
        horizon = self._horizon_sols(sc, horizon_sols)
        sol = self._clamp_sol(sc, sol, horizon)
        crew: List[Dict[str, Any]] = []
        for astronaut in sc.crew:
            res = analysis.astronauts[astronaut]
            row = res.frame.iloc[sol]
            forecast = {
                n: {
                    "pool_mg": _clean(row[f"{n}_pool_mg"], 2),
                    "pool_pct_of_max": _clean(100.0 * row[f"{n}_pool_mg"] / NUTRIENTS[n]["pool_max_mg"], 1),
                    "personal_turnover_per_sol": _clean(row[f"{n}_k_per_sol"], 5),
                    "equilibrium_pool_mg": _clean(row[f"{n}_pool_eq_mg"], 2),
                    "sols_to_risk": _clean(row[f"{n}_sols_to_risk"], 1),
                }
                for n in NUTRIENTS
            }
            d_col = VITAMIN_D["status_col"]
            d_now, d_pre = float(row[d_col]), float(res.frame[d_col].iloc[0])
            vitamin_d = {
                "status_nmol_l": _clean(d_now, 2),
                "preflight_nmol_l": _clean(d_pre, 2),
                "pct_change_vs_preflight": _clean(100.0 * (d_now - d_pre) / d_pre, 1),
                "intake_ug_day": _clean(row[VITAMIN_D["intake_col"]], 2),
                "personal_decline_per_sol": _clean(row[f"{VITD}_k_per_sol"], 5),
                "sols_to_risk": _clean(row[f"{VITD}_sols_to_risk"], 1),
                "z": _clean(row[f"z_{d_col}"], 2),
            }
            crew.append({
                "astronaut_id": astronaut,
                "status": row["status"],
                "worst_nutrient": row["worst_nutrient"],
                "driver_kind": row["driver_kind"],
                "driver_signal": row["driver_signal"],
                "sols_to_risk": _clean(row["sols_to_risk"], 1),
                "top_driver": row["top_driver"],
                "driver_z": _clean(row["driver_z"], 2),
                "anomaly_score": _clean(row["anomaly_score"], 3),
                "iso_outlier": bool(row["iso_outlier"]),
                "vitals": {v: _clean(row[v], 2) for v in VITALS},
                "z_scores": {v: _clean(row[f"z_{v}"], 2) for v in VITALS},
                "nutrients": forecast,
                "vitamin_d": vitamin_d,
                "biomarker_z_scores": {b: _clean(row[f"z_{b}"], 2) for b in BIOMARKERS},
                "first_watch_sol": res.first_status.get("WATCH") if res.first_status.get("WATCH", sol + 1) <= sol else None,
                "first_act_sol": res.first_status.get("ACT") if res.first_status.get("ACT", sol + 1) <= sol else None,
                "assessment": explain(res, analysis.data, sol) if row["status"] in ("WATCH", "ACT") else None,
            })
        counts = {s: sum(1 for c in crew if c["status"] == s) for s in STATUS_RANK}
        worst = max((c["status"] for c in crew), key=lambda s: STATUS_RANK[s])
        return {
            **self._base(analysis),
            "sol": sol,
            "storage_temp_c": _clean(analysis.data.storage_temp_c[sol], 1),
            "greenhouse_online": not bool(analysis.data.greenhouse_down[sol]),
            "crew_status": worst,
            "status_counts": counts,
            "status_rules": self._rules(),
            "nutrients": self._nutrient_meta(),
            "vitamin_d_meta": self._vitamin_d_meta(),
            "crew": crew,
            "active_alerts": [a for a in analysis.alerts if a["sol"] <= sol],
            "horizon": self._horizon(analysis, sol, horizon),
        }

    def astronaut_timeline(self, scenario: CrewScenario, astronaut_id: str) -> Dict[str, Any]:
        analysis = self.get_analysis(scenario)
        if astronaut_id not in analysis.astronauts:
            raise KeyError(f"Unknown astronaut_id '{astronaut_id}'. Valid: {list(analysis.astronauts)}")
        res = analysis.astronauts[astronaut_id]
        fr = res.frame
        cols = (["sol", "storage_temp_c"]
                + [f"{n}_{s}" for n in NUTRIENTS for s in ("intake_mg", "pool_mg", "sols_to_risk")]
                + [VITAMIN_D["intake_col"], VITAMIN_D["status_col"], f"z_{VITAMIN_D['status_col']}", f"{VITD}_sols_to_risk"]
                + VITALS + [f"z_{v}" for v in VITALS] + [f"ref_{v}" for v in VITALS]
                + ["anomaly_score", "status", "worst_nutrient", "sols_to_risk", "top_driver", "driver_z",
                   "driver_kind", "driver_signal"])
        records = [{c: _clean(v) for c, v in zip(cols, rec)} for rec in fr[cols].itertuples(index=False, name=None)]
        baseline = {
            v: {"mean": _clean(res.baseline.mean[v]), "sd": _clean(res.baseline.sd[v]),
                "band_low": _clean(res.baseline.mean[v] - WATCH_Z * res.baseline.sd[v]),
                "band_high": _clean(res.baseline.mean[v] + WATCH_Z * res.baseline.sd[v])}
            for v in VITALS
        }
        return {
            **self._base(analysis),
            "astronaut_id": astronaut_id,
            "profile": {k: _clean(v) for k, v in analysis.data.profiles[astronaut_id].items()},
            "nutrients": self._nutrient_meta(),
            "vitamin_d_meta": self._vitamin_d_meta(),
            "baseline": baseline,
            "vitals_reference_lag_sols": VITALS_REFERENCE_LAG_SOLS,
            "pool_baseline_mg": {n: _clean(v, 2) for n, v in res.pool_baseline.items()},
            "first_watch_sol": res.first_status.get("WATCH"),
            "first_act_sol": res.first_status.get("ACT"),
            "threshold_crossing_sol": res.threshold_crossing_sol,
            "alerts": res.alerts,
            "timeline": records,
        }

    @staticmethod
    def parameters() -> Dict[str, Any]:
        """Every model parameter with source/status, plus the literature range check."""
        checks = run_checks()
        meta = load_params_file()["meta"]
        return {
            "data_provenance": DATA_PROVENANCE,
            "parameter_sources": parameter_provenance(),
            "status_definitions": meta["status_definitions"],
            "parameters": parameter_table(),
            "literature_check": {"summary": summary(checks), "checks": checks},
        }

    def alerts(self, scenario: CrewScenario, sol: Optional[int] = None,
               horizon_sols: Optional[int] = None) -> Dict[str, Any]:
        analysis = self.get_analysis(scenario)
        sc = analysis.data.scenario
        horizon = self._horizon_sols(sc, horizon_sols)
        sol = self._clamp_sol(sc, sol, horizon)
        alerts = [a for a in analysis.alerts if a["sol"] <= sol]
        return {
            **self._base(analysis),
            "sol": sol,
            "count": len(alerts),
            "status_rules": self._rules(),
            "alerts": alerts,
            "horizon": self._horizon(analysis, sol, horizon),
        }
