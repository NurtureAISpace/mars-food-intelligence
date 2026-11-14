"""
Scenario configuration and seeded synthetic crew generator.

Pipeline (identical to backend/scripts prototype):
    storage temperature profile -> nutrient-specific first-order rate k(T) per packaged item
        k(T) = k_ref * exp(-Ea/R * (1/T - 1/T_ref))
        k_ref from literature retention endpoints (thiamine: Goulette 2020; vitamin C: Cooper 2017),
        Ea from the food catalog (assumed)
    -> retention = exp(-integral k dt)  (a past excursion keeps affecting later Sols)
    -> available vitamin intake per astronaut per Sol (packaged + fresh greenhouse crops)
    -> synthetic astronaut: appetite, metabolic variation, body pools, vitamin D status, vital signs

All crew physiology data is synthetic. Every parameter comes from app/data/literature_params.json.
"""

from dataclasses import dataclass, field, replace, fields
from functools import lru_cache
from typing import Dict, Any, Tuple

import numpy as np
import pandas as pd

from app.core.constants import SOL_IN_EARTH_DAYS, R_GAS
from app.core.scientific_models import celsius_to_kelvin
from app.pipeline.ingest import load_raw_catalog
from app.ml.params import param
from app.ml.physiology import NUTRIENTS, VITAMIN_D, population_turnover_per_sol, pool_step, vitamin_d_step

# Daily ration per astronaut (servings), built from the existing food catalog
PACKAGED_MENU: Dict[str, float] = {"FD-001": 1, "FD-002": 1, "FD-003": 1, "TH-001": 1, "TH-002": 1, "NF-001": 1}
FRESH_MENU: Dict[str, float] = {"BIO-002": 1.0, "BIO-001": 0.5}
FRESH_PREFIX = "BIO-"

# Synthetic-crew parameters (all "assumed" in literature_params.json)
APPETITE_RANGE = tuple(param("crew.appetite_fraction"))
TURNOVER_SCALE_RANGE = tuple(param("crew.turnover_scale"))
INTAKE_NOISE_SD = param("crew.intake_daily_noise_sd")
VITALS_PROFILE = param("crew.vitals_profile")
DEFICIT_MAP = param("crew.vitals_deficit_mapping")
VITALS_NOISE = param("crew.vitals_noise")
# Per-Sol pull of body-mass noise back to the astronaut's baseline (AR(1) mean reversion).
# Prevents a pure random walk from drifting outside the personal baseline without any deficit.
BODY_MASS_REVERSION = VITALS_NOISE["body_mass_reversion"]
_EVENT = param("scenario.post_event_response")

# Literature-anchored storage kinetics per nutrient: k_ref (per day, per food class for B1) at T_ref (C)
FOOD_CLASS = param("kinetics.food_class_map")
KINETICS = {
    "thiamine_b1": {"k_ref": param("kinetics.thiamine_b1.k_ref_per_day"),
                    "temp_c": param("kinetics.thiamine_b1.reference")["temp_c"]},
    "vitamin_c": {"k_ref": param("kinetics.vitamin_c.k_ref_per_day"),
                  "temp_c": param("kinetics.vitamin_c.reference")["temp_c"]},
}

# Separate random stream for vitamin D so the original crew draws (vitals, appetite, noise) are unchanged
_VITD_STREAM = 1


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
    greenhouse_outage_sols: int = int(_EVENT["greenhouse_outage_sols"])              # fresh crops lost after the power event
    ration_factor_after_event: float = float(_EVENT["ration_factor_after_event"])      # crew switches to SURVIVAL rations
    appetite_factor_after_event: float = float(_EVENT["appetite_factor_after_event"])  # stress-related appetite drop

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
    retention: Dict[str, pd.DataFrame]          # per nutrient: packaged menu items, fraction of initial
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


def rate_constant_per_day(nutrient: str, item_id: str, catalog: Dict[str, Dict[str, Any]], temp_c: float) -> float:
    """
    First-order loss rate (per Earth day) of `nutrient` in a packaged item at temp_c:
        k(T) = k_ref * exp(-Ea/R * (1/T - 1/T_ref))
    k_ref: literature retention endpoint (per food class for thiamine); Ea: catalog value (assumed).
    """
    kin = KINETICS[nutrient]
    k_ref = kin["k_ref"][FOOD_CLASS[item_id]] if isinstance(kin["k_ref"], dict) else kin["k_ref"]
    ea_j = catalog[item_id]["activation_energy_Ea_kJ_mol"] * 1000.0
    inv_t = 1.0 / celsius_to_kelvin(temp_c) - 1.0 / celsius_to_kelvin(kin["temp_c"])
    return float(k_ref * np.exp(-ea_j / R_GAS * inv_t))


def retention_after(nutrient: str, item_id: str, catalog: Dict[str, Dict[str, Any]], temp_c: float, days: float) -> float:
    """Isothermal retention fraction after `days` Earth days at temp_c."""
    return float(np.exp(-rate_constant_per_day(nutrient, item_id, catalog, temp_c) * days))


def packaged_retention(storage_temp_c: np.ndarray, catalog: Dict[str, Dict[str, Any]]) -> Dict[str, pd.DataFrame]:
    """Per-nutrient retention of each packaged menu item: exp(-cumulative k(T(t)))."""
    sols = np.arange(len(storage_temp_c))
    out = {}
    for nutrient in NUTRIENTS:
        retention = {}
        for item_id in PACKAGED_MENU:
            k_per_sol = np.array([rate_constant_per_day(nutrient, item_id, catalog, t)
                                  for t in storage_temp_c]) * SOL_IN_EARTH_DAYS
            # integrate k(T(t)) so a past excursion keeps affecting all later Sols
            retention[item_id] = np.exp(-np.concatenate([[0.0], np.cumsum(k_per_sol)[:-1]]))
        out[nutrient] = pd.DataFrame(retention, index=sols)
    return out


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
        packaged = sum(catalog[i][f] * n * retention[nutrient][i].values for i, n in PACKAGED_MENU.items())
        fresh = sum(catalog[i][f] * n for i, n in FRESH_MENU.items()) * (~greenhouse_down)
        intake[nutrient] = (packaged + fresh) * ration_factor
    return intake


def generate_crew(sc: CrewScenario = CrewScenario()) -> CrewData:
    """Seeded synthetic crew: same random draw order as the prototype, so results are reproducible."""
    rng = np.random.default_rng(sc.seed)
    rng_d = np.random.default_rng([sc.seed, _VITD_STREAM])
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
            "hr_rest": rng.normal(*VITALS_PROFILE["hr_rest"]),
            "sleep_h": rng.normal(*VITALS_PROFILE["sleep_h"]),
            "body_mass_kg": rng.normal(*VITALS_PROFILE["body_mass_kg"]),
            "appetite": rng.uniform(*APPETITE_RANGE),              # astronauts commonly under-eat
            "turnover_scale": rng.uniform(*TURNOVER_SCALE_RANGE),  # individual metabolic variation
        }
        # vitamin D: pre-flight 25-OH-D and supplement compliance drawn from the ISS cohort distributions
        vd = VITAMIN_D
        profile["vitamin_d_preflight_nmol_l"] = max(1.0, rng_d.normal(vd["preflight"]["mean"], vd["preflight"]["sd"]))
        doses = float(np.clip(rng_d.normal(vd["doses_per_week"]["mean"], vd["doses_per_week"]["sd"]), 0.0, 7.0))
        profile["vitamin_d_supplement_compliance"] = doses / 7.0
        profile["vitamin_d_intake_ug_day"] = vd["food_intake_ug_day"] + vd["supplement_ug_day"] * doses / 7.0
        profiles[astronaut] = {k: float(v) for k, v in profile.items()}
        vitamin_d = profile["vitamin_d_preflight_nmol_l"]
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
                intake = intake_available[nutrient][sol] * appetite * rng.normal(1.0, INTAKE_NOISE_SD)
                k = population_turnover_per_sol(cfg, profile["turnover_scale"])
                pools[nutrient] = pool_step(pools[nutrient], intake, k, cfg)
                record[f"{nutrient}_intake_mg"] = intake
                record[f"{nutrient}_pool_mg"] = pools[nutrient]
                # 0 while comfortably above threshold, 1 at threshold
                margin = (pools[nutrient] - cfg["risk_threshold_mg"]) / (cfg["pool_max_mg"] - cfg["risk_threshold_mg"])
                deficit_signal = max(deficit_signal, float(np.clip(1 - 2 * margin, 0, 1)))

            # Vitamin D: no UV in flight; status set by food + supplement intake (no random draws here)
            record[VITAMIN_D["intake_col"]] = profile["vitamin_d_intake_ug_day"]
            record[VITAMIN_D["status_col"]] = vitamin_d
            vitamin_d = vitamin_d_step(vitamin_d, profile["vitamin_d_intake_ug_day"])

            # Demonstration-only mapping from vitamin C / B1 deficiency signal to observable vitals
            dm, vn = DEFICIT_MAP, VITALS_NOISE
            deficit_mass_loss -= dm["body_mass_loss_kg_per_sol"] * deficit_signal
            mass_noise = (1 - BODY_MASS_REVERSION) * mass_noise + rng.normal(0, vn["body_mass_sd"])
            body_mass = profile["body_mass_kg"] + deficit_mass_loss + mass_noise
            record["hr_rest"] = profile["hr_rest"] + dm["hr_rest_bpm"] * deficit_signal + rng.normal(0, vn["hr_rest_sd"])
            record["sleep_h"] = profile["sleep_h"] + dm["sleep_h"] * deficit_signal + rng.normal(0, vn["sleep_h_sd"])
            record["body_mass_kg"] = body_mass
            record["fatigue_score"] = float(np.clip(vn["fatigue_base"] + dm["fatigue_score"] * deficit_signal
                                                    + rng.normal(0, vn["fatigue_sd"]), 0, 10))
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
