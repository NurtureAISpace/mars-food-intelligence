"""
Crew Health demo: nutrition-driven astronaut health monitoring.

Thin wrapper around the production modules in app.ml (physiology, crew_data, anomaly):

    food storage temperature -> vitamin retention per ration item (Arrhenius)
    -> daily intake per astronaut -> body pool (vitamin C, thiamine B1)
    -> personal-baseline z-scores + IsolationForest anomaly score
    -> NOMINAL / WATCH / ACT status with explainable alerts

All crew physiology data is synthetic. Physiological constants are approximate
literature values and must be verified before any use beyond demonstration.

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
from app.ml.physiology import NUTRIENTS, personal_turnover, population_turnover_per_sol

pd.set_option("display.width", 160)
pd.set_option("display.max_columns", 20)

scenario = CrewScenario()
data = generate_crew(scenario)
analysis = analyze_crew(data)
sols = data.sols
print(f"Data provenance: {DATA_PROVENANCE}\n")

print("Packaged-food vitamin retention (fraction of initial):")
print(data.retention[list(PACKAGED_MENU)].iloc[[0, 149, 194, 300, 449]].round(3))

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
        "vitc_crosses_threshold_sol": res.threshold_crossing_sol["vitamin_c"],
        "final_vitamin_c_pool_mg": round(final["vitamin_c_pool_mg"], 1),
        "final_thiamine_b1_pool_mg": round(final["thiamine_b1_pool_mg"], 2),
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

print("\nPool trajectory every 50 Sols:")
print(timeline[timeline.sol % 50 == 0].pivot(index="sol", columns="astronaut", values="vitamin_c_pool_mg").round(0))

print("\nEstimated personal turnover k per Sol (vs population value):")
for astronaut, g in crew_df.groupby("astronaut"):
    print(astronaut, {n: round(personal_turnover(g[f"{n}_pool_mg"].values, g[f"{n}_intake_mg"].values, cfg), 4)
                      for n, cfg in NUTRIENTS.items()})
print("population:", {n: round(population_turnover_per_sol(cfg), 4) for n, cfg in NUTRIENTS.items()})
