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
                            ACT_SOLS_TO_RISK, VITD)
from app.ml.crew_data import CrewScenario, generate_crew
from app.ml.literature_check import run_checks, summary
from app.ml.params import parameter_provenance, parameter_table, load_params_file
from app.ml.physiology import BIOMARKERS, NUTRIENTS, VITALS, VITAMIN_D

_CACHE_MAX = 16


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
            "WATCH": f"forecast Sols-to-risk <= {WATCH_SOLS_TO_RISK} or |z| of any vital >= {WATCH_Z}",
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

    def _clamp_sol(self, sc: CrewScenario, sol: Optional[int]) -> int:
        if sol is None:
            return sc.mission_sols - 1
        return int(min(max(sol, 0), sc.mission_sols - 1))

    def _base(self, analysis: CrewAnalysis) -> Dict[str, Any]:
        sc = analysis.data.scenario
        return {"data_provenance": DATA_PROVENANCE, "parameter_sources": parameter_provenance(),
                "scenario": self._scenario_dict(sc), "events": self._events(sc)}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def crew_snapshot(self, scenario: CrewScenario, sol: Optional[int] = None) -> Dict[str, Any]:
        analysis = self.get_analysis(scenario)
        sc = analysis.data.scenario
        sol = self._clamp_sol(sc, sol)
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
                + VITALS + [f"z_{v}" for v in VITALS]
                + ["anomaly_score", "status", "worst_nutrient", "sols_to_risk", "top_driver", "driver_z"])
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

    def alerts(self, scenario: CrewScenario, sol: Optional[int] = None) -> Dict[str, Any]:
        analysis = self.get_analysis(scenario)
        sc = analysis.data.scenario
        sol = self._clamp_sol(sc, sol)
        alerts = [a for a in analysis.alerts if a["sol"] <= sol]
        return {
            **self._base(analysis),
            "sol": sol,
            "count": len(alerts),
            "status_rules": self._rules(),
            "alerts": alerts,
        }
