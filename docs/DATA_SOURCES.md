# Data Sources

Every number in NurtureAISpace falls into one of three groups:

1. **Real NASA data.** Public files downloaded from NASA, unmodified.
2. **NASA documents and peer-reviewed literature.** Values read from a cited source, with the page or section.
3. **Synthetic scenario elements.** Illustrative values we chose. They are labeled `synthetic` in the data files, in the
   API (`data_provenance` field) and in the UI.

Generated on 2026-11-14 from `backend/app/data/literature_params.json` (per-parameter source, page and status) and
`backend/data/real/i4/README.md`. The life-support rates were read from the BVAD PDF (section 2). If a value in the code
disagrees with this page, the JSON file and the code comments are authoritative. Please report the mismatch.

---

## 1. Real NASA data

**Inspiration4 (I4) clinical blood panels, NASA Open Science Data Repository (OSDR).** SpaceX Inspiration4, September 2021,
about 3 days in orbit, 4 civilian crew (de-identified as C001–C004). The files are in `backend/data/real/i4/` and were
downloaded on 2026-11-14. Their sizes match the OSDR file-listing API.

| Study | Panel | Files | Study page |
|---|---|---|---|
| OSD-569 (LSDS-7) | Complete Blood Count (CBC), 553 rows, 23 analytes | `LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv` (+ `_TRANSFORMED`) | https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 |
| OSD-575 (LSDS-8) | Comprehensive Metabolic Panel (CMP), 531 rows, 19 analytes | `LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv` (+ `_TRANSFORMED`) | https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 |

- Timepoints: L-92, L-44 and L-3 (days before launch); R+1, R+45, R+82 and R+194 (days after return).
- File listing API: https://osdr.nasa.gov/osdr/data/osd/files/569 and https://osdr.nasa.gov/osdr/data/osd/files/575
- Where it is used: `backend/scripts/i4_baseline_demo.py` computes personal-baseline z-scores (pre-flight baseline,
  post-flight deviation) for each astronaut. **It is not yet wired into the web app or the API.**
- If you use these data, please cite OSD-569 and OSD-575 and the Inspiration4 / SOMA publications.

---

## 2. NASA documents and peer-reviewed literature

The Crew Health model reads all its constants from `backend/app/data/literature_params.json`. Each entry records its
value, unit, source, page or section (`where_in_source`) and a status:

- `literature`: stated directly in the source.
- `derived`: computed from literature values with the formula given in the entry's note.
- `assumed`: no accessible source.

The API exposes this table at `GET /api/v1/health/parameters`.

### NASA JSC 2005: exploration nutrition requirements
NASA JSC Nutritional Biochemistry Laboratory. *Nutrition Requirements, Standards, and Operating Bands for Exploration
Missions.* Initial Release (rev 1), Dec 2005. NTRS 20200001703 (JSC-E-DAA-TN71711).
https://ntrs.nasa.gov/citations/20200001703. Full text read.

- Vitamin C, printed pp. 53–55:
  - maximum body pool ~2 g;
  - catabolic turnover 10–45 mg/day;
  - tissue saturation at 100–140 mg/day intake;
  - deficiency below ~300 mg pool;
  - scurvy within 45–80 days of zero intake;
  - requirement 90 mg/day (Req. 11).
- Thiamin, printed pp. 60–61: ~30 mg body store, biological half-life 9–18 days, RDA 1.2 mg/day (men).
- Vitamin D, printed pp. 43–45:
  - requirement 25 µg/day (Req. 8);
  - green band starts at 25 nmol/L 25-OH-D;
  - "optimal may be as high as 80 nmol/L";
  - Mir crew 32–36% lower after 3–4 months;
  - no decline after 28–59-day missions.
- Also used for the nominal vitamin C (90 mg) and thiamine (1.2 mg) daily targets in `backend/app/core/constants.py`.
  The min/max of those targets and all other nutrient targets are assumed.

### Cooper et al. 2017: vitamin C in stored space food
Cooper M, Perchonok M, Douglas GL. Initial assessment of the nutritional quality of the space food system over three
years of ambient storage. *npj Microgravity* 3:17 (2017). https://doi.org/10.1038/s41526-017-0022-z
(open access: https://pmc.ncbi.nlm.nih.gov/articles/PMC5466603/). Full text read.

- Results / Fig. 2: vitamin C in most fruit products degraded 32–83% after 3 years at 21 °C.
  - Derived first-order rate constant: k = −ln(0.425)/1095 d = 7.81e-4 /day (midpoint loss).
  - Measured on fruit products only.

### Goulette et al. 2020: thiamine degradation kinetics in NASA foods
Goulette TR, Zhou J, Dixon WR, Normand MD, Peleg M, McClements DJ, Decker E, Xiao H. Kinetic parameters of thiamine
degradation in NASA spaceflight foods determined by the endpoints method for long-term storage. *Food Chemistry*
302:125365 (2020). https://doi.org/10.1016/j.foodchem.2019.125365. Abstract only. The paper's full kinetic parameters
were not accessed.

- Model-predicted thiamine retention after 720 days at 20 °C:
  - brown rice (grain) 55%;
  - split pea soup (legume) 42%;
  - BBQ beef brisket (meat) 3%.
- Derived first-order k_ref = −ln(retention)/720 d for each food class.

### Smith et al. 2005: nutritional status of ISS astronauts
Smith SM, Zwart SR, Block G, Rice BL, Davis-Street JE. The nutritional status of astronauts is altered after long-term
space flight aboard the International Space Station. *J Nutr* 135(3):437–443 (2005). https://doi.org/10.1093/jn/135.3.437.
Abstract only.

- 11 astronauts, 128–195-day missions.
- Crew consumed a mean of 80% of recommended energy intake.
- 25-OH-D decreased after flight despite supplements.

### Rice, Zwart & Smith (NTRS 20080026180): vitamin D in weightlessness
Rice BL, Zwart SR, Smith SM. *Vitamin D in Real and Simulated Weightlessness: Implications for Earth.* Conference abstract,
NASA JSC. NTRS 20080026180. https://ntrs.nasa.gov/citations/20080026180. Full text read.

- 25-OH-D before flight 63 ± 16 nmol/L, after landing 48 ± 20 nmol/L (same n = 11 ISS cohort).
- Supplement 10 µg/day, taken 5.7 ± 4.0 times/week.
- Derived in-flight decline rate: ln(63/48)/161.5 d = 0.00168 /day.

### Smith & Zwart (NTRS 20060049121): nutrition issues for space exploration
Smith SM, Zwart SR. *Nutrition issues for space exploration.* NASA JSC manuscript. NTRS 20060049121.
https://ntrs.nasa.gov/citations/20060049121. Full text read.

- Used as corroboration only: 400 IU vitamin D supplement, deficiency below 25 nmol/L, energy intake 74 ± 11% of WHO
  recommendation, and no UV exposure in flight.

### Smith et al. 2009: vitamin D supplementation in Antarctic winter
Smith SM, Gardner KK, Locke J, Zwart SR. Vitamin D supplementation during Antarctic winter. *Am J Clin Nutr*
89(4):1092–1098 (2009). https://doi.org/10.3945/ajcn.2008.27189. Abstract only.

- 25-OH-D after ~5 months without UV: 34 / 57 / 63 / 71 nmol/L at 0 / 400 / 1000 / 2000 IU/day.
- Reference only. Not used in the model.

### NASA BVAD: life support baseline values (life-support simulation)
Anderson MS, Ewert MK, Keener JF. *Life Support Baseline Values and Assumptions Document.* NASA/TP-2015-218570/REV1,
NASA Johnson Space Center, January 2018. https://ntrs.nasa.gov/citations/20180001338. Full text read for the tables
below; page numbers are printed page numbers.

| Value in `backend/app/models/life_support_eclss.py` | BVAD value | Location |
|---|---|---|
| O₂ consumed | 0.816 kg per crewmember-day | Table 3-33, p. 63 |
| CO₂ produced | 1.04 kg per crewmember-day | Table 3-33, p. 63 |
| Potable water (drinking + food rehydration) | 2.50 kg per crewmember-day (2.00 + 0.50) | Table 4-20, p. 77 |
| Hygiene water | 7.32 kg per crewmember-day ("Mature Planetary Base" column) | Table 4-20, p. 77 |
| Metabolic water | 0.345 kg per crewmember-day | Table 3-33, footnote 82, p. 63 |

- These are per Earth day. The code converts them to per Sol (× 1.02749) and takes 1 kg of water as 1 L.
- Choosing the "Mature Planetary Base" hygiene column is our modelling decision; BVAD gives 1.98 kg/CM-d for an
  "Early Planetary Base".

### Physics and chemistry (no data source needed)
- The Arrhenius equation, first-order decay and half-life formulas.
- Electrolysis and Sabatier stoichiometry: 1.126 kg H₂O per kg O₂, 0.126 kg H₂ per kg O₂, 0.818 kg H₂O per kg CO₂, all
  from molar masses.
- Mars Sol = 1.02749 Earth days.

---

## 3. Synthetic scenario elements

These are illustrative values chosen to make the prototype run end to end. **None of them is a measurement or a
published value.**

| Element | Where | Why it exists | How it is labeled |
|---|---|---|---|
| Synthetic crew (4 astronauts, seed 42): appetite, turnover variation, vitals, vitals↔deficit mapping, noise | `backend/app/ml/crew_data.py`, `assumed` entries in `literature_params.json` | No individual astronaut time series is public at this resolution; needed to demonstrate personal baselines and alerts | `data_provenance` on every `/health/*` response; "Synthetic data" badge in the Crew Health tab |
| Cooling-failure scenario (Sol 150, 45 Sols, 29.5 °C), 120-Sol greenhouse outage, 70% rations, 15% appetite drop | `literature_params.json` (`scenario.post_event_response`), `CrewScenario` | Stress test for the early-warning chain | `assumed` status; scenario controls in the UI |
| Food catalog: nutrients per serving, packaging, shelf lives, sensory scores, per-item Arrhenius A and Ea | `backend/app/data/space_food_catalog.json` | Gives the optimizer, prediction tab and menus something to compute with | `dataset_meta.data_provenance = "synthetic"`; `/datalab/catalog` and `/datalab/audit` carry it; Data Lab header text |
| Greenhouse crop parameters (yields, energy, water recirculation, nutrients) | `backend/app/data/crop_models.json` | Dashboard harvest and power figures | `dataset_meta.data_provenance = "synthetic"`; `/dashboard/crop-status` |
| Dashboard figures (food mass, burn rate, security index, power, advisories) | `backend/app/api/routes_dashboard.py` | Mission overview | `data_provenance` on `/dashboard/telemetry`; "SYNTHETIC SCENARIO" badge |
| Mission simulator constants (ration-store A/Ea, sensory decay, 280 g/m²/Sol yield, 120 W/m² lighting, microbial viability, food-security index weights) | `backend/app/services/simulator_service.py`, `backend/app/core/scientific_models.py` | Sol-by-Sol stress test of the food store | `data_provenance` on `/simulator/run` |
| Nutrient targets other than vitamin C/thiamine nominal (calories, protein, carbohydrates, lipids, potassium, iron, hydration, all min/max) | `backend/app/core/constants.py` | Optimizer constraints | `source` field per entry; optimizer `data_provenance` |
| Life-support reserves, solar power, battery, recovery efficiencies (WRS 0.94, 95% loop closure), dust storm (−72% solar), leak effects, greenhouse gas exchange per bed, soil-sensor readings and irrigation thresholds | `backend/app/services/life_support_service.py`, `backend/app/models/life_support_eclss.py` | ECLSS demo | `data_provenance` on `/life-support/*`; "Synthetic scenario" in the Life Support tab |

### Removed on 2026-11-14 (no source)
- **"NASA JSC empirical" shelf-life benchmarks** (`experimental_shelf_life.json`). The "measured" points were generated by
  the catalog's own Arrhenius model, so R² ≈ 1 by construction. The cited report NASA/TM-2011-216157 is an unrelated
  robotics report on NTRS (20110011887). They are replaced by the literature-endpoint comparison at
  `GET /api/v1/datalab/validation-benchmarks`. That comparison currently shows the catalog kinetics do **not** match the
  literature: 7 of 12 series agree, RMSE ≈ 27 percentage points.
- **"Ganja/ADAU" crop cultivars** GC-26, GHM-01, GA-04 and GP-FERM, with their "Ganja" varieties and strains,
  perchlorate-remediation and salinity values. Nothing linked them to ADAU or to any study.
- **"NASA-STD-3001 compliant/verified" badges and status fields.** No check against NASA-STD-3001 is performed anywhere.

---

## Still assumed

These items are used by the model but have no accessible source yet. They are the first candidates to replace.

- Vitamin C and thiamine content per serving of every catalog item. These numbers feed the Crew Health intake.
- Per-item Arrhenius A and Ea in the catalog. They are used by the Prediction, Optimizer and Data Lab tabs; Crew Health
  uses only Ea, to scale literature rate constants away from 20–21 °C. Temperature sensitivity for thiamine is in the
  Goulette 2020 full text, which we have not accessed.
- Mapping of menu items to Goulette food classes (meat, grain or legume). Nuts are mapped to "grain" because there is no
  nut data.
- Applying the Cooper 2017 vitamin C rate (fruit products) to every packaged item.
- Thiamine risk threshold of 10 mg (1/3 of the ~30 mg store).
- Vitamin D: food intake set to 0; the linear intake-response between ISS intake and the 25 µg/day requirement;
  extrapolation of the ISS decline beyond 195 days.
- All synthetic-crew variation, vitals, the vitals↔deficit mapping and noise.
- Cooling-failure scenario parameters and post-event responses.
- Nutrient targets other than the nominal vitamin C and thiamine values.
- All life-support values not listed in the BVAD table above.
- The ±10 percentage-point agreement band used in the thiamine literature comparison.
