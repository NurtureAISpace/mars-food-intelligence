# NASA Space Apps Challenge 2026 — Official Submission Fields (English)

**Event:** NASA International Space Apps Challenge Ganja 2026 (Nov 14–15, 2026)  
**Challenge:** *Create Health Monitoring Software for Astronauts on Space Missions*  
**Team:** NurtureAISpace (Suleyman Hajizadeh, Banu Gurbanizada, Yunis, Faruk Karimli)

---

## 0. Field Limits & Guidelines (from `spaceappschallenge.org`)

We checked `https://www.spaceappschallenge.org/resources/project-submission-guide/` (which currently returns a Next.js 404 on the live site), the official archived *Space Apps Project Submission Guide* PDF (`Space_Apps_2022_Project_Submission_Guide.pdf`), the 2026 challenge page (`https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/`), and Page 8 of the *Ganja 2026 Official Event Program*:

| Field | Platform / Guide Limit | Recommended Target | Our Draft Length |
|---|---|---|---|
| **Project Name** | Short title (required; typically ≤ 100 chars on portal) | ≤ 80 characters | **74 characters** (11 words) |
| **High-Level Summary** | Required; concise overview (no hard char limit in guide; portal text box typically ≤ 1,000–1,500 chars / ~150–250 words) | 120–200 words (≤ 1,200 chars) | **164 words** (1,089 characters) |
| **Project Demo** | Required; **1 public, password-free URL** to **≤ 7 slides** (in English, incl. team name, members, challenge) OR **≤ 30 s video** (with English subtitles). Exceeding 7 slides or 30 s disqualifies from global judging. | Single public URL | Placeholder `[PROJECT_DEMO_LINK]` |
| **Final Project** | Required; **public, password-free URL** to live app or code repository | Single public URL | Placeholder `[FINAL_PROJECT_LINK]` |
| **Detailed Description** | Required; rich-text main body (no hard word limit in guide; typically 400–800 words / ≤ 5,000 chars) | 450–700 words | **618 words** (4,092 characters) |
| **NASA Data** | **Mandatory for Global Judging**; list specific NASA datasets/documents and how they are used | Clear bullet list with URLs | **286 words** (2,045 characters) |
| **Partner & Other Data** | Required; list external literature, code/data sources, and synthetic data disclosures | Clear bullet list with DOIs | **178 words** (1,218 characters) |
| **Use of AI** | Required; disclose in-app ML and AI coding/research tools; **no NASA logo**; AI-generated images/video must have a visible watermark | Clear disclosure | **148 words** (1,012 characters) |

---

## 1. Project Name

```text
NurtureAISpace: Astronaut Nutrition, Blood Baseline & Health Early Warning
```

---

## 2. High-Level Summary

```text
On long space missions, communication delays mean astronauts must monitor their own health. The challenge background highlights "inadequate nutrition" alongside radiation, altered gravity, isolation, and closed environments as a major health risk: heat-sensitive vitamins in stored food—such as vitamin C and thiamine (B1)—break down over time, and vitamin D drops without sunlight, so crew members can develop deficiencies long before calories run out.

NurtureAISpace is a health-monitoring prototype that connects food storage to astronaut health indicators:
1. Real NASA Data screen: analyzes real Inspiration4 blood panels from NASA OSDR (OSD-569 CBC, OSD-575 CMP), comparing each astronaut against their own 3 pre-flight blood tests rather than only wide lab ranges.
2. Crew Health monitor: forecasts vitamin C, B1, and D levels in a synthetic 4-person crew, compares indicators against each astronaut's personal baseline, raises color-coded NOMINAL / WATCH / ACT early warnings, recommends what to eat next, and flags when to contact the flight surgeon (a 6-indicator daily self-assessment check-in is also being added).
```

---

## 3. Project Demo

```text
[PROJECT_DEMO_LINK]
```
*(Note before submitting: paste a single public, password-free link here—either the 7-slide deck at `https://nurtureaispace.github.io/slides.html` once the `fix/honest-claims` branch is merged, or a ≤30-second video with English subtitles.)*

---

## 4. Final Project

```text
[FINAL_PROJECT_LINK]
```
*(Note before submitting: paste a public, password-free link here, e.g. `https://nurtureaispace.github.io/` or `https://github.com/NurtureAISpace/mars-food-intelligence` if the repository is set to public.)*

---

## 5. Detailed Description

```text
### How It Works: From Stored Food to Astronaut Health

Long-duration missions (450 Sols, or 462 Earth days, in our Mars scenario) carry pre-packaged food whose heat-sensitive vitamins degrade over time. Published NASA studies report vitamin C losses of 32–83% in most fruit products after 3 years at 21 °C (Cooper et al. 2017) and thiamine (B1) retention after 720 days at 20 °C of 55% in brown rice, 42% in split pea soup, and 3% in beef brisket (Goulette et al. 2020). If a cooling unit fails, vitamin loss speeds up.

NurtureAISpace follows that chain step by step:
`Food storage -> Vitamin loss -> Body vitamin levels -> Personal-baseline warning -> What to eat`

1. **Crew Health Monitor (Synthetic 4-Person Crew):**
   - Computes daily vitamin C and thiamine B1 losses in stored rations using first-order kinetics anchored to Cooper 2017 and Goulette 2020 endpoints, then updates each astronaut's body vitamin pool (`~2,000 mg` max vitamin C pool with risk below `~300 mg`; `~30 mg` thiamine B1 store with `9–18` day half-life and an assumed `10 mg` risk threshold, from NASA JSC 2005).
   - Tracks serum vitamin D (`25(OH)D`) using the in-flight decline measured on 11 ISS astronauts (`63 ± 16` to `48 ± 20 nmol/L` over `128–195` days; Rice, Zwart & Smith, NTRS 20080026180), with a risk threshold at `25 nmol/L`.
   - Compares each astronaut's indicators against their own Sol 0–20 personal baseline (z-scores, `|z| >= 2.0`, plus scikit-learn `IsolationForest`) and forecasts how many Sols remain before a vitamin threshold is crossed.
   - Raises explainable **NOMINAL / WATCH / ACT** alerts (`WATCH` at `<= 120` Sols to risk or vital `|z| >= 2.0`; `ACT` at `<= 45` Sols to risk). In the default cooling-failure scenario (Sol 150, 45 Sols at 29.5 °C), it raises `ACT` alerts for thiamine B1 at Sols 212 and 244 and for vitamin D 45 Sols before crossing the risk line. Every alert gives a clear food or supplement recommendation and indicates when `ACT` status warrants flight-surgeon review.
   - *In progress (being added):* a 6-indicator daily self-assessment check-in (heart rate, blood pressure, fasting blood sugar, body temperature, daily sleep hours, and mood) with simplified navigation.

2. **Real NASA Data Screen (Inspiration4 Blood Panels):**
   - Built into the app (`RealDataView.tsx` / `GET /api/v1/real-data/i4`), this screen analyzes unmodified clinical blood tests from the 4 civilian astronauts (`C001–C004`) on the 3-day Inspiration4 mission (NASA OSDR OSD-569 CBC and OSD-575 CMP across 3 pre-flight draws `L-92, L-44, L-3` and 4 post-flight draws `R+1, R+45, R+82, R+194`).
   - Comparing each astronaut to their own 3 pre-flight tests (`|z| > 2`, with a minimum spread floor of 5% of the lab reference-range width) shows one consistent whole-crew shift at `R+1` (1 day after landing): **MCV (average red blood cell size) was lower than all 3 of their own pre-flight values in all 4 crew members** (on average 3.9% lower), while all 4 values stayed inside the standard 80–100 fL lab range.

3. **Supporting Scenario Modules (Labeled Synthetic):**
   - **Food & Vitamins / Data Lab / Diet Optimizer / Mission Simulator:** models Arrhenius shelf-life curves, runs a SciPy HiGHS linear programming solver (`>= 90 mg` vitamin C and `>= 1.2 mg` B1 from NASA JSC 2005; `2,800 kcal` and `85 g` protein assumed), and checks catalog kinetics against published endpoints (7 of 12 series currently agree, RMSE ~27 percentage points).
   - **Life Support Sim:** models OGS water electrolysis and Sabatier CO2 reduction using NASA BVAD crew rates (`0.816 kg` O2, `1.04 kg` CO2, `2.50 kg` potable water, `7.32 kg` hygiene water per crewmember-day) alongside a synthetic 3-bed soil-moisture threshold controller (`VWC <= 38%` open, `>= 50%` close).

### Tools & Technologies
Python, FastAPI, NumPy, Pandas, SciPy (`linprog` HiGHS), scikit-learn (`IsolationForest`), Pytest (49 passing tests + 3 `xfail` documenting model limits), React 18, TypeScript, Tailwind CSS.

### Honest Limits
- **Inspiration4 sample size:** 4 astronauts, 3 pre-flight baseline draws per person (requiring a 5% lab-range SD floor in 28 of 147 series), and a 3-day LEO mission. A pre-flight sanity check (`L-3` scored against `L-92 + L-44`) flags 26% of tests (`38/145`) vs 20% (`30/147`) at `R+1`, showing that single-analyte flags at `n = 3` are mostly day-to-day noise; only shifts shared across all 4 crew members (like MCV) are meaningful.
- **Synthetic 450-Sol scenario:** the 4-person Mars crew, food catalog nutrient/Arrhenius constants, greenhouse crop yields, and soil-sensor readings are synthetic and labeled `data_provenance: "synthetic"`.
- **Single-pool kinetics:** vitamin models do not include cosmic-radiation decay or multi-compartment tissue storage.

### Built Before vs. During the Hackathon (Git History Disclosure)
- **Before the hackathon (Nov 8–13):** Suleyman (Nov 8–11) committed the initial FastAPI backend, Arrhenius/SciPy/Simulator/Data Lab modules, food catalog, and Banu's initial frontend UI design. Yunis (Nov 13) committed the first version of the synthetic Crew Health module.
- **During the hackathon (Nov 14, from 11:10 local time):** Yunis built the NASA OSDR Inspiration4 real-data analysis and `Real NASA Data` app screen, replaced unsourced Crew Health constants with cited NASA/literature parameters (`literature_params.json`), added the vitamin D model, steady-state calibration, and `docs/DATA_SOURCES.md` provenance cleanup (plus the daily check-in and simplified navigation on branch `yunis`). Faruk Karimli built the Life Support / ECLSS & soil-moisture simulation module (backend, frontend tab, docs, and tests). Suleyman integrated branches and prepared submission materials.
```

---

## 6. NASA Data

```text
1. NASA Open Science Data Repository (OSDR) — Inspiration4 Clinical Blood Panels (Used directly in the app's "Real NASA Data" screen and `backend/data/real/i4/`):
   - Study OSD-569 (LSDS-7, Complete Blood Count, 553 rows, 23 analyte labels): https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
   - Study OSD-575 (LSDS-8, Comprehensive Metabolic Panel, 531 rows, 19 analyte labels): https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
   - Used to compute personal-baseline z-scores across 4 astronauts (C001–C004) over 3 pre-flight (L-92, L-44, L-3) and 4 post-flight (R+1, R+45, R+82, R+194) timepoints.

2. NASA JSC Nutritional Biochemistry Laboratory (2005), "Nutrition Requirements, Standards, and Operating Bands for Exploration Missions" (NTRS 20200001703):
   - URL: https://ntrs.nasa.gov/citations/20200001703
   - Used for daily requirements and body-pool parameters in `backend/app/data/literature_params.json`: vitamin C (90 mg/day requirement, ~2,000 mg max body pool, ~300 mg deficiency threshold, 10–45 mg/day catabolic turnover, 100–140 mg/day saturation intake, 45–80 day scurvy onset, pp. 53–55), thiamine B1 (1.2 mg/day RDA, ~30 mg body store, 9–18 day biological half-life, pp. 60–61), and vitamin D (25 ug/day requirement, 25 nmol/L lower operating band, 80 nmol/L optimal reference, Mir 32–36% decline over 3–4 months, pp. 43–45).

3. Rice BL, Zwart SR, Smith SM (NASA JSC), "Vitamin D in Real and Simulated Weightlessness: Implications for Earth" (NTRS 20080026180) & Smith SM, Zwart SR (2006), "Nutrition issues for space exploration" (NTRS 20060049121):
   - URLs: https://ntrs.nasa.gov/citations/20080026180 and https://ntrs.nasa.gov/citations/20060049121
   - Used to parameterize in-flight serum 25(OH)D decline (63 ± 16 nmol/L pre-flight to 48 ± 20 nmol/L post-flight over 128–195 days on ISS, r = 0.00168/day, under 10 ug/day supplementation taken 5.7 ± 4.0 times/week).

4. NASA Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570/REV1 (2018) (NTRS 20180001338):
   - URL: https://ntrs.nasa.gov/citations/20180001338
   - Used in `backend/app/models/life_support_eclss.py` for crew metabolic O2 consumption (0.816 kg/CM-d, Table 3-33, p. 63), CO2 production (1.04 kg/CM-d, Table 3-33, p. 63), metabolic water (0.345 kg/CM-d, Table 3-33, p. 63), potable water (2.50 kg/CM-d, Table 4-20, p. 77), and hygiene water (7.32 kg/CM-d, Table 4-20, p. 77).

5. Challenge Resources Tab — NASA Human Research Program (HRP):
   - "5 Hazards of Human Spaceflight" (https://www.nasa.gov/hrp/hazards/) and "Risks of Human Spaceflight" (https://www.nasa.gov/hrp/risks/) from the challenge's Resources tab on `https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/` (optional extra slot if needed: `[CHALLENGE RESOURCE LINK]`). Used to map health indicators and dietary/operational countermeasures to the five spaceflight hazards (radiation, isolation/confinement, distance from Earth, gravity fields, hostile closed environments).
```

---

## 7. Partner & Other Data

```text
1. Peer-Reviewed Spaceflight Nutrition & Food Stability Literature:
   - Cooper M, Perchonok M, Douglas GL (2017). "Initial assessment of the nutritional quality of the space food system over three years of ambient storage." npj Microgravity 3:17. DOI: https://doi.org/10.1038/s41526-017-0022-z (Open access: https://pmc.ncbi.nlm.nih.gov/articles/PMC5466603/). Used for 3-year vitamin C loss (32–83% at 21 °C, midpoint k_ref = 7.81e-4 /day) and benchmark comparison.
   - Goulette TR et al. (2020). "Kinetic parameters of thiamine degradation in NASA spaceflight foods determined by the endpoints method for long-term storage." Food Chemistry 302:125365. DOI: https://doi.org/10.1016/j.foodchem.2019.125365 (abstract read). Used for 720-day thiamine retention at 20 °C (55% brown rice, 42% split pea soup, 3% beef brisket) and derived class rate constants.
   - Smith SM, Zwart SR, Block G, Rice BL, Davis-Street JE (2005). "The nutritional status of astronauts is altered after long-term space flight aboard the International Space Station." Journal of Nutrition 135(3):437–443. DOI: https://doi.org/10.1093/jn/135.3.437 (abstract read). Used for ISS mission duration (128–195 days, n = 11) and mean energy intake (80% of recommended).
   - Smith SM, Gardner KK, Locke J, Zwart SR (2009). "Vitamin D supplementation during Antarctic winter." American Journal of Clinical Nutrition 89(4):1092–1098. DOI: https://doi.org/10.3945/ajcn.2008.27189 (reference context only).

2. Canadian Space Agency (CSA) — Challenge Partner Resource:
   - "Monitoring Radiation for Astronaut Health" (https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp), listed on the challenge Resources tab.

3. Synthetic Scenario Data (Created by the Team & Labeled `synthetic`):
   - The 4-person Mars crew time series (vitals, appetite variation, noise), the illustrative space food catalog (`space_food_catalog.json`), greenhouse crop parameters (`crop_models.json`), cooling-failure stress scenario, and non-BVAD life-support/soil-moisture parameters are synthetic scenario values created to run the prototype end-to-end and are explicitly tagged with `data_provenance: "synthetic"` in the codebase and UI.
```

---

## 8. Use of AI

```text
1. In-Application Machine Learning & Statistical Detection:
   - Inside the application, we use an unsupervised scikit-learn `IsolationForest` model alongside personal-baseline z-score detectors (`|z| >= 2.0` relative to each astronaut's Sol 0–20 baseline) on synthetic crew vitals and vitamin trajectories. The personal-baseline z-score method (without IsolationForest, due to n = 3 pre-flight points) is also applied to the real NASA OSDR Inspiration4 blood panels.

2. AI Coding & Research Assistants During Development:
   - We used AI assistants (Claude Code, Google Antigravity / Gemini, and Gemini Deep Research) to assist with writing and refactoring Python/TypeScript code, building unit tests, drafting documentation, and locating primary NASA NTRS and OSDR literature.
   - Every equation, code change, and dataset integration was reviewed by team members, verified by automated Pytest checks, and documented with exact source citations, page numbers, and `literature / derived / assumed / synthetic` labels in `docs/DATA_SOURCES.md` and `backend/app/data/literature_params.json`.

3. Visuals & Branding Compliance:
   - No official NASA logos or insignias are used anywhere in the project. The NurtureAISpace logo is a custom-coded SVG vector graphic. No unwatermarked AI-generated images or videos are used.
```

---

## 9. Verification Checklist: Every Number in This File Traced to Its Source

| Number / Value in `SUBMISSION_FIELDS_EN.md` | Exact Source File in Repo & Primary Reference | Status |
|---|---|---|
| `450` Sols (`462` Earth days, `1.02749` Earth days/Sol) | `docs/DATA_SOURCES.md` (Section 2, Physics & chemistry), `README.md` | Verified |
| `32–83%` vitamin C loss after `3` years (`1,095` days) at `21 °C` (`k_ref = 7.81e-4 /day`) | `docs/DATA_SOURCES.md` (p. 2), `backend/app/data/literature_params.json` (`kinetics.vitamin_c.reference`, `COOPER_2017`) | Verified (Literature / Derived) |
| `720` days at `20 °C` thiamine retention: `55%` (brown rice), `42%` (split pea soup), `3%` (beef brisket) | `docs/DATA_SOURCES.md` (p. 2), `backend/app/data/literature_params.json` (`kinetics.thiamine_b1.reference`, `GOULETTE_2020`) | Verified (Literature) |
| Vitamin C: `90 mg/day` requirement, `~2,000 mg` (`~2 g`) max pool, `~300 mg` risk threshold, `10–45 mg/day` turnover, `100–140 mg/day` saturation, `45–80` days scurvy onset | `docs/DATA_SOURCES.md` (p. 2), `backend/app/data/literature_params.json` (`NASA_JSC_2005_REQ`, NTRS 20200001703, printed pp. 53–55) | Verified (Literature) |
| Thiamine (B1): `1.2 mg/day` RDA (men), `~30 mg` body store, `9–18` days biological half-life, `10 mg` (`1/3` store) risk threshold | `docs/DATA_SOURCES.md` (p. 2), `backend/app/data/literature_params.json` (`NASA_JSC_2005_REQ`, pp. 60–61; `10 mg` threshold marked `assumed`) | Verified (Literature + Disclosed Assumption) |
| Vitamin D: `25 µg/day` requirement, `25 nmol/L` lower limit, `80 nmol/L` optimal, Mir `32–36%` decline over `3–4` months | `docs/DATA_SOURCES.md` (p. 2), `backend/app/data/literature_params.json` (`NASA_JSC_2005_REQ`, pp. 43–45) | Verified (Literature) |
| ISS Vitamin D cohort: `n = 11` astronauts, `128–195` days, `80%` mean energy intake, `63 ± 16 nmol/L` pre-flight to `48 ± 20 nmol/L` post-flight (`r = 0.00168 /day`), `10 µg/day` supplement taken `5.7 ± 4.0` times/week | `docs/DATA_SOURCES.md` (pp. 2–3), `backend/app/data/literature_params.json` (`SMITH_2005`, `RICE_ZWART_SMITH_NTRS` NTRS 20080026180) | Verified (Literature / Derived) |
| Personal-baseline window Sols `0–20`, `WATCH` at `<= 120` Sols to risk or vital `|z| >= 2.0`, `ACT` at `<= 45` Sols to risk | `docs/CREW_HEALTH.md`, `backend/app/services/crew_health_service.py` | Verified |
| Default cooling-failure scenario (Sol `150`, `45` Sols at `29.5 °C`): B1 `ACT` alerts at Sols `212` and `244`, Vitamin D `ACT` alert `45` Sols before crossing threshold | `README.md` (lines 55–57), `docs/DATA_SOURCES.md` (Section 3) | Verified |
| Inspiration4 OSDR `OSD-569` (`LSDS-7` CBC, `553` rows, `23` analyte labels) & `OSD-575` (`LSDS-8` CMP, `531` rows, `19` analyte labels), `4` crew (`C001–C004`), `3`-day mission, `3` pre-flight (`L-92, L-44, L-3`) & `4` post-flight (`R+1, R+45, R+82, R+194`) timepoints | `docs/DATA_SOURCES.md` (Section 1), `backend/data/real/i4/README.md` | Verified (Real NASA Data) |
| Inspiration4 `R+1` finding: MCV lower than all `3` pre-flight tests in all `4` crew (mean `-3.9%`), still inside `80–100 fL` lab range; `5%` lab-range SD floor used in `28` of `147` series; noise check `26%` (`38/145`) flagged at `L-3` vs `20%` (`30/147`) at `R+1` | `backend/scripts/i4_baseline_demo.py`, `backend/app/services/real_data_service.py`, `frontend/src/components/RealDataView.tsx` (branch `yunis`) | Verified (Computed directly from OSDR CSVs) |
| Optimizer targets: `>= 90 mg` Vit C, `>= 1.2 mg` B1 (NASA JSC 2005); `2,800 kcal` energy, `85 g` protein (assumed) | `SPACEAPPS_GANJA_2026_SUBMISSION.md` (line 40), `docs/DATA_SOURCES.md` (Section 2 & 3) | Verified |
| Catalog vs. literature endpoints: `7` of `12` series agree, `RMSE ≈ 27` percentage points | `README.md` (line 34), `docs/DATA_SOURCES.md` (line 166) | Verified |
| NASA BVAD REV1 rates: `0.816 kg` O2, `1.04 kg` CO2, `0.345 kg` metabolic water (Table 3-33, p. 63); `2.50 kg` potable water, `7.32 kg` hygiene water (Table 4-20, p. 77) per crewmember-day | `docs/DATA_SOURCES.md` (lines 121–135), `backend/app/models/life_support_eclss.py` | Verified (Literature) |
| Synthetic soil-moisture thresholds: `3` crop beds, valve opens at `VWC <= 38%`, closes at `VWC >= 50%` | `SPACEAPPS_GANJA_2026_SUBMISSION.md` (lines 56–57), `docs/DATA_SOURCES.md` (Section 3) | Verified (Labeled Synthetic) |
| Backend test suite: `49` passing tests + `3` expected failures (`xfail`) | `README.md` (line 146) | Verified |

### Unverified / Flagged Items & Placeholders
- **Placeholders left for manual replacement before clicking Submit:**
  1. `[PROJECT_DEMO_LINK]` in **Project Demo** (paste your public 7-slide deck URL `https://nurtureaispace.github.io/slides.html` or ≤30s video URL).
  2. `[FINAL_PROJECT_LINK]` in **Final Project** (paste `https://nurtureaispace.github.io/` and/or the GitHub repo URL).
  3. `[CHALLENGE RESOURCE LINK]` noted as an optional extra slot in **NASA Data** Item 5, alongside the verified links extracted directly from the challenge's Resources tab (`https://www.nasa.gov/hrp/hazards/` and `https://www.nasa.gov/hrp/risks/`).
- **In-progress feature flag:**
  - The **6-indicator Daily Check-in + simplified navigation** is committed on branch `origin/yunis` (`a49d459`, `4afba05`, `fc8c04d`) and is not yet merged into `origin/main` (`a46804a`), so it is explicitly described as *"being added"* in both the High-Level Summary and Detailed Description, per instructions.
- **Unverified / Assumed items (all explicitly disclosed as `assumed` or `synthetic` in the text):**
  - Full-text kinetic activation energies (`Ea`) from Goulette et al. 2020 were not accessed (only abstract endpoints at 20 °C were read); per-item `A` and `Ea` in `space_food_catalog.json` are synthetic.
  - The `10 mg` thiamine risk threshold (`1/3` of the `~30 mg` body store) and linear vitamin D intake-response interpolation are modeling assumptions (`status: "assumed"` in `literature_params.json`).
