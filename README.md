# NurtureAISpace — Autonomous Space Nutrition & Life Support Intelligence

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.110-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB.svg)](https://react.dev/)
[![SciPy](https://img.shields.io/badge/Optimizer-SciPy%20Optimization-8CAAE6.svg)](https://scipy.org/)

> **Space nutrition and astronaut health early-warning prototype**  
> NASA Space Apps Challenge 2026: *Create Health Monitoring Software for Astronauts on Space Missions*  
> Developed by **NurtureAISpace**  
> **Team:** Suleyman Hajizadeh (Lead Systems Architect), Banu Gurbanizada (Frontend & UI/UX), Yunis (AI/ML), Faruk (Computer Engineering)  
> Live Platform: [https://nurtureaispace.github.io](https://nurtureaispace.github.io)  
> Organization: [https://github.com/NurtureAISpace](https://github.com/NurtureAISpace)

> **Prototype, not a medical device.** Every number in this project is either real NASA data, a value from a cited NASA
> document or peer-reviewed paper, or a clearly labeled synthetic scenario value. See [Data sources](#-data-sources).

---

## 🌟 Executive Summary

On a long mission (for example 450 Sols on Mars), heat-sensitive vitamins in stored food, such as thiamine (B1) and
vitamin C, keep breaking down. A cooling failure speeds this up. The crew can run short of a vitamin long before the
calories run out.

**The core story:** food storage → vitamin loss → astronaut body vitamin level → personal-baseline early warning → what to eat.

1. **Crew Health Monitor (core):** follows vitamin losses into each astronaut's body pool and compares every astronaut
   with their own baseline. It raises explainable NOMINAL / WATCH / ACT alerts with a corrective action. Physiology
   parameters come from NASA and peer-reviewed sources; the crew itself is synthetic.
2. **Prediction & Kinetics:** first-order Arrhenius degradation curves and the "drop-dead Sol" for a chosen food and
   storage temperature. It uses the synthetic catalog constants.
3. **Data Laboratory:** the illustrative food catalog (synthetic values), schema checks, and a comparison of the catalog
   kinetics with **published** retention endpoints (Goulette et al. 2020, Cooper et al. 2017). The comparison shows they
   do not match yet (7 of 12 series agree).
4. **Diet Optimizer:** SciPy linear programming of a daily ration against daily nutrient targets. Vitamin C and B1
   targets come from NASA JSC 2005; the other targets are assumed.
5. **Mission Simulator and Dashboard:** Sol-by-Sol stress tests (cooling failure, crop loss) on a synthetic scenario.
6. **Life Support Sim:** ECLSS mass balance. Per-crewmember O₂, CO₂ and water rates come from NASA BVAD; the rest is
   synthetic.

---

## 🩺 Crew Health Monitoring

NurtureAISpace follows food degradation all the way to the astronaut.

- Vitamin C and thiamine B1 losses in packaged food are computed with first-order kinetics. The rate constants are
  anchored to published spaceflight-food retention data. These losses drive each astronaut's **body vitamin pool**.
- Vitamin D status follows the decline measured on ISS crews.
- Each astronaut is compared with **their own personal baseline**. The module raises explainable early-warning alerts,
  **NOMINAL / WATCH / ACT**, that say what changed, since which Sol, and how many Sols remain until a risk threshold is
  crossed.
- Every nutrient alert ends with a corrective action: which available food (or supplement) to add, and how much per Sol.

What the default scenario shows (cooling failure at Sol 150):
- ACT alerts for thiamine B1 at Sols 212 and 244, with a food recommendation.
- An ACT alert for vitamin D 45 Sols before that astronaut's level actually crosses the risk threshold.

**Crew physiology data is synthetic.** Every model parameter is listed with its source, page and status in
`backend/app/data/literature_params.json`.

Details, equations and limitations: [docs/CREW_HEALTH.md](docs/CREW_HEALTH.md). API: `GET /api/v1/health/crew`,
`/health/astronaut/{id}/timeline`, `/health/alerts`, `/health/parameters`; UI: **Crew Health** tab.

**Real astronaut data (feasibility spike).** `backend/scripts/i4_baseline_demo.py` applies the same personal-baseline
idea to **real** Inspiration4 blood panels from NASA OSDR (OSD-569, OSD-575). It is not yet wired into the web app.

---

## 🌿 ECLSS & Smart Regolith Hydro-Management Simulation

Engineered by **Faruk (Computer Engineering & Life Support Simulation)**. This module models the life-support
consumables loop:

- **Oxygen generation and Sabatier recovery:** water electrolysis ($2\text{H}_2\text{O} \to 2\text{H}_2 + \text{O}_2$)
  with catalytic Sabatier ${\text{CO}_2}$ reduction (${\text{CO}_2 + 4\text{H}_2 \to \text{CH}_4 + 2\text{H}_2\text{O}}$).
  The stoichiometry follows from the reaction equations.
- **Crew consumables:** per-crewmember O₂ 0.816 kg, CO₂ 1.04 kg, potable water 2.50 kg and hygiene water 7.32 kg per day,
  from NASA BVAD (NASA/TP-2015-218570/REV1, Tables 3-33 and 4-20), converted to Sols.
- **Smart soil moisture platform (synthetic):** illustrative capacitive soil-sensor readings (VWC %, EC, root
  temperature) with threshold-based irrigation valves for three generic crop beds.
- **Contingency scenarios (synthetic):** a dust storm (assumed −72% solar output) and a cabin leak.
- Recovery efficiencies, reserves and power figures are assumed.

Details & equations: [docs/LIFE_SUPPORT_SIMULATION.md](docs/LIFE_SUPPORT_SIMULATION.md). API: `GET /api/v1/life-support/telemetry`, `/life-support/regolith-sensors`, `/life-support/simulate`; UI: **Life Support Sim** tab.

---

## 📚 Data sources

Full list with citations, DOIs/URLs and page numbers: **[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)**.

- **Real NASA data:** Inspiration4 CBC and CMP blood panels, NASA OSDR
  [OSD-569](https://osdr.nasa.gov/bio/repo/data/studies/OSD-569) and
  [OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) (`backend/data/real/i4/`).
- **NASA documents and literature:**
  - NASA JSC 2005 exploration nutrition requirements (NTRS 20200001703);
  - Cooper et al. 2017 (*npj Microgravity*);
  - Goulette et al. 2020 (*Food Chemistry*);
  - Smith et al. 2005 (*J Nutr*);
  - Rice, Zwart & Smith (NTRS 20080026180);
  - Smith & Zwart (NTRS 20060049121);
  - Smith et al. 2009 (*Am J Clin Nutr*);
  - NASA BVAD REV1 (NTRS 20180001338).
- **Synthetic scenario elements:** the crew, the food catalog values, crop parameters, the dashboard/simulator
  constants, most nutrient targets, and most life-support values. They are labeled `synthetic` in the data files, in the
  API `data_provenance` fields, and in the UI.

---

## 🚀 Quick Start Guide

### Option 1: Native Run with Shell Script (Fastest)

Prerequisites: Python 3.10+, Node.js 18+

```bash
# Clone the repository
git clone https://github.com/NurtureAISpace/mars-food-intelligence.git
cd mars-food-intelligence

# Make start script executable and launch both frontend & backend
chmod +x start.sh
./start.sh
```

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend OpenAPI Docs**: [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)

### Option 2: Docker Compose (Production Setup)

```bash
docker-compose up --build
```

---

## 🧪 Running the Test Suite

```bash
./start.sh test
# or manually:
cd backend && pytest -v
```

The backend suite (49 tests plus 3 expected failures that document known model limits) covers:
- Arrhenius temperature acceleration, first-order decay and half-life formulas.
- The literature-endpoint comparison of the catalog kinetics.
- Optimizer convergence and the Sol-by-Sol simulator with cooling-failure injection.
- The Crew Health model: literature parameters, calibration formulas, alerts, and the absence of false alarms.
- The Inspiration4 baseline script.
- The life-support simulation and API endpoints, including `data_provenance` labels.

---

## 📐 Scientific Architecture & Formulations

See [ARCHITECTURE.md](ARCHITECTURE.md) for full equations and Mermaid diagrams.

### Arrhenius Degradation Law:
$$k(T) = A \cdot \exp\left(-\frac{E_a}{R \cdot T}\right)$$

### First-Order Retention under Variable Temperature:
$$[C](t) = [C]_0 \cdot \exp\left(-\int_0^t k(T(\tau)) \, d\tau\right)$$

### SciPy Linear Optimization:
$$\min_{x} c^T x \quad \text{s.t.} \quad A_{\text{ub}} x \ge b_{\text{ub}}$$

---

## 🕒 Built before vs during the hackathon

The hackathon started on **2026-11-14 at 11:10 (+04:00)**. These are commit dates from `git log --all`. They show when
work was committed, not when it was written.

**Before the hackathon (Nov 8–13):**
- **Suleyman, Nov 8–11:**
  - the original app: Dashboard, Data Lab, Prediction, Optimizer and Mission Simulator tabs; the FastAPI backend; the
    food catalog; the original (now removed) shelf-life benchmarks;
  - the Ganja module (now removed);
  - the pitch document, branding, team photos and the `ideas/` decks.
  - The frontend design (owned by Banu) was committed in this initial work.
- **Yunis, Nov 13:** the first version of the Crew Health module (ML core, API, Crew Health tab, docs).

**During the hackathon (Nov 14, from 11:10):**
- **Yunis:**
  - **Inspiration4 real-data spike** (`339f454`, committed 11:20). It was started on the morning of Nov 14, around the
    opening ceremony. It added the OSDR blood panels, `i4_baseline_demo.py` and its test.
  - Literature-sourced Crew Health parameters and the vitamin D model, plus the literature check and tests (`65ef178`,
    `d7ae236`, 12:22).
  - Steady-state calibration, alert attribution and tests (`6adfff3`, `d18e91a`, 12:42).
  - The data-provenance cleanup: removing unsourced data and claims, citing BVAD, and writing `docs/DATA_SOURCES.md`.
- **Faruk:** the Life Support / ECLSS simulation: backend, Life Support tab, docs and tests (`d1f64d4`, 14:44).
- **Suleyman:** merge of the Faruk branch into main (`259b903`).
- **Banu:** no commits in this repository.

---

## 👥 Organization, Team & Credits
- **Organization**: [NurtureAISpace](https://github.com/NurtureAISpace)
- **Team Members**:
  - **Suleyman Hajizadeh** — Lead Systems Architect & Research ([`suleyman.hacizade1@gmail.com`](mailto:suleyman.hacizade1@gmail.com))
  - **Banu Gurbanizada** — Frontend Architecture & UI/UX Design ([`banugurbanzade@gmail.com`](mailto:banugurbanzade@gmail.com))
  - **Yunis** — AI/ML & Degradation Modeling ([`allahverdiyunis@gmail.com`](mailto:allahverdiyunis@gmail.com))
  - **Faruk** — Computer Engineering & Life Support Simulation ([`fkarimli23291@ada.edu.az`](mailto:fkarimli23291@ada.edu.az))
- **Data references**: see [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)
