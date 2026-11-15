<!-- Factual corrections by Yunis Allahverdi on 2026-11-14 16:40 (+04:00), see commit. Sources: docs/DATA_SOURCES.md, backend/app/data/literature_params.json, git history. -->
# NASA International Space Apps Challenge Ganja 2026 — Official Submission & Judging Guide
**Event:** 14–15 November 2026 · Innovation Center, Azerbaijan State Agricultural University (ADAU), Ganja  
**Team Name:** `NurtureAISpace`  
**Live Interactive Web App:** [https://nurtureaispace.github.io/](https://nurtureaispace.github.io/)  
**Official 7-Slide Pitch Deck (Print/PDF Ready, Public & Password-Free):** [https://nurtureaispace.github.io/slides.html](https://nurtureaispace.github.io/slides.html)  

---

## 1. Online Submission Fields for `spaceappschallenge.org` (Page 8 of Official Program — In English)

### Project Name
`NurtureAISpace: Sol-450 Autonomous Space Nutrition, Crew Biomarker AI & Closed-Loop ECLSS Twin`

### High-Level Summary
Long-duration Mars missions (our scenario: 450 Sols) face a micronutrient gap. Stored food loses vitamins over time: NASA studies report vitamin C losses of 32–83% in most fruit products after 3 years at 21 °C (Cooper et al. 2017), and thiamine (B1) retention after 720 days at 20 °C between 3% and 55% depending on the food (Goulette et al. 2020). At the same time, habitats must recycle O2/H2O and track astronaut health without Earth resupply. NurtureAISpace is an integrated 4-engine digital twin combining:
1. Arrhenius shelf-life kinetics, SciPy HiGHS LP ration optimization and a synthetic greenhouse crop model.
2. Crew-health early warning: personal-baseline z-scores and IsolationForest on a synthetic crew, with vitamin C, B1 and D models whose parameters come from NASA and peer-reviewed sources. The same baseline method is applied to real NASA OSDR Inspiration4 blood panels (OSD-569 / LSDS-7, OSD-575 / LSDS-8).
3. Closed-loop ECLSS OGS/Sabatier stoichiometric simulation with NASA BVAD crew rates.
4. A synthetic 3-bed soil-moisture threshold irrigation controller.

### Project Demo (≤ 7 Slides, Public & Password-Free)
- **7-Slide Pitch Deck URL:** `https://nurtureaispace.github.io/slides.html`
- **Interactive Judge Q&A & NASA Data View:** `https://nurtureaispace.github.io/#judgingView`

### Final Project (Public Links)
- **Live Web Application:** `https://nurtureaispace.github.io/`
- **GitHub Organization:** `https://github.com/NurtureAISpace`
- **Web Portal & Client Simulation Repository:** `https://github.com/NurtureAISpace/NurtureAISpace.github.io`
- **Core FastAPI + SciPy + ML Repository:** `https://github.com/NurtureAISpace/mars-food-intelligence`
- **Data sources (every number traced to real NASA data, a cited source, or a labeled synthetic value):** `https://github.com/NurtureAISpace/mars-food-intelligence/blob/main/docs/DATA_SOURCES.md`

### Detailed Description
Astronauts on a long Mars surface mission (450 Sols in our scenario) cannot rely solely on pre-packaged thermostabilized or freeze-dried food. First-order Arrhenius thermal degradation (`k(T) = A * exp(-Ea / R*T)`) steadily depletes labile micronutrients, specifically ascorbic acid (vitamin C) and thiamine (vitamin B1), during multi-year storage. A cooling failure speeds this up, risking scurvy, beriberi, oxidative stress, and cognitive decline. Simultaneously, every liter of water and mole of oxygen inside the Mars surface habitat must be balanced across crew metabolism, crop transpiration, water electrolysis (OGS), and Sabatier methanation, while crew physiological biomarkers shift under microgravity and deep-space radiation.

**NurtureAISpace** solves this through four tightly coupled operational subsystems:
1. **Arrhenius Kinetics, Hydroponic Bio-Agro & SciPy HiGHS LP Optimizer (Suleyman Hajizadeh & Banu Gurbanizada):**
   - Computes nutrient retention across stored rations (simulator range Sol 0 to Sol 1,200) under ambient (`21°C`), chilled (`4°C`), and frozen (`-20°C`) storage.
   - Pairs degrading rations with a synthetic greenhouse crop model (microgreens, spirulina, dwarf cherry tomato, dwarf sweet potato; illustrative values).
   - Solves a multi-objective Linear Program (`scipy.optimize.linprog`, HiGHS solver) to meet daily nutrient targets while minimizing storage mass and chiller power. The targets are `>=90 mg` vitamin C and `>=1.2 mg` vitamin B1 from the NASA JSC 2005 exploration nutrition requirements, plus `2,800 kcal` and `85 g` protein, which are assumed planning targets.
   - Food-catalog nutrient values are synthetic. We compare the catalog kinetics openly with published endpoints (Cooper 2017, Goulette 2020); 7 of 12 series currently agree.
2. **Crew Health AI & Spaceflight Hematology/Biochemistry Engine (Yunis Allahverdi):**
   - Analyzes real human spaceflight blood panels from the **NASA Open Science Data Repository (OSDR)**, specifically **OSD-569 / LSDS-7 (Inspiration4 Complete Blood Count)** and **OSD-575 / LSDS-8 (Inspiration4 Comprehensive Metabolic Panel)**. They cover pre-flight (`L-92`, `L-44`, `L-3`), return (`R+1`) and recovery (`R+45`, `R+82`, `R+194`) timepoints.
     - Each astronaut's post-flight values are compared with their own pre-flight baseline (z-scores, flag at |z| > 2).
     - This currently runs as an analysis script; the app panel is in progress.
   - Tracks first-order body vitamin pools coupled directly to the habitat's daily dietary output:
     - vitamin C, with a maximum pool of about 2,000 mg and a risk level of about 300 mg (NASA JSC 2005);
     - vitamin B1, with a store of about 30 mg (NASA JSC 2005);
     - vitamin D status (serum 25(OH)D), using the ISS in-flight decline measured by Rice, Zwart & Smith.
   - Runs an unsupervised **IsolationForest** anomaly detector and a personal baseline z-score tracker on a synthetic crew. They flag subclinical vitamin depletion and unusual vitals, then recommend a corrective food: a fresh crop when the greenhouse is online, otherwise the best packaged item or a vitamin D supplement.
3. **Closed-Loop ECLSS Environmental Simulator (Faruk Karimli):**
   - Simulates habitat gas and water mass balances across OGS electrolysis (`2 H2O -> 2 H2 + O2`) and Sabatier carbon capture (`CO2 + 4 H2 -> CH4 + 2 H2O`).
   - Crew metabolic rates come from NASA BVAD: O2 `0.816 kg` and CO2 `1.04 kg` per crewmember-day, potable water `2.50 kg/CM-d`, hygiene water `7.32 kg/CM-d`.
   - Photosynthetic gas exchange from three crop beds is synthetic. Recovery efficiencies and loop closure are assumed scenario values.
4. **Regolith Soil Moisture Controller (Faruk Karimli):**
   - Simulates capacitive soil-moisture sensors (VWC %, EC, root temperature) with synthetic readings across 3 crop beds.
   - Threshold-based valve control opens at `VWC <= 38%` and closes at `VWC >= 50%`.

### NASA Data
1. **NASA Open Science Data Repository (OSDR) — OSD-569 / LSDS-7 & OSD-575 / LSDS-8 (Inspiration4 Mission):**
   - Real astronaut Complete Blood Count (CBC: WBC, RBC, Hemoglobin, Hematocrit, Platelets, MCV, Neutrophils, Lymphocytes) and Comprehensive Metabolic Panel (CMP: Glucose, BUN, Creatinine, Calcium, Sodium, Potassium, AST, ALT, Bilirubin, Albumin).
   - 28 astronaut-timepoint records (4 crew × 7 timepoints), stored in `backend/data/real/i4/`.
2. **NASA JSC 2005, Nutrition Requirements, Standards, and Operating Bands for Exploration Missions (NTRS 20200001703):**
   - Vitamin C requirement 90 mg/day, body pool about 2 g, deficiency risk below about 300 mg.
   - Thiamin store about 30 mg, half-life 9–18 days, RDA 1.2 mg/day.
   - Vitamin D requirement 25 µg/day, 25(OH)D lower limit 25 nmol/L.
   - ISS vitamin D data: Smith et al. 2005 (*J Nutr*) and Rice, Zwart & Smith (NTRS 20080026180).
3. **NASA BVAD (Life Support Baseline Values and Assumptions Document, NASA/TP-2015-218570/REV1):**
   - Crew O2 consumption (`0.816 kg/CM-d`) and CO2 production (`1.04 kg/CM-d`), Table 3-33.
   - Potable (`2.50 kg/CM-d`) and hygiene (`7.32 kg/CM-d`) water use, Table 4-20.
   - OGS/Sabatier stoichiometric ratios follow from the reaction equations.
4. **NASA spaceflight food shelf-life studies:**
   - Cooper et al. 2017 (*npj Microgravity*): vitamin C loss of 32–83% in most fruit products after 3 years at 21 °C.
   - Goulette et al. 2020 (*Food Chemistry*): thiamine retention after 720 days at 20 °C of 55% (brown rice), 42% (split pea soup) and 3% (beef brisket).
   - These endpoints anchor the crew-health storage losses. The per-item activation energies in the food catalog are synthetic.

### Partner & Other Data
- None. MGS-1 (Mars Global Simulant) is named as the regolith context of the soil-moisture simulation, but no MGS-1 measurement data is used.

### Use of AI
- **In-Application Machine Learning:**
  - Scikit-learn (`IsolationForest`) and statistical z-score personalization are used inside the application to detect anomalies across crew vitals and vitamin intake. The crew is synthetic.
  - The personal-baseline z-score method is also applied to the real NASA OSDR Inspiration4 blood biomarkers, in an analysis script.
- **Development Assistance Disclosure:**
  - Generative AI coding assistants (GitHub Copilot / LLM pair-programming, including Claude Code) were used to write and refactor code, tests and documentation, and for UI layout, SVG chart rendering, and documentation formatting.
  - Model parameters are traced to cited NASA and peer-reviewed sources in `docs/DATA_SOURCES.md` and `backend/app/data/literature_params.json`. Values without a source are labeled as assumed or synthetic.
- **Branding & Visual Compliance:** The `NurtureAISpace` emblem is a 100% custom-coded SVG vector graphic (`favicon.svg` / `logo.svg`). **No official NASA logos, insignias, or unwatermarked AI-generated media are used anywhere in this project.**

---

## 2. Mandatory Judge Questions & Pre-Hackathon Disclosure (Pages 2, 6 & 7 of Official Program)

### Suallara Cavablar (3 Mandatory Judge Questions — Page 6)
1. **Sual 01: Hakaton zamanı nəyi hazırladınız? (Rule #4 Disclosure)**
   - **Hakatondan əvvəl (Pre-existing — 0 bal tələb olunur), git tarixçəsinə görə:**
     - **Süleyman (8–11 noyabr):** ilkin tətbiq, yəni FastAPI backend, Arrhenius kinetik mühərriki, SciPy LP rasion optimallaşdırıcısı, Mission Simulator, Dashboard / Data Lab / Prediction / Optimizer bölmələri və qida kataloqu. Banu-nun frontend dizaynı da bu ilkin versiyada (Süleymanın commit-i ilə) əlavə olunub. Buraya təqdimat sənədləri və brendinq də daxildir.
     - **Yunis Allahverdi (13 noyabr):** Crew Health modulunun ilk versiyası (ML nüvəsi, API, Crew Health bölməsi, sənədlər).
     - Veb portal (`nurtureaispace.github.io`) ayrıca repozitoriyadadır; onun tarixçəsi bu siyahıya daxil deyil.
   - **Hakaton zamanı (14 noyabr, 11:10-dan sonra):**
     - **Yunis Allahverdi:** NASA OSDR `OSD-569 / LSDS-7` və `OSD-575 / LSDS-8` (Inspiration4) real astronavt qan analizləri üzərində fərdi baza xətti (`z-score`) analizi. Bu iş 14 noyabr səhəri, açılış mərasimi ətrafında başlanıb və saat 11:20-də commit edilib. Bundan əlavə: ədəbiyyat mənbəli parametrlər (NASA JSC 2005, Cooper 2017, Goulette 2020 və s.), D vitamini modeli, kalibrləmə və xəbərdarlıq izahları, həmçinin məlumat mənbələrinin təmizlənməsi (`docs/DATA_SOURCES.md`, sintetik dataların etiketlənməsi, NASA BVAD istinadları).
     - **Faruk Karimli:** Qapalı dövrəli ECLSS (OGS elektroliz + Sabatier reaktoru) qaz/su balansı simulyatoru, sintetik torpaq nəmliyi suvarma kontrolleri və Life Support bölməsi.
     - **Süleyman:** branch-ların birləşdirilməsi (merge) və bu təqdimat bələdçisi.
     - **Banu:** hakaton zamanı bu repozitoriyada ayrıca commit yoxdur.

2. **Sual 02: Hansı NASA məlumatından istifadə etdiniz? Göstərin.**
   - Canlı tətbiqdə **`Crew Health`** və **`Data Lab`** bölmələrində ədəbiyyat mənbəli parametrlər və nəticələr göstərilir. Real Inspiration4 datası hazırda analiz skripti ilə işlənir; tətbiq paneli hazırlanır.
     - **NASA OSDR `OSD-569 / LSDS-7` & `OSD-575 / LSDS-8`:** Inspiration4 missiyasının real astronavt qan panelləri (`C001–C004`, `L-92`-dən `R+194`-ə qədər 28 qeyd, CBC və CMP göstəriciləri). Hər astronavt öz uçuşdan əvvəlki bazası ilə müqayisə olunur (skript).
     - **NASA JSC 2005 qidalanma tələbləri & NASA BVAD (NASA/TP-2015-218570/REV1):** gündəlik `90 mq Vit C`, `1.2 mq Vit B1`, `25 µq Vit D`; `0.816 kq O2` və `1.04 kq CO2` (ekipaj üzvü/gün).
     - **NASA qida rəf ömrü tədqiqatları (Cooper 2017, Goulette 2020):** C vitamini 3 ildə (21 °C) 32–83% itki; tiaminin 720 gündən sonra (20 °C) qalıq faizi 3–55%.

3. **Sual 03: Hələ nə işləmir? Vaxtınız olsaydı, nə əlavə edərdiniz?**
   - **Hazırda nə işləmir (Məhdudiyyətlər):**
     1. Torpaq nəmliyi sensorları və suvarma klapanları yalnız sintetik simulyasiyadır; real MGS-1 reqolit torpağında aparat (ESP32/Arduino) üzərində qoşulmayıb.
     2. Arrhenius modeli bircinsli (homogen) saxlama temperaturu fərz edir; kosmik radiasiyanın (GCR/SPE) vitamin parçalanmasına birbaşa təsiri ayrıca radiolitik hədd kimi daxil edilməyib.
     3. NASA OSDR `LSDS-7/8` datası qısa müddətli LEO (Inspiration4, 3 gün) uçuşuna aiddir və hazırda yalnız analiz skriptində istifadə olunur. 450 Sol-luq ssenaridəki ekipaj datası sintetikdir.
     4. Qida kataloqundakı qida dəyərləri və kinetik sabitlər sintetikdir; dərc olunmuş nəticələrlə müqayisədə 12 seriyadan yalnız 7-si uyğun gəlir.
   - **Vaxtımız olsaydı nə əlavə edərdik (Gələcək Plan):**
     1. Fiziki ESP32 + tutumlu sensor + MGS-1 reqolit sınaq stendinin (hardware-in-the-loop) ADAU laboratoriyasında qurulması.
     2. Bitki yarpaqlarında xloroz və qida çatışmazlığını kameradan tanıyan Computer Vision (CNN) modulunun əlavə edilməsi.
     3. Qrup üzvlərinin qlükoza və kortizol səviyyələrini real vaxtda oxuyan geyilə bilən (wearable) biosensor API inteqrasiyası.
