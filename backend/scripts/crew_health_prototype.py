"""
Crew Health demo: nutrition-driven astronaut health monitoring.

Thin wrapper around the production modules in app.ml (physiology, crew_data, anomaly):

    food storage temperature -> vitamin retention per ration item (literature-anchored first-order kinetics)
    -> daily intake per astronaut -> body pool (vitamin C, thiamine B1) + vitamin D status (no UV)
    -> personal-baseline z-scores + IsolationForest anomaly score
    -> NOMINAL / WATCH / ACT status with explainable alerts

All crew physiology data is synthetic. Every constant is in app/data/literature_params.json with its
source and status (literature / derived / assumed); see scripts/literature_check.py.

Run from the backend directory:
    python scripts/crew_health_prototype.py
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ml import DATA_PROVENANCE
from app.ml.anomaly import analyze_crew
from app.ml.crew_data import CrewScenario, PACKAGED_MENU, generate_crew
from app.ml.physiology import NUTRIENTS, VITAMIN_D, personal_turnover, population_turnover_per_sol

pd.set_option("display.width", 160)
pd.set_option("display.max_columns", 20)

scenario = CrewScenario()
data = generate_crew(scenario)
analysis = analyze_crew(data)
sols = data.sols
print(f"Data provenance: {DATA_PROVENANCE}\n")

for nutrient, ret in data.retention.items():
    print(f"Packaged-food {nutrient} retention (fraction of initial):")
    print(ret[list(PACKAGED_MENU)].iloc[[0, 149, 194, 300, 449]].round(3))

print("\nAvailable intake per astronaut per Sol (mg):")
print(pd.DataFrame(data.intake_available, index=sols).iloc[[0, 149, 160, 200, 300, 449]].round(2))

crew_df = data.crew_df
print("\nSynthetic crew data:", crew_df.shape)
print(crew_df.head())

status_rows = []
for astronaut, res in analysis.astronauts.items():
    final = res.frame.iloc[-1]
    first_act = res.first_status.get("ACT")
    status_rows.append({
        "astronaut": astronaut,
        "first_watch_sol": res.first_status.get("WATCH"),
        "first_act_sol": first_act,
        "sols_to_risk_at_act": (res.frame.loc[first_act, "sols_to_risk"].round(0) if first_act is not None else None),
        "first_act_nutrient": (res.frame.loc[first_act, "worst_nutrient"] if first_act is not None else None),
        "crossing_sol": {n: s for n, s in res.threshold_crossing_sol.items() if s is not None} or None,
        "final_vitc_mg": round(final["vitamin_c_pool_mg"], 1),
        "final_b1_mg": round(final["thiamine_b1_pool_mg"], 2),
        "final_25ohd_nmol_l": round(final[VITAMIN_D["status_col"]], 1),
    })
print("\nCrew status summary:")
print(pd.DataFrame(status_rows))

alert_cols = ["astronaut_id", "sol", "status", "nutrient", "pool_mg", "sols_to_risk", "since_sol",
              "top_vital_driver", "driver_z", "intake_gap_mg_per_sol", "action"]
print("\nFirst alerts (explainable):")
print(pd.DataFrame(analysis.alerts)[alert_cols].sort_values(["astronaut_id", "sol"]).to_string(index=False))
for a in sorted(analysis.alerts, key=lambda a: (a["astronaut_id"], a["sol"])):
    print(f"  [{a['astronaut_id']} Sol {a['sol']} {a['status']}] {a['message']}")

timeline = analysis.timeline
if scenario.failure_enabled:
    pre_event = timeline.sol < scenario.cooling_failure_sol
    print("\nMean anomaly score before vs after cooling failure:")
    print(timeline.groupby(np.where(pre_event, "before", "after"))["anomaly_score"].mean().round(3))

print("\nWarning lead time (first ACT -> first threshold crossing of the ACT nutrient):")
for astronaut, res in analysis.astronauts.items():
    act = res.first_status.get("ACT")
    if act is None:
        print(f"  {astronaut}: no ACT")
        continue
    n = res.frame.loc[act, "worst_nutrient"]
    cross = res.threshold_crossing_sol.get(n)
    lead = f"{cross - act} Sols" if cross is not None else "no crossing in mission"
    print(f"  {astronaut}: ACT Sol {act} on {n}, crossing Sol {cross}, lead {lead}")

print("\nNo-cooling-failure control run (false alarms = WATCH/ACT without the event):")
control = analyze_crew(generate_crew(CrewScenario(failure_enabled=False)))
for a in control.alerts:
    print(f"  {a['astronaut_id']} Sol {a['sol']} {a['status']} on {a['nutrient']} (sols_to_risk {a['sols_to_risk']}, "
          f"driver {a['top_vital_driver']} z {a['driver_z']})")
if not control.alerts:
    print("  none")

for col, label in (("vitamin_c_pool_mg", "Vitamin C pool (mg)"), ("thiamine_b1_pool_mg", "Thiamine B1 pool (mg)"),
                   (VITAMIN_D["status_col"], "Serum 25-OH-D (nmol/L)")):
    print(f"\n{label} every 50 Sols:")
    print(timeline[timeline.sol % 50 == 0].pivot(index="sol", columns="astronaut", values=col).round(1))

print("\nEstimated personal turnover k per Sol (vs population value):")
for astronaut, g in crew_df.groupby("astronaut"):
    print(astronaut, {n: round(personal_turnover(g[f"{n}_pool_mg"].values, g[f"{n}_intake_mg"].values, cfg), 4)
                      for n, cfg in NUTRIENTS.items()})
print("population:", {n: round(population_turnover_per_sol(cfg), 4) for n, cfg in NUTRIENTS.items()})
