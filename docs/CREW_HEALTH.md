# Crew Health Module

> **Prototype — not a medical device.** All astronaut physiology in this module is **synthetic**.
> Every API response carries a `data_provenance` field ("synthetic crew data; vitamin storage losses from first-order
> kinetics anchored to published spaceflight-food retention data; physiology parameters from NASA/literature sources
> where available, otherwise assumed"). Each parameter's source, page and status is in
> `backend/app/data/literature_params.json`; all project data sources are listed in [DATA_SOURCES.md](DATA_SOURCES.md).

## Plain-language overview

*For teammates who don't need the maths.*

**The idea in one picture: a water tank.** Picture each astronaut's body store of a vitamin as a water tank:
- **Tap = intake.** The vitamins they eat each day flow in.
- **Drain = turnover.** The body uses up and gets rid of a fixed share of the tank every day.
- **Water level = body pool.** When the tap and drain are balanced the level stays steady. If the tap is turned down
  (less food, or food that has lost its vitamins in storage), the level slowly falls.

We watch the level and the trend. We warn the crew while the tank is still well above "empty" and say how to turn the
tap back up.

**What is a Sol?** A Mars day, about 24 h 40 min (1.027 Earth days). The mission lasts 450 Sols.

**The default story (Sols 0 → 449):**
- **Sols 0–20:** we learn what "normal" looks like for *each* astronaut (their personal baseline). Up to Sol 27 the
  status shows **CALIBRATING**.
- **Sol 150:** the food storage cooling fails for 45 Sols (storage rises to 29.5 °C, so vitamins in packaged food break
  down faster). The same power event takes the **greenhouse offline for 120 Sols** (no fresh vegetables), and the crew
  moves to reduced rations.
- **From Sol 150:** vitamin intake drops sharply and the tanks start draining. WATCH alerts follow from Sol ~171,
  ACT alerts from Sol 212.
- **After ~Sol 270:** the greenhouse is back, and the tanks refill.
- **Independently of the cooling failure**, vitamin D status slowly declines in flight (no UV, food low in vitamin D),
  so vitamin D alerts can appear late in the mission even without the failure.

**What each status means:**

| Status | Meaning | What to do |
|---|---|---|
| CALIBRATING | Still learning this astronaut's normal (first 28 Sols) | Nothing |
| NOMINAL | Within their personal normal, no risk forecast | Nothing |
| WATCH | Something is drifting: a vital sign is unusual for *this* person, or the tank is forecast to hit the risk line within 120 Sols | Keep an eye on it; consider the suggested food |
| ACT | The tank is forecast to hit the risk line within 45 Sols | Follow the recommended action now |

**How to read the charts (Crew Health tab):**
- **Coloured line:** the astronaut's tank level (vitamin pool) up to the current Sol. Nothing after the current Sol is shown.
- **Red dashed line:** the risk threshold. Vitamin C (300 mg body pool) and vitamin D (25 nmol/L) come from NASA JSC 2005;
  thiamine (10 mg = 1/3 of the ~30 mg store) is an assumption. Early warning comes from the forecast horizon, not from
  raising the threshold.
- **Orange shaded band:** the period when the cooling system was broken (the faint green band behind it is the greenhouse outage).
- **White dashed line:** the forecast. Where the tank is heading if the astronaut keeps eating like they did in the last 7 Sols.
- **Red dot:** the Sol on which the ACT alert fired.
- **Vitals chart, green band:** this astronaut's own normal range (their average ± 2 standard deviations over Sols 0–20).
  A line leaving the band means "unusual for this person", even if it would be normal for someone else.

**Demo walkthrough (4 steps, default scenario, seed 42):**
1. **Sol 149:** all four astronauts are NOMINAL; vitals sit inside their green bands.
2. **Sol 172:** the cooling failure at Sol 150 has knocked out the greenhouse. MS-03 (Sol 171) and PLT-02 (Sol 172)
   are on **WATCH** because their fatigue score is above their personal normal (MS-03: +72%, z +2.4). The alert says
   no nutrient forecast explains it yet, so the action is "re-measure and review the crew log", not a diet change.
3. **Sol 212:** PLT-02 goes to **ACT**. Thiamine intake is −63% vs baseline since Sol 150, the body pool is 11.3 mg
   (−58%), and the forecast says it will cross the 10 mg risk line in 41 Sols. The alert recommends about
   1.9 servings/Sol of oatmeal (the best thiamine source available while the greenhouse is offline). In this run the
   greenhouse returns at Sol 270 and the pool never actually crosses the line.
4. **Turn the cooling failure off:** no vitamin C or thiamine alerts for anyone over the whole mission. The remaining
   alerts are vitamin D (for example MS-04: ACT at Sol 348, real crossing at Sol 393, i.e. **45 Sols early**),
   which comes from the in-flight vitamin D decline, not from the food storage failure.

Remember: **all crew data is synthetic**, and this is a prototype, not a medical device.

---

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

Recomputed on 2026-11-14 with the current `literature_params.json` (vitamin C risk threshold 300 mg).

| Astronaut | First WATCH | First ACT (nutrient) | Risk threshold actually crossed |
|---|---|---|---|
| CDR-01 | 214 | — | none |
| MS-03 | 171 | 244 (thiamine B1) | none |
| MS-04 | 188 | 348 (vitamin D) | vitamin D at Sol 393 |
| PLT-02 | 172 | 212 (thiamine B1) | none |

- The thiamine ACT alerts forecast a crossing within 45 Sols. In this run the greenhouse returns at Sol 270 and the pools
  recover, so the crossing does not happen (the forecast assumes the last 7 Sols of intake continue).
- No vitamin C pool reaches 300 mg in this scenario.
- MS-04's vitamin D ACT is raised **45 Sols before** the real crossing (Sol 393). It also happens with
  `failure_enabled=false`, because it comes from the in-flight vitamin D decline, not from the cooling failure.
- With `failure_enabled=false`, no vitamin C or thiamine WATCH/ACT is raised; vitamin D WATCH alerts appear late in the
  mission (CDR-01 416, MS-03 429, MS-04 273 with ACT at 348).

## Assumptions

- Physiological constants (absorption, turnover, pool capacity, risk thresholds) come from `literature_params.json`, where
  each value is marked `literature`, `derived` (formula in its note) or `assumed`. The thiamine risk threshold, the
  vitamin D intake response, the synthetic-crew variation and the vitals mapping are assumed. Thresholds are not
  diagnostic cut-offs.
- The mapping from vitamin deficit to vitals (HR up, sleep down, fatigue up, mass loss) is a **demonstration-only** link
  used to generate synthetic observables.
- One cooling-failure event also takes the greenhouse offline for 120 Sols, cuts rations to 70% and reduces appetite by 15%.
  In the default scenario the fresh-crop loss and ration cut drive most of the intake drop. The Arrhenius loss in packaged
  food adds to it and lasts after the cooling is restored.
- A fixed daily menu is used for each astronaut, built from the food catalog. The vitamin C and thiamine content per
  serving in that catalog is **synthetic** (no cited source); storage losses use the literature rate constants
  (Goulette 2020, Cooper 2017), not the catalog's own Arrhenius constants.

## Limitations

- **Synthetic data only.** No real astronaut data has been used for training or validation of this module. (Real
  Inspiration4 blood panels from NASA OSDR are analysed separately in `backend/scripts/i4_baseline_demo.py`; they are
  not wired into this module.)
- Vitamin C and thiamine are modeled as single-compartment first-order pools; vitamin D as a 25-OH-D status level with a
  literature decline rate.
- The forecast assumes the intake of the last 7 Sols continues, so it does not anticipate planned changes.
- Synthetic body mass = personal baseline + cumulative deficit-driven loss + mean-reverting AR(1) noise (reversion 0.2/Sol),
  so it does not drift without a deficit. With `failure_enabled=false` no vitamin C/thiamine or vitals-driven WATCH/ACT
  is raised over the full mission (seed 42); only vitamin D alerts remain. Real body-mass data would drift (e.g. bone/muscle loss), and that drift would need its own model.
- Alerts are reported at the first WATCH and the first ACT per astronaut. The snapshot endpoint gives the live status
  at any Sol.
- The cache is in-process only (LRU, 16 scenarios). It is lost on restart and not shared between workers.
- This is not a medical device and must not be used for clinical decisions.
