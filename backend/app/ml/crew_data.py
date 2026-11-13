"""
Scenario configuration and seeded synthetic crew generator.

Pipeline (identical to backend/scripts prototype):
    storage temperature profile -> Arrhenius rate k(T) per packaged item
    -> retention = exp(-integral k dt)  (a past excursion keeps affecting later Sols)
    -> available vitamin intake per astronaut per Sol (packaged + fresh greenhouse crops)
    -> synthetic astronaut: appetite, metabolic variation, body pools, vital signs

All crew physiology data is synthetic.
"""

from dataclasses import dataclass, field, replace, fields
from functools import lru_cache
from typing import Dict, Any, Tuple

import numpy as np
import pandas as pd

from app.core.constants import SOL_IN_EARTH_DAYS
from app.core.scientific_models import arrhenius_rate_constant
from app.pipeline.ingest import load_raw_catalog
from app.ml.physiology import NUTRIENTS, population_turnover_per_sol, pool_step

# Daily ration per astronaut (servings), built from the existing food catalog
PACKAGED_MENU: Dict[str, float] = {"FD-001": 1, "FD-002": 1, "FD-003": 1, "TH-001": 1, "TH-002": 1, "NF-001": 1}
FRESH_MENU: Dict[str, float] = {"BIO-002": 1.0, "BIO-001": 0.5}
FRESH_PREFIX = "BIO-"

# Per-Sol pull of body-mass noise back to the astronaut's baseline (AR(1) mean reversion).
# Prevents a pure random walk from drifting outside the personal baseline without any deficit.
BODY_MASS_REVERSION = 0.2


@dataclass(frozen=True)
class CrewScenario:
    seed: int = 42
    mission_sols: int = 450
    baseline_sols: int = 21                 # personal "normal" window per astronaut
    smoothing_sols: int = 7                 # rolling window for z-score smoothing
    trend_window_sols: int = 7              # recent intake window for the pool forecast

    nominal_storage_temp_c: float = 4.0
    failure_enabled: bool = True
    cooling_failure_sol: int = 150          # same default event as MissionSimulatorService
    failure_duration_sols: int = 45
    failure_peak_temp_c: float = 29.5
    greenhouse_outage_sols: int = 120       # fresh crops lost after the same power event
    ration_factor_after_event: float = 0.70  # crew switches to SURVIVAL rations
    appetite_factor_after_event: float = 0.85  # stress-related appetite reduction

    crew: Tuple[str, ...] = ("CDR-01", "PLT-02", "MS-03", "MS-04")

    def normalized(self) -> "CrewScenario":
        """Canonical form used as a cache key: failure parameters are irrelevant when disabled."""
        if self.failure_enabled:
            return self
        defaults = {f.name: f.default for f in fields(CrewScenario)}
        return replace(
            self,
            cooling_failure_sol=defaults["cooling_failure_sol"],
            failure_duration_sols=defaults["failure_duration_sols"],
            failure_peak_temp_c=defaults["failure_peak_temp_c"],
        )

    @property
    def calibration_sols(self) -> int:
        """First Sol at which a status can be computed (baseline + trend window)."""
        return self.baseline_sols + self.trend_window_sols


@dataclass
class CrewData:
    scenario: CrewScenario
    sols: np.ndarray
    storage_temp_c: np.ndarray
    event_active: np.ndarray
    greenhouse_down: np.ndarray
    retention: pd.DataFrame                     # all packaged catalog items, fraction of initial
    intake_available: Dict[str, np.ndarray]     # per astronaut per Sol before appetite (mg)
    crew_df: pd.DataFrame                       # one row per astronaut per Sol
    profiles: Dict[str, Dict[str, float]] = field(default_factory=dict)


@lru_cache(maxsize=1)
def _catalog_cached() -> Tuple[Tuple[str, Dict[str, Any]], ...]:
    return tuple((item["id"], item) for item in load_raw_catalog())


def load_catalog() -> Dict[str, Dict[str, Any]]:
    return dict(_catalog_cached())


def storage_temperature_profile(sc: CrewScenario) -> np.ndarray:
    sols = np.arange(sc.mission_sols)
    temp = np.full(sc.mission_sols, sc.nominal_storage_temp_c, dtype=float)
    if sc.failure_enabled:
        window = (sols >= sc.cooling_failure_sol) & (sols < sc.cooling_failure_sol + sc.failure_duration_sols)
        temp[window] = sc.failure_peak_temp_c
    return temp


def event_masks(sc: CrewScenario) -> Tuple[np.ndarray, np.ndarray]:
    """(event_active, greenhouse_down) boolean arrays; both all-False without a cooling failure."""
    sols = np.arange(sc.mission_sols)
    if not sc.failure_enabled:
        off = np.zeros(sc.mission_sols, dtype=bool)
        return off, off.copy()
    event_active = sols >= sc.cooling_failure_sol
    greenhouse_down = (sols >= sc.cooling_failure_sol) & (sols < sc.cooling_failure_sol + sc.greenhouse_outage_sols)
    return event_active, greenhouse_down


def packaged_retention(storage_temp_c: np.ndarray, catalog: Dict[str, Dict[str, Any]]) -> pd.DataFrame:
    """Vitamin retention per packaged item: exp(-cumulative k(T(t))), k from Arrhenius."""
    sols = np.arange(len(storage_temp_c))
    retention = {}
    for item_id, item in catalog.items():
        if item_id.startswith(FRESH_PREFIX):
            continue
        k_per_sol = np.array([
            arrhenius_rate_constant(item["arrhenius_A"], item["activation_energy_Ea_kJ_mol"], t) * SOL_IN_EARTH_DAYS
            for t in storage_temp_c
        ])
        # integrate k(T(t)) so a past excursion keeps affecting all later Sols
        retention[item_id] = np.exp(-np.concatenate([[0.0], np.cumsum(k_per_sol)[:-1]]))
    return pd.DataFrame(retention, index=sols)


def available_intake(
    sc: CrewScenario,
    catalog: Dict[str, Dict[str, Any]],
    retention: pd.DataFrame,
    event_active: np.ndarray,
    greenhouse_down: np.ndarray,
) -> Dict[str, np.ndarray]:
    ration_factor = np.where(event_active, sc.ration_factor_after_event, 1.0)
    intake = {}
    for nutrient, cfg in NUTRIENTS.items():
        f = cfg["catalog_field"]
        packaged = sum(catalog[i][f] * n * retention[i].values for i, n in PACKAGED_MENU.items())
        fresh = sum(catalog[i][f] * n for i, n in FRESH_MENU.items()) * (~greenhouse_down)
        intake[nutrient] = (packaged + fresh) * ration_factor
    return intake


def generate_crew(sc: CrewScenario = CrewScenario()) -> CrewData:
    """Seeded synthetic crew: same random draw order as the prototype, so results are reproducible."""
    rng = np.random.default_rng(sc.seed)
    catalog = load_catalog()
    sols = np.arange(sc.mission_sols)
    storage_temp_c = storage_temperature_profile(sc)
    event_active, greenhouse_down = event_masks(sc)
    retention = packaged_retention(storage_temp_c, catalog)
    intake_available = available_intake(sc, catalog, retention, event_active, greenhouse_down)

    rows = []
    profiles: Dict[str, Dict[str, float]] = {}
    for astronaut in sc.crew:
        profile = {
            "hr_rest": rng.normal(62, 5),
            "sleep_h": rng.normal(6.7, 0.4),
            "body_mass_kg": rng.normal(74, 8),
            "appetite": rng.uniform(0.65, 0.95),        # astronauts commonly under-eat
            "turnover_scale": rng.uniform(0.9, 1.25),   # individual metabolic variation
        }
        profiles[astronaut] = {k: float(v) for k, v in profile.items()}
        # start each pool at the astronaut's own steady state under the nominal diet
        pools = {
            n: min(cfg["pool_max_mg"],
                   cfg["absorption"] * intake_available[n][0] * profile["appetite"]
                   / population_turnover_per_sol(cfg, profile["turnover_scale"]))
            for n, cfg in NUTRIENTS.items()
        }
        # body mass = personal baseline + cumulative deficit-driven loss + mean-reverting (AR(1)) noise
        deficit_mass_loss = 0.0
        mass_noise = 0.0

        for sol in sols:
            record = {"astronaut": astronaut, "sol": int(sol)}
            deficit_signal = 0.0
            for nutrient, cfg in NUTRIENTS.items():
                appetite = profile["appetite"] * (sc.appetite_factor_after_event if event_active[sol] else 1.0)
                intake = intake_available[nutrient][sol] * appetite * rng.normal(1.0, 0.08)
                k = population_turnover_per_sol(cfg, profile["turnover_scale"])
                pools[nutrient] = pool_step(pools[nutrient], intake, k, cfg)
                record[f"{nutrient}_intake_mg"] = intake
                record[f"{nutrient}_pool_mg"] = pools[nutrient]
                # 0 while comfortably above threshold, 1 at threshold
                margin = (pools[nutrient] - cfg["risk_threshold_mg"]) / (cfg["pool_max_mg"] - cfg["risk_threshold_mg"])
                deficit_signal = max(deficit_signal, float(np.clip(1 - 2 * margin, 0, 1)))

            # Demonstration-only mapping from deficiency signal to observable vitals
            deficit_mass_loss -= 0.03 * deficit_signal
            mass_noise = (1 - BODY_MASS_REVERSION) * mass_noise + rng.normal(0, 0.04)
            body_mass = profile["body_mass_kg"] + deficit_mass_loss + mass_noise
            record["hr_rest"] = profile["hr_rest"] + 7 * deficit_signal + rng.normal(0, 1.8)
            record["sleep_h"] = profile["sleep_h"] - 0.9 * deficit_signal + rng.normal(0, 0.3)
            record["body_mass_kg"] = body_mass
            record["fatigue_score"] = float(np.clip(2 + 5 * deficit_signal + rng.normal(0, 0.7), 0, 10))
            rows.append(record)

    crew_df = pd.DataFrame(rows)
    crew_df["storage_temp_c"] = np.tile(storage_temp_c, len(sc.crew))
    return CrewData(
        scenario=sc,
        sols=sols,
        storage_temp_c=storage_temp_c,
        event_active=event_active,
        greenhouse_down=greenhouse_down,
        retention=retention,
        intake_available=intake_available,
        crew_df=crew_df,
        profiles=profiles,
    )
