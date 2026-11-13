# Crew Health Module

> **Prototype — not a medical device.** All astronaut physiology in this module is **synthetic**.
> Every API response carries `"data_provenance": "synthetic crew data; vitamin degradation from Arrhenius model"`.

NASA Space Apps 2026 challenge: *Create Health Monitoring Software for Astronauts on Space Missions.*

The rest of NurtureAISpace models how food degrades in storage. This module follows that degradation into the
astronaut's body and closes the loop:

```
storage temperature ─► Arrhenius vitamin retention per ration item
                    ─► vitamin intake actually eaten by each astronaut
                    ─► body vitamin pool (vitamin C, thiamine B1)
                    ─► deviation from that astronaut's personal baseline
                    ─► explainable early-warning alert (NOMINAL / WATCH / ACT)
                    ─► corrective action (food + servings/Sol to close the intake gap)
```

## Code map

| File | Role |
|---|---|
| `backend/app/ml/physiology.py` | Nutrient constants, pool update step, personal turnover estimator, analytic Sols-to-risk forecast |
| `backend/app/ml/crew_data.py` | `CrewScenario` dataclass, storage profile, Arrhenius retention, intake, seeded synthetic crew |
| `backend/app/ml/anomaly.py` | Personal baselines, z-scores, IsolationForest, status rules, explainable alerts, food recommendation |
| `backend/app/services/crew_health_service.py` | Orchestration, JSON payloads, in-memory LRU cache per scenario |
| `backend/app/api/routes_health.py` | REST endpoints |
| `backend/scripts/crew_health_prototype.py` | Print-based demo of the full pipeline |
| `frontend/src/components/CrewHealthView.tsx` | "Crew Health" tab |
| `backend/tests/test_crew_health.py` | Tests |

## API

All endpoints are under `/api/v1/health` and accept the scenario query parameters
`failure_enabled` (bool, default `true`), `cooling_failure_sol` (default 150),
`failure_duration_sols` (default 45), `failure_peak_temp_c` (default 29.5).

| Endpoint | Returns |
|---|---|
| `GET /health/crew?sol=` | Snapshot at a Sol: status per astronaut, pools, vitals, z-scores, per-nutrient forecast, current assessment, alerts so far |
| `GET /health/astronaut/{astronaut_id}/timeline` | Full Sol-by-Sol series for one astronaut, personal baseline bands, first WATCH/ACT Sol, threshold crossing Sol |
| `GET /health/alerts?sol=` | Explainable alerts raised up to `sol` |

When `failure_enabled=false` the other failure parameters are ignored, and the cache key is normalized, so
every "no failure" request reuses a single cached analysis.

## Equations

**1. Food vitamin retention.** This reuses `arrhenius_rate_constant` from `app.core.scientific_models`. Retention integrates the
rate over the temperature history, so an excursion keeps affecting every later Sol:

$$k_i(T) = A_i\, e^{-E_{a,i}/(RT)}, \qquad R_i(t) = \exp\!\Big(-\sum_{s<t} k_i(T_s)\,\Delta t_{\text{Sol}}\Big)$$

**2. Intake available per astronaut.** The packaged menu is scaled by retention. Fresh greenhouse crops count only while
the greenhouse is online. The ration factor applies after the event:

$$I^{\text{avail}}_n(t) = f_{\text{ration}}(t)\Big[\sum_{i\in\text{packaged}} c_{i,n}\,m_i\,R_i(t) + \mathbb{1}_{\text{greenhouse}}(t)\sum_{j\in\text{fresh}} c_{j,n}\,m_j\Big]$$

Intake actually eaten = available × personal appetite × (stress factor after the event) × noise 𝒩(1, 0.08).

**3. Body pool (first order, capped).**

$$P_{t+1} = \min\big(P_{\max},\; P_t(1-k) + a\, I_t\big), \qquad k = k_{\text{pop}} \cdot s_{\text{individual}} \cdot 1.0275\ \text{(day→Sol)}$$

**4. Personal turnover estimate.** Least squares on uncapped Sols up to the current Sol, falling back to the population
value when fewer than 10 uncapped points are available:

$$\Delta P_t = a I_{t} - k P_{t-1} \;\Rightarrow\; \hat k = \frac{\sum P_{t-1}(aI_t - \Delta P_t)}{\sum P_{t-1}^2}$$

**5. Sols-to-risk forecast.** Assumes the mean intake of the last 7 Sols continues:

$$P(t) = P_{eq} + (P_0 - P_{eq})e^{-\hat k t}, \quad P_{eq} = a\bar I/\hat k \;\Rightarrow\; t^{*} = \frac{1}{\hat k}\ln\frac{P_0 - P_{eq}}{P_{thr} - P_{eq}}$$

(t* = 0 if already below the threshold. t* = ∞ if P_eq ≥ P_thr.)

**6. Personal baseline z-scores.** The baseline is Sols 0–20 of each astronaut. The SD is floored at a measurement-noise level
(HR 2 bpm, sleep 0.3 h, mass 0.5 kg, fatigue 0.7, intake 5% of baseline mean). The z-scores are smoothed with a 7-Sol rolling mean.

**7. IsolationForest.** One model per astronaut (200 trees, contamination 0.02), trained **only on that astronaut's baseline
window** over vitals + vitamin intake. Its score is reported as supporting evidence. It is not part of the status rules.

**8. Status rules** (evaluated causally at every Sol from Sol 28, after the 21-Sol baseline and the 7-Sol trend window):

| Status | Rule |
|---|---|
| ACT | worst-nutrient Sols-to-risk ≤ 45 |
| WATCH | Sols-to-risk ≤ 120 **or** \|z\| of any vital ≥ 2 |
| NOMINAL | otherwise |
| CALIBRATING | Sol < 28 |

**9. Explainable alert.** An alert is raised at the first WATCH and the first ACT of each astronaut. It contains:
- **what changed and by how much**: nutrient intake, body pool and top vital driver, each as % vs personal baseline (and z);
- **since which Sol**: the start of the current run where smoothed intake z ≤ −2 (falls back to the vital-driver run);
- **forecast**: Sols-to-risk and projected Sol of crossing the risk threshold;
- **action**: intake gap = need − mean intake of the last 3 Sols, where need = k_pop·P_max·0.8/a (holds the pool at 80% of
  capacity), and servings = gap / nutrient per serving of the best food *available at that Sol*: a fresh greenhouse crop
  if the greenhouse is online, otherwise the best packaged item at its current Arrhenius retention. Suggestions above
  3 servings/Sol are flagged as not feasible.

## Default scenario (seed 42, cooling failure at Sol 150 for 45 Sols at 29.5 °C)

| Astronaut | First WATCH | First ACT | Vitamin C pool crosses 400 mg |
|---|---|---|---|
| CDR-01 | 198 | — | never |
| MS-03 | 165 | 192 | 242 |
| MS-04 | 182 | — | never |
| PLT-02 | 162 | 194 | 244 |

ACT is raised about **50 Sols before** the pool actually crosses the risk threshold. With `failure_enabled=false`, no ACT is
raised and no pool crosses a threshold.

## Assumptions

- Physiological constants (absorption, turnover, pool capacity, risk thresholds) are **approximate literature values; verify
  before use**. Risk thresholds are early-warning levels set above clinical deficiency. They are not diagnostic cut-offs.
- The mapping from vitamin deficit to vitals (HR up, sleep down, fatigue up, mass loss) is a **demonstration-only** link
  used to generate synthetic observables.
- One cooling-failure event also takes the greenhouse offline for 120 Sols, cuts rations to 70% and reduces appetite by 15%.
  In the default scenario the fresh-crop loss and ration cut drive most of the intake drop. The Arrhenius loss in packaged
  food adds to it and lasts after the cooling is restored.
- A fixed daily menu is used for each astronaut, built from the existing food catalog.

## Limitations

- **Synthetic data only.** No real astronaut data has been used for training or validation.
- Only two water-soluble vitamins are modeled, each with a single-compartment first-order pool.
- The forecast assumes the intake of the last 7 Sols continues, so it does not anticipate planned changes.
- Body mass follows a random walk in the synthetic generator. Over long missions this can produce occasional WATCH
  states without any failure (e.g. CDR-01 at Sol 314 and MS-03 at Sol 375 with `failure_enabled=false`). ACT is never raised
  in that case.
- Alerts are reported at the first WATCH and the first ACT per astronaut. The snapshot endpoint gives the live status
  at any Sol.
- The cache is in-process only (LRU, 16 scenarios). It is lost on restart and not shared between workers.
- This is not a medical device and must not be used for clinical decisions.
