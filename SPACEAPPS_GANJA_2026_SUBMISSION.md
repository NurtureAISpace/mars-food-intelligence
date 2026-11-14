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
Long-duration Mars missions (900+ Sols) face a lethal micronutrient gap: stored rations lose 54–82% of Vitamin C and B1 by Sol 450, while habitats must recycle O2/H2O and track astronaut health without Earth resupply. NurtureAISpace is an integrated 4-engine digital twin combining: (1) Arrhenius shelf-life kinetics + SciPy HiGHS LP ration optimization + 6-crop hydroponics, (2) Real NASA OSDR (LSDS-7/LSDS-8 Inspiration4) hematology/biochemistry AI anomaly detection & 3-compartment vitamin pharmacokinetics, (3) Closed-loop ECLSS OGS/Sabatier stoichiometric simulation, and (4) 4-zone capacitive regolith soil moisture PID irrigation control.

### Project Demo (≤ 7 Slides, Public & Password-Free)
- **7-Slide Pitch Deck URL:** `https://nurtureaispace.github.io/slides.html`
- **Interactive Judge Q&A & NASA Data View:** `https://nurtureaispace.github.io/#judgingView`

### Final Project (Public Links)
- **Live Web Application:** `https://nurtureaispace.github.io/`
- **GitHub Organization:** `https://github.com/NurtureAISpace`
- **Web Portal & Client Simulation Repository:** `https://github.com/NurtureAISpace/NurtureAISpace.github.io`
- **Core FastAPI + SciPy + ML Repository:** `https://github.com/NurtureAISpace/mars-food-intelligence`

### Detailed Description
Astronauts on a 3-year Mars surface exploration mission (NASA Moon-to-Mars Architecture) cannot rely solely on pre-packaged thermostabilized or freeze-dried food. First-order Arrhenius thermal degradation (`k(T) = A * exp(-Ea / R*T)`) causes catastrophic depletion of labile micronutrients—specifically Ascorbic Acid (Vitamin C) and Thiamine (Vitamin B1)—long before Sol 450, risking clinical scurvy, beriberi, oxidative stress, and cognitive decline. Simultaneously, every liter of water and mole of oxygen inside the Mars surface habitat must be balanced across crew metabolism, crop transpiration, water electrolysis (OGS), and Sabatier methanation, while crew physiological biomarkers shift under microgravity and deep-space radiation.

**NurtureAISpace** solves this through four tightly coupled operational subsystems:
1. **Arrhenius Kinetics, Hydroponic Bio-Agro & SciPy HiGHS LP Optimizer (Suleyman Hajizadeh & Banu Gurbanizada):**
   - Computes daily nutrient retention across stored rations from Sol 0 to Sol 900 under ambient (`21°C`), chilled (`4°C`), and cryogenic (`-20°C`) storage.
   - Pairs degrading rations with a 6-crop Controlled Environment Agriculture (CEA) hydroponic greenhouse (Red Romaine Lettuce, Cherry Tomato, Chlorella Microalgae, Soybean, White Potato, Radish/Microgreens).
   - Solves a multi-objective Linear Program (`scipy.optimize.linprog`, HiGHS solver) to meet 100% of NASA-STD-3001 daily nutritional targets (`2,800 kcal`, `85g protein`, `>=90mg Vit C`, `>=1.2mg Vit B1`, `<=2,300mg Na`) while minimizing storage mass and chiller power (`3.02 kW`).
2. **Crew Health AI & Spaceflight Hematology/Biochemistry Engine (Yunis):**
   - Ingests real human spaceflight blood panel datasets from the **NASA Open Science Data Repository (OSDR)**—specifically **LSDS-7 (Inspiration4 Complete Blood Count)** and **LSDS-8 (Inspiration4 Comprehensive Metabolic Panel)** across pre-flight (`L-92`, `L-44`, `L-3`), return (`R+1`), and recovery (`R+45`, `R+82`, `R+194`) timepoints.
   - Tracks a 3-compartment pharmacokinetic body vitamin pool (Vitamin C 1,500 mg tissue reserve, Vitamin B1 30 mg reserve, Vitamin D3 serum 25(OH)D) coupled directly to the habitat's daily dietary output.
   - Runs an unsupervised **IsolationForest** anomaly detector + personal baseline z-score tracker that flags spaceflight anemia, hepatic transaminase shifts, or subclinical vitamin depletion and automatically prescribes targeted fresh hydroponic crop boosts.
3. **Closed-Loop ECLSS Environmental Simulator (Faruk):**
   - Simulates day-by-day habitat gas and water mass balances across OGS electrolysis (`2 H2O -> 2 H2 + O2`) and Sabatier carbon capture (`CO2 + 4 H2 -> CH4 + 2 H2O`) coupled with crew metabolic respiration and photosynthetic gas exchange (`+1,240 g O2/Sol`, `-1,672 g CO2/Sol`), achieving **78.4% net loop closure**.
4. **4-Zone Regolith Capacitive Soil Moisture Controller (Faruk):**
   - Models `150 MHz` capacitive dielectric sensors (`epsilon_r ~ 80` for liquid water vs `3-5` for dry MGS-1 Martian regolith simulant) with automatic PID drip-valve actuation across 4 crop root zones (`28%–36%` target VWC).

### NASA Data
1. **NASA Open Science Data Repository (OSDR) — LSDS-7 & LSDS-8 (Inspiration4 Mission):** Real astronaut Complete Blood Count (CBC: WBC, RBC, Hemoglobin, Hematocrit, Platelets, MCV, Neutrophils, Lymphocytes) and Comprehensive Metabolic Panel (CMP: Glucose, BUN, Creatinine, Calcium, Sodium, Potassium, AST, ALT, Bilirubin, Albumin) across 28 astronaut-timepoint records (`data/osdr_real_data.json`).
2. **NASA-STD-3001 (Space Flight Human-System Standard, Vol. 2, Rev D):** Daily crew metabolic energy (`2,800–3,035 kcal`), macronutrient, micronutrient, O2 consumption (`0.84 kg/crew/Sol`), and CO2 exhalation (`1.00 kg/crew/Sol`) constraints.
3. **NASA BVAD (Baseline Values and Assumptions Document, NASA/TP-2015-218570):** Crop growth rate, harvest index, photosynthetic O2 production, transpiration water flux, and OGS/Sabatier ECLSS stoichiometric constants.
4. **NASA Technical Reports Server (NTRS) Space Food Shelf-Life Studies (Catauro & Perchonok, 2012; Cooper et al., 2017; Douglas et al., 2020):** Activation energies (`Ea = 44.3–89.4 kJ/mol`) and first-order kinetic decay constants for spaceflight rations over 1–5 years of storage.

### Partner & Other Data
- **Exolith Lab MGS-1 (Mars Global Simulant) Geotechnical & Dielectric Reference Data:** Used to calibrate relative permittivity (`epsilon_r = 3.5` dry regolith vs `80` water) and bulk density (`1.29 g/cm^3`) for the 4-zone capacitive soil moisture irrigation controller.
- **USDA FoodData Central:** Baseline macronutrient and micronutrient density profiles for raw hydroponic crops prior to Mars PAR lighting and stressor adjustments.

### Use of AI
- **In-Application Machine Learning:** Scikit-learn (`IsolationForest`) and statistical z-score personalization engines are used inside the application to detect multi-dimensional physiological anomalies across crew vitals, NASA OSDR blood biomarkers, and pharmacokinetic vitamin reserves.
- **Development Assistance Disclosure:** Generative AI coding assistants (GitHub Copilot / LLM pair-programming) were used to accelerate boilerplate UI layout, SVG chart rendering, and documentation formatting. All mathematical equations (Arrhenius kinetics, SciPy HiGHS LP formulation, OGS/Sabatier stoichiometry, and 3-compartment vitamin pharmacokinetics) and NASA OSDR dataset integrations were verified against primary NASA literature.
- **Branding & Visual Compliance:** The `NurtureAISpace` emblem is a 100% custom-coded SVG vector graphic (`favicon.svg` / `logo.svg`). **No official NASA logos, insignias, or unwatermarked AI-generated media are used anywhere in this project.**

---

## 2. Mandatory Judge Questions & Pre-Hackathon Disclosure (Pages 2, 6 & 7 of Official Program)

### Suallara Cavablar (3 Mandatory Judge Questions — Page 6)
1. **Sual 01: Hakaton zamanı nəyi hazırladınız? (Rule #4 Disclosure)**
   - **Hakatondan əvvəl (Pre-existing — 0 bal tələb olunur):** Yalnız açıq mənbəli elmi ədəbiyyat qeydləri (NASA-STD-3001, BVAD sabitləri, Arrhenius aktivləşmə enerjiləri) və standart Python/FastAPI/Tailwind şablon strukturu.
   - **Hakaton zamanı sıfırdan yazılan kod (100% Mühəndislik İcrası):**
     - **Süleyman & Banu:** Arrhenius kinetik deqradasiya mühərriki, SciPy HiGHS LP rasion optimallaşdırıcısı, 6-bitki hidroponik simulyatoru və 9-bölməli interaktiv veb platforma (`nurtureaispace.github.io`).
     - **Yunis:** NASA OSDR `LSDS-7` & `LSDS-8` (Inspiration4) real astronavt qan analizlərinin emalı, 3-kameralı vitamin farmakokinetik modeli (Vit C, B1, D3) və `IsolationForest` + fərdi baza xətti (`z-score`) anomaliya detektoru.
     - **Faruk:** Qapalı dövrəli ECLSS (OGS elektroliz + Sabatier reaktoru) qaz/su balansı simulyatoru və 4-zonalı MGS-1 reqolit tutumlu (`150 MHz`) torpaq nəmliyi PID suvarma kontrolleri.

2. **Sual 02: Hansı NASA məlumatından istifadə etdiniz? Göstərin.**
   - Canlı tətbiqdə **`Crew Health`** və **`Data Lab`** bölmələrində birbaşa göstərilir:
     - **NASA OSDR `LSDS-7` & `LSDS-8`:** Inspiration4 missiyasının real astronavt qan panelləri (`C001–C004`, `L-92`-dən `R+194`-ə qədər 28 qeyd, CBC və CMP göstəriciləri).
     - **NASA-STD-3001 Vol. 2 Rev D & NASA BVAD (TP-2015-218570):** Gündəlik `2,800 kkal`, `90 mq Vit C`, `0.84 kq O2/Sol` və bitki transpirasiya sabitləri.
     - **NASA NTRS Qida Rəf Ömrü Tədqiqatları:** `Ea = 68.5 kJ/mol` (Vit C) və `74.2 kJ/mol` (Vit B1) kinetik əmsalları.

3. **Sual 03: Hələ nə işləmir? Vaxtınız olsaydı, nə əlavə edərdiniz?**
   - **Hazırda nə işləmir (Məhdudiyyətlər):**
     1. Fiziki `150 MHz` tutumlu reqolit sensorları və peristaltik suvarma nasosları hələ real MGS-1 reqolit torpağında aparat (ESP32/Arduino) üzərində qoşulmayıb — hazırda rəqəmsal əkiz (PID simulyasiya) kimi işləyir.
     2. Arrhenius modeli bircinsli (homogen) saxlama temperaturu fərz edir; kosmik radiasiyanın (GCR/SPE) vitamin parçalanmasına birbaşa təsiri ayrıca radiolitik hədd kimi daxil edilməyib.
     3. NASA OSDR `LSDS-7/8` datası qısa müddətli LEO (Inspiration4, 3 gün) uçuşuna aiddir; 450 Sol-luq dərin kosmos ekstrasiyası farmakokinetik tənliklərlə modelləşdirilib.
   - **Vaxtımız olsaydı nə əlavə edərdik (Gələcək Plan):**
     1. Fiziki ESP32 + tutumlu sensor + MGS-1 reqolit sınaq stendinin (hardware-in-the-loop) ADAU laboratoriyasında qurulması.
     2. Bitki yarpaqlarında xloroz və qida çatışmazlığını kameradan tanıyan Computer Vision (CNN) modulunun əlavə edilməsi.
     3. Qrup üzvlərinin qlükoza və kortizol səviyyələrini real vaxtda oxuyan geyilə bilən (wearable) biosensor API inteqrasiyası.
