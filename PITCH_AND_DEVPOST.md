# NurtureAISpace — Autonomous Space Nutrition & Life Support Intelligence
## Official Executive Pitch & Project Kit

**Team:** NurtureAISpace (Suleyman Hajizadeh, Banu Gurbanizada, Yunis, Faruk Karimli)  
**Live Platform:** https://nurtureaispace.github.io  
**Organization:** https://github.com/NurtureAISpace

---

## 1. Project Overview & Documentation

### Project Title
**NurtureAISpace: Autonomous Space Nutrition & Bio-Regenerative Life Support Intelligence System**

### Tagline
*Thermodynamic Arrhenius degradation forecasting, SciPy-driven crew diet optimization, and dynamic life-support stress testing for long-duration deep space missions.*

### Inspiration
Deep space missions cannot rely on Earth resupply. If a mission reaches **Sol-450**, astronauts don't just face the risk of running out of food mass — they face the invisible, deadly danger of **micronutrient degradation**. Heat-sensitive vitamins (such as Thiamine B1 and Ascorbic Acid / Vitamin C) break down continuously due to thermodynamic kinetics. A subtle cooling system malfunction can trigger scurvy or beriberi-induced cognitive decline long before the calories run out. We built NurtureAISpace to transform static space pantry logs into an autonomous, biophysically grounded intelligence system.

### What It Does
1. **Executive Sol-450 Mission Dashboard:** Synthetic-scenario overview of habitat caloric security, mass burn rate, greenhouse yields, and refrigeration power draw.
2. **Data Laboratory & Scientific Pipeline:** Loads the illustrative (synthetic) space food catalog and runs schema and physical-bound checks. It then compares the Arrhenius kinetics with published spaceflight-food retention endpoints (Goulette et al. 2020, Cooper et al. 2017). Today 7 of 12 series agree, and we show that openly.
3. **Crew Health Monitor:** Follows vitamin C and thiamine losses into each astronaut's body vitamin pool and tracks vitamin D status. It compares every astronaut with their personal baseline and raises explainable NOMINAL / WATCH / ACT alerts with a food or supplement recommendation. Physiology parameters come from NASA and peer-reviewed sources; the crew data is synthetic.
4. **Prediction & Arrhenius Kinetics Engine:** Calculates first-principles degradation rates ($k = A e^{-E_a/RT}$) under arbitrary thermal profiles ($-20^\circ\text{C}$ to $+35^\circ\text{C}$), projecting nutrient half-lives and exact "Drop-Dead Sols".
5. **SciPy Multi-Objective Optimizer:** Solves linear programming models to determine optimal daily crew rations satisfying daily nutrient targets (vitamin C and thiamine from NASA JSC 2005; the other targets are assumed) while minimizing launch stowage mass and cooling power.
6. **Mission Simulator:** Sol-by-Sol dynamic stress-testing modeling thermal failures, greenhouse crop pathogen outbreaks, and crew survival trajectories over 600+ Sols.

### How We Built It
- **Backend:** Python 3.12, FastAPI, Pydantic v2 clean modular architecture.
- **Scientific Computing:** SciPy Optimization (`linprog` with HiGHS simplex), NumPy, Pandas, Scikit-learn.
- **Frontend:** React 18, TypeScript, Tailwind CSS, custom responsive SVG vector telemetry graphing.
- **Data sources:**
  - real NASA OSDR Inspiration4 blood panels (OSD-569, OSD-575);
  - NASA JSC 2005 nutrition requirements, Cooper et al. 2017, Goulette et al. 2020, Smith et al. 2005;
  - NASA BVAD (NASA/TP-2015-218570/REV1);
  - full list in `docs/DATA_SOURCES.md`.
- **Quality & DevOps:** Docker, Docker Compose, Pytest test suite (49 passing + 3 strict xfails that document model findings), GitHub Actions CI.

### Challenges We Overcame
1. Tracing every number to a source. We built a parameter registry (value, page, status: literature / derived / assumed). We also replaced invented benchmark data with an honest comparison against published endpoints, even where our model does not match yet.
2. Formulating multi-objective constrained diet optimization so that it balances caloric requirements without exceeding daily water rehydration and fresh biomass harvest limits.
3. Building a lightning-fast, zero-dependency interactive SVG visualization engine that plots exponential decay curves and drop-dead milestones cleanly.

---

## 2. 3-Dəqiqəlik Təqdimat Nitqi (Pitch Script)

*(Zaman: 3 dəqiqə • Dil: Azərbaycan dili)*

### [0:00 - 0:40] Problem & Qarmaq (Hook)
"Hörmətli münsiflər və ekspertlər, uzaq kosmosa uçuş sadəcə raket mühəndisliyi deyil — bu, bioloji sağ qalma məsələsidir. Kosmosda Sol-450-yə çatdıqda, ekipajın ən böyük düşməni aclıq yox, **gözəgörünməz vitamin deqradasiyasıdır**.
Baxın: NASA-nın qida tədqiqatları göstərir ki, B1 vitamini (tiamin) və C vitamini uzunmüddətli saxlanmada parçalanır (Cooper 2017, Goulette 2020). Soyutma sistemində kiçik bir nasazlıq baş versə, qidanın kalorisi qalsa belə, ekipaj beriberi və ya sinqa (skorbut) ilə üzləşəcək.
Biz bu problemi kökündən həll etmək məqsədilə **NurtureAISpace** sistemini hazırladıq."

### [0:40 - 1:40] Həll & Canlı Demo (Demo Walkthrough)
*(Ekranı göstərərək)*
"Biz sadəcə dizayn yox, **FastAPI, SciPy və React** ilə real işləyən elmi mühəndislik platforması qurmuşuq.
1. **Dashboard-da** görürsünüz: Sol-450 üçün qida təhlükəsizliyi indeksi, qalan rasion və istixana məhsuldarlığı (sintetik ssenari).
2. **Data Laboratory modulunda** modelimizi dərc olunmuş NASA qida tədqiqatlarının nəticələri ilə (Cooper 2017, Goulette 2020) açıq şəkildə müqayisə edirik: hazırda 12 seriyadan 7-si uyğun gəlir.
3. **Prediction modulunda** Arrhenius kinetikası ilə temperaturu 4 dərəcədən 32 dərəcəyə qaldırdıqda tiaminin necə sürətlə parçalandığını və qidanın *Drop-Dead Sol* gününü dərhal görürük.
4. **Crew Health modulunda** vitamin itkisini hər astronavtın bədənindəki vitamin ehtiyatına qədər izləyirik. Hər astronavtı öz şəxsi bazası ilə müqayisə edir və erkən xəbərdarlıq (NOMINAL / WATCH / ACT) veririk: nə dəyişib, hansı Sol-dan bəri və nə yemək lazımdır. Parametrlər NASA və elmi məqalələrdən götürülüb, ekipaj datası isə sintetikdir.
5. **SciPy Optimizer-də** bir kliklə gündəlik qida hədəflərinə (C və B1 vitaminləri NASA JSC 2005-dən) cavab verən optimal rasionu hesablayırıq.
6. Və nəhayət, **Mission Simulator-da** Sol 150-də soyutma qəzasını simulyasiya edir və qida ehtiyatına təsirini göstəririk."

### [1:40 - 2:30] Elmi Əsas & Rəqabət Üstünlüyü
"Bizim fərqimiz nədir?
- Başqaları qidanı Excel cədvəli kimi statik sayır; biz isə termodinamik kimyəvi kinetika ilə deqradasiyanı proqnozlaşdırırıq.
- Bizim riyazi modellərimiz **Pytest ilə 49 avtomatlaşdırılmış testdən** keçir və hər rəqəmin mənbəyi `docs/DATA_SOURCES.md`-də göstərilib: real NASA datası, istinad olunan məqalə və ya açıq qeyd olunmuş sintetik ssenari.
- Sistem təkcə Mars üçün deyil, Antarktida stansiyaları, sualtı qayıqlar və ərzaq təhlükəsizliyi logistikası üçün birbaşa tətbiq oluna bilər."

### [2:30 - 3:00] Yekun & Çağırış
"NurtureAISpace təkcə bir proqram deyil, sabah uzaq kosmosa ayaq basacaq insanların həyat sığortasıdır.
Diqqətiniz üçün təşəkkür edirəm, suallarınızı cavablandırmağa hazıram!"
