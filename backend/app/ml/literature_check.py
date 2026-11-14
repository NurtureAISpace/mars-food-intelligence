"""
Literature range check: compares Crew Health model outputs with published values.

Each check reports the model value, the literature value/range, the tolerance used, pass/fail
and whether it is an independent check or a calibration identity (the model parameter was
derived from the same number, so a pass only confirms the implementation).

Also compares the legacy per-item Arrhenius parameters in space_food_catalog.json (still used by
the simulator/prediction services) against the same literature endpoints.
"""

import math
from typing import Any, Dict, List, Optional, Sequence, Union

from app.core.constants import SOL_IN_EARTH_DAYS
from app.core.scientific_models import arrhenius_rate_constant
from app.ml.crew_data import FOOD_CLASS, APPETITE_RANGE, load_catalog, retention_after
from app.ml.params import param, param_entry, sources
from app.ml.physiology import NUTRIENTS, VITAMIN_D, vitamin_d_decline_rate_per_day

Number = Union[float, int]
DEFAULT_REL_TOL = 0.10   # +/-10% of the literature value (or range edges)
VITD_ISS_DAYS = sum(param("vitamin_d.iss_mission_days")) / 2.0


def _source_label(param_name: str) -> str:
    sid = param_entry(param_name)["source"]
    return sid if sid in sources() else "?"


def _check(name: str, model: float, literature: Union[Number, Sequence[Number]], unit: str, param_name: str,
           kind: str, rel_tol: float = DEFAULT_REL_TOL, abs_tol: Optional[float] = None,
           note: str = "") -> Dict[str, Any]:
    """Pass if model is within [lo, hi] widened by the tolerance (relative unless abs_tol given)."""
    lo, hi = (literature, literature) if isinstance(literature, (int, float)) else (min(literature), max(literature))
    if abs_tol is not None:
        lo_t, hi_t, tol_txt = lo - abs_tol, hi + abs_tol, f"+/-{abs_tol:g} {unit}"
    else:
        lo_t, hi_t, tol_txt = lo * (1 - rel_tol), hi * (1 + rel_tol), f"+/-{100 * rel_tol:.0f}%"
    return {
        "check": name,
        "model_value": round(float(model), 4),
        "literature_value": literature if isinstance(literature, (int, float)) else list(literature),
        "unit": unit,
        "tolerance": tol_txt,
        "passed": bool(lo_t <= model <= hi_t),
        "kind": kind,
        "source": _source_label(param_name),
        "parameter": param_name,
        "status": param_entry(param_name)["status"],
        "note": note,
    }


def _legacy_catalog_retention(item_id: str, temp_c: float, days: float) -> float:
    item = load_catalog()[item_id]
    return math.exp(-arrhenius_rate_constant(item["arrhenius_A"], item["activation_energy_Ea_kJ_mol"], temp_c) * days)


def run_checks() -> List[Dict[str, Any]]:
    catalog = load_catalog()
    out: List[Dict[str, Any]] = []

    # --- Storage kinetics: thiamine (Goulette 2020) ---------------------------------------
    b1 = param("kinetics.thiamine_b1.reference")
    for food_class, lit in b1["retention"].items():
        items = [i for i, c in FOOD_CLASS.items() if c == food_class]
        model = sum(retention_after("thiamine_b1", i, catalog, b1["temp_c"], b1["days"]) for i in items) / len(items)
        out.append(_check(f"B1 retention {food_class} ({', '.join(items)}) {b1['days']:.0f} d @ {b1['temp_c']:.0f} C",
                          model, lit, "fraction", "kinetics.thiamine_b1.reference", "calibration identity",
                          note="crew model (k_ref derived from this endpoint)"))
        legacy = sum(_legacy_catalog_retention(i, b1["temp_c"], b1["days"]) for i in items) / len(items)
        out.append(_check(f"B1 retention {food_class} - legacy catalog Arrhenius", legacy, lit, "fraction",
                          "kinetics.thiamine_b1.reference", "independent",
                          note="space_food_catalog.json A/Ea, still used by simulator/prediction services"))

    # --- Storage kinetics: vitamin C (Cooper 2017) ----------------------------------------
    vc = param("kinetics.vitamin_c.reference")
    lit_ret = [1 - x for x in vc["loss_fraction_range"]]
    menu = list(FOOD_CLASS)
    model = sum(retention_after("vitamin_c", i, catalog, vc["temp_c"], vc["days"]) for i in menu) / len(menu)
    out.append(_check(f"Vit C retention menu mean {vc['days']:.0f} d @ {vc['temp_c']:.0f} C", model, lit_ret,
                      "fraction", "kinetics.vitamin_c.reference", "calibration identity",
                      note="crew model; literature range is for fruit products"))
    legacy = sum(_legacy_catalog_retention(i, vc["temp_c"], vc["days"]) for i in menu) / len(menu)
    out.append(_check("Vit C retention menu mean - legacy catalog Arrhenius", legacy, lit_ret, "fraction",
                      "kinetics.vitamin_c.reference", "independent",
                      note="space_food_catalog.json A/Ea, still used by simulator/prediction services"))

    # --- Vitamin C body pool (NASA JSC 2005) ----------------------------------------------
    c = NUTRIENTS["vitamin_c"]
    out.append(_check("Vit C turnover at full pool (k * P_max)", c["turnover_per_day"] * c["pool_max_mg"],
                      param("vitamin_c.catabolic_turnover_mg_day"), "mg/day", "vitamin_c.catabolic_turnover_mg_day",
                      "calibration identity"))
    t_def = math.log(c["pool_max_mg"] / c["risk_threshold_mg"]) / c["turnover_per_day"]
    out.append(_check("Vit C days from full pool to deficiency pool at zero intake", t_def,
                      param("vitamin_c.scurvy_onset_days"), "days", "vitamin_c.scurvy_onset_days", "independent",
                      note="literature value is onset of scurvy symptoms after intake stops"))
    sat = c["turnover_per_day"] * c["pool_max_mg"] / c["absorption"]
    out.append(_check("Vit C intake that keeps pool saturated (k * P_max / a)", sat,
                      param("vitamin_c.saturation_intake_mg_day"), "mg/day", "vitamin_c.saturation_intake_mg_day",
                      "independent", note="depends on assumed absorption"))

    # --- Thiamine body pool ---------------------------------------------------------------
    t = NUTRIENTS["thiamine_b1"]
    out.append(_check("B1 biological half-life (ln2 / k)", math.log(2) / t["turnover_per_day"],
                      param("thiamine_b1.half_life_days"), "days", "thiamine_b1.half_life_days", "calibration identity"))
    pool_rda = t["absorption"] * t["requirement_mg_day"] / t["turnover_per_day"]
    out.append(_check("B1 steady-state pool at RDA intake (a * RDA / k)", pool_rda,
                      param("thiamine_b1.pool_max_mg"), "mg", "thiamine_b1.pool_max_mg", "independent",
                      note="body store ~30 mg in a healthy adult on the RDA; depends on assumed absorption"))

    # --- Vitamin D (ISS, Mir, Skylab) ------------------------------------------------------
    vd = VITAMIN_D
    pre, post = vd["preflight"]["mean"], param("vitamin_d.postflight_25ohd_nmol_l")["mean"]
    r_iss = vitamin_d_decline_rate_per_day(vd["iss_intake_ug_day"])
    out.append(_check(f"25-OH-D after {VITD_ISS_DAYS:.1f} d with ISS supplementation", pre * math.exp(-r_iss * VITD_ISS_DAYS),
                      post, "nmol/L", "vitamin_d.postflight_25ohd_nmol_l", "calibration identity", abs_tol=1.0))
    short = param("vitamin_d.short_mission_no_decline_days")
    drop_short = pre * (1 - math.exp(-r_iss * max(short)))
    out.append(_check(f"25-OH-D drop after {max(short):.0f} d (short missions: no significant decrease)", drop_short,
                      [0.0, vd["preflight"]["sd"]], "nmol/L", "vitamin_d.short_mission_no_decline_days", "independent",
                      abs_tol=0.0, note="pass if the drop is within the pre-flight between-subject SD"))
    mir = param("vitamin_d.mir_decline_pct")
    for d in mir["mission_days"]:
        out.append(_check(f"25-OH-D % decrease after {d:.0f} d (Mir 3-4 mo)", 100 * (1 - math.exp(-r_iss * d)),
                          mir["range_pct"], "%", "vitamin_d.mir_decline_pct", "independent",
                          note="Mir supplementation not stated in source; ISS supplementation assumed"))
    sols_450 = 450 * SOL_IN_EARTH_DAYS
    out.append({
        "check": "25-OH-D after 450 Sols with ISS supplementation (extrapolation, info only)",
        "model_value": round(pre * math.exp(-r_iss * sols_450), 2), "literature_value": None, "unit": "nmol/L",
        "tolerance": None, "passed": None, "kind": "extrapolation", "source": "RICE_ZWART_SMITH_NTRS",
        "parameter": "vitamin_d.decline_rate_per_day_iss", "status": "derived",
        "note": f"observed data cover <= {max(param('vitamin_d.iss_mission_days')):.0f} d; NASA green band >= "
                f"{vd['risk_threshold_nmol_l']:.0f} nmol/L",
    })

    # --- Crew intake ----------------------------------------------------------------------
    out.append(_check("Mean appetite fraction (synthetic crew)", sum(APPETITE_RANGE) / 2,
                      param("crew.energy_intake_fraction_iss"), "fraction", "crew.energy_intake_fraction_iss",
                      "independent", rel_tol=0.05, note="vs mean % of recommended energy intake on ISS"))
    return out


def summary(checks: List[Dict[str, Any]]) -> Dict[str, int]:
    graded = [c for c in checks if c["passed"] is not None]
    return {
        "total": len(checks),
        "graded": len(graded),
        "passed": sum(c["passed"] for c in graded),
        "failed": sum(not c["passed"] for c in graded),
        "independent_passed": sum(c["passed"] for c in graded if c["kind"] == "independent"),
        "independent_total": sum(1 for c in graded if c["kind"] == "independent"),
    }
