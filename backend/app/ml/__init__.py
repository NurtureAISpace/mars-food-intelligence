"""
Crew Health ML package.

Closes the loop between packaged-food vitamin degradation (Arrhenius kinetics in
app.core.scientific_models) and astronaut health:

    physiology  - body vitamin pool model, personal turnover estimation, sols-to-risk forecast
    crew_data   - scenario configuration and seeded synthetic crew generator
    anomaly     - personal-baseline z-scores, IsolationForest, NOMINAL/WATCH/ACT rules, alerts

All crew physiology data produced here is synthetic.
"""

DATA_PROVENANCE = "synthetic crew data; vitamin degradation from Arrhenius model"
