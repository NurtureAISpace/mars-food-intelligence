# Mars Food Intelligence (Sol-450 Engine)
## NASA International Space Apps Challenge Ganja 2026 — Devpost & Pitch Kit

---

## 1. Devpost Project Submission Text (Copy & Paste Ready)

### Project Title
**Mars Food Intelligence: Autonomous Space Nutrition & Shelf-Life Dynamics System (Sol-450 Engine)**

### Tagline
*Thermodynamic Arrhenius degradation forecasting, SciPy-driven crew diet optimization, and dynamic life-support stress testing for long-duration Mars missions.*

### Inspiration
Mars missions cannot rely on Earth resupply. If a mission reaches **Sol-450**, astronauts don't just face the risk of running out of food mass — they face the invisible, deadly danger of **micronutrient degradation**. Heat-sensitive vitamins (such as Thiamine B1 and Ascorbic Acid / Vitamin C) break down continuously due to thermodynamic kinetics. A subtle cooling system malfunction can trigger scurvy or beriberi-induced cognitive decline long before the calories run out. We built Mars Food Intelligence to transform static space pantry logs into an autonomous, biophysically grounded intelligence system.

### What It Does
1. **Executive Sol-450 Mission Dashboard:** Live telemetry monitoring habitat caloric security, mass burn rate, bio-regenerative agriculture yields (BLSS), and refrigeration power draw.
2. **Data Laboratory & Scientific Pipeline:** Ingests space food catalogs, executes automated schema and physical bound audits (100% verified), and validates Arrhenius models against empirical NASA Johnson Space Center multi-year spaceflight food degradation data ($R^2 \ge 0.99$).
3. **Ganja Agro-BLSS Bio-Regenerative Engine:** Calibrated with Azerbaijan State Agricultural University (ADAU, Ganja) phytotron research. Models hyper-saline regolith tolerance, perchlorate phytoremediation, and closed-loop microgreen cultivation (`GHM-01`, `GC-26`) synthesizing 148 mg/100g Ascorbic Acid to completely arrest Sol-450 scurvy.
4. **Prediction & Arrhenius Kinetics Engine:** Calculates first-principles degradation rates ($k = A e^{-E_a/RT}$) under arbitrary thermal profiles ($-20^\circ\text{C}$ to $+35^\circ\text{C}$), projecting nutrient half-lives and exact "Drop-Dead Sols".
5. **SciPy Multi-Objective Optimizer:** Solves linear programming models to determine optimal daily crew rations satisfying NASA-STD-3001 dietary reference intakes while minimizing launch stowage mass and cooling power.
6. **Mission Simulator:** Sol-by-Sol dynamic stress-testing modeling thermal failures, greenhouse crop pathogen outbreaks, and crew survival trajectories over 600+ Sols.

### How We Built It
- **Backend:** Python 3.12, FastAPI, Pydantic v2 clean modular architecture.
- **Scientific Computing:** SciPy Optimization (`linprog` with HiGHS simplex), NumPy, Pandas, Scikit-learn.
- **Frontend:** React 18, TypeScript, Tailwind CSS, custom responsive SVG vector telemetry graphing.
- **Standards:** NASA-STD-3001 Human-System Standard, NASA/TM-2011-216157.
- **Quality & DevOps:** Docker, Docker Compose, Pytest test suite (11/11 passing), GitHub Actions CI/CD.

### Challenges We Overcame
1. Calibrating activation energies ($E_a$) and frequency factors ($A$) to match real NASA JSC empirical shelf-life data with high statistical significance ($R^2 \ge 0.99$).
2. Formulating multi-objective constrained diet optimization so that it balances caloric requirements without exceeding daily water rehydration and fresh biomass harvest limits.
3. Building a lightning-fast, zero-dependency interactive SVG visualization engine that plots exponential decay curves and drop-dead milestones cleanly.

---

## 2. 3-Dəqiqəlik Qalib Təqdimat Nitqi (Pitch Script)

*(Zaman: 3 dəqiqə • Dil: Azərbaycan dili)*

### [0:00 - 0:40] Problem & Qarmaq (Hook)
"Hörmətli münsiflər, Marsa uçuş sadəcə raket mühəndisliyi deyil — bu, bioloji sağ qalma məsələsidir. Mars səthində Sol-450-yə çatdıqda, ekipajın ən böyük düşməni aclıq yox, **gözəgörünməz vitamin deqradasiyasıdır**.
Baxın: NASA-nın araşdırmaları göstərir ki, B1 vitamini (tiamin) və C vitamini mikromühitdə və radiasiyada sabit qalmır. Soyutma sistemində kiçik bir nasazlıq baş versə, qidanın kalorisi qalsa belə, ekipaj beriberi və ya sinqa (skorbut) ilə üzləşəcək.
Biz NASA Space Apps Ganja 2026 üçün bu problemi kökündən həll etmək məqsədilə **Mars Food Intelligence** və **Gəncə Aqrar-Kosmik BLSS Engine** sistemini hazırladıq."

### [0:40 - 1:40] Həll & Canlı Demo (Demo Walkthrough)
*(Ekranı göstərərək)*
"Biz sadəcə dizayn yox, **FastAPI, SciPy və React** ilə real işləyən elmi mühəndislik proqramı qurmuşuq.
1. **Dashboard-da** görürsünüz: Sol-450 üçün qida təhlükəsizliyi indeksi, qalan rasion və Gəncə ADAU tədqiqatlarına əsaslanan hidroponik mikrogöyərtilər (GHM-01) və noxud (GC-26) məhsuldarlığı.
2. **Data Laboratory modulunda** həm NASA JSC çoxillik deqradasiya datasetləri (R² = 0.999), həm də ADAU-nun duza dözümlü quraqlıq eksperimentləri daxil edilib.
3. **Prediction modulunda** Arrhenius kinetikası ilə temperaturu 4 dərəcədən 32 dərəcəyə qaldırdıqda tiaminin necə sürətlə parçalandığını və qidanın *Drop-Dead Sol* gününü dərhal görürük.
4. **Ganja Space-Agro Lab-da** qapalı dövrədə O2 hasilatı, CO2 təmizlənməsi və gündəlik 148 mq C vitamini sintezi ilə paketlənmiş qidadakı itkini 100% kompensasiya edirik.
5. **SciPy Optimizer-də** bir kliklə NASA-STD-3001 standartına uyğun optimal rasionu həll edir, uçuş yükünü 1200 kq azaldırıq.
6. Və nəhayət, **Mission Simulator-da** Sol 150-də soyutma qəzasını simulyasiya edirik və sistem Gəncə bio-regenerativ buferi ilə ekipajın sağ qalmasını təmin edir."

### [1:40 - 2:30] Elmi Əsas & Rəqabət Üstünlüyü
"Bizim fərqimiz nədir?
- Başqaları qidanı Excel cədvəli kimi statik sayır; biz isə termodinamik kimyəvi kinetika ilə deqradasiyanı proqnozlaşdırırıq.
- Bizim bütün riyazi modellərimiz **Pytest ilə 11 avtomatlaşdırılmış testdən** keçir.
- Sistem təkcə Mars üçün deyil, Antarktida stansiyaları, sualtı qayıqlar və ərzaq təhlükəsizliyi logistikası üçün birbaşa tətbiq oluna bilər."

### [2:30 - 3:00] Yekun & Çağırış
"Mars Food Intelligence təkcə bir hackaton ideyası deyil, sabah Marsa ayaq basacaq astronavtların həyat sığortasıdır.
Diqqətiniz üçün təşəkkür edirəm, suallarınızı cavablandırmağa hazıram!"

---

## 3. Münsiflərin Ən Çətin Sualları və Dəqiq Cavablar (Q&A Defense)

**Sual 1: "Niyə klassik Machine Learning (məsələn, Random Forest və ya Neural Network) yox, məhz Arrhenius tənliyi seçdiniz?"**
*Cavab:* "Çünki dərin kosmosda məlumatlar məhduddur (low-N regime). Neyron şəbəkələr ekstrapolyasiyada fiziki baxımdan qeyri-mümkün nəticələr verə bilər (halüsinasiya). Arrhenius tənliyi isə fundamental kimyəvi termodinamikaya və aktivasiya enerjisinə ($E_a$) əsaslanır. Bu səbəbdən NASA JSC-nin eksperimental məlumatları ilə $R^2 \ge 0.99$ uyğunluq əldə edirik."

**Sual 2: "Marsdakı kosmik radiasiyanın qidaya təsirini necə nəzərə alırsınız?"**
*Cavab:* "Sistemimizdə radiasiya dozası ($D$, Gray/Sol) Arrhenius kinetik sabitini multiplikativ korreksiya əmsalı ilə artırır: $k_{\text{eff}} = k(T) \cdot (1 + \beta \cdot D_{\text{rad}})$. Eyni zamanda qablaşdırma materiallarının baryer effektivliyi (quad-laminate foil) data kataloqumuzda parametr olaraq saxlanılır."

**Sual 3: "Əgər astronavtlar təzə biokütlədən imtina etsələr və ya istixana məhv olsa nə baş verər?"**
*Cavab:* "Simulator modulunda məhz bu ssenarini inyeksiya etmişik: Sol 250-də aeroponik patogen nəticəsində biokütlə 75% azalır. SciPy optimizatorumuz dərhal rasionu liyofilizə olunmuş (freeze-dried) ehtiyatlara yönəldir və enerji paylanmasını dondurucu kompressorlara köçürür."
