"""
Crew Health ML package.

Closes the loop between packaged-food vitamin degradation (Arrhenius kinetics in
app.core.scientific_models) and astronaut health:

    params      - literature parameter registry (app/data/literature_params.json)
    physiology  - body vitamin pools (C, B1), vitamin D status, personal rates, sols-to-risk forecast
    crew_data   - scenario configuration and seeded synthetic crew generator
    anomaly     - personal-baseline z-scores, IsolationForest, NOMINAL/WATCH/ACT rules, alerts
    literature_check - model outputs vs published values

All crew physiology data produced here is synthetic.
"""

DATA_PROVENANCE = ("synthetic crew data; vitamin storage losses from first-order kinetics anchored to published "
                   "spaceflight-food retention data; physiology parameters from NASA/literature sources where "
                   "available, otherwise assumed (see parameter_sources and /api/v1/health/parameters)")
