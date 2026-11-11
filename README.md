# NurtureAISpace — Autonomous Space Nutrition & Life Support Intelligence

[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-Passing-emerald.svg)](https://github.com/NurtureAISpace/mars-food-intelligence)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.110-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB.svg)](https://react.dev/)
[![SciPy](https://img.shields.io/badge/Optimizer-SciPy%20Optimization-8CAAE6.svg)](https://scipy.org/)
[![NASA STD-3001](https://img.shields.io/badge/Standard-NASA--STD--3001%20Compliant-red.svg)](https://www.nasa.gov/hhp/nasa-std-3001)

> **Autonomous Space Nutrition, Shelf-Life Degradation Dynamics & Bio-Regenerative Life Support System (N-BLSS)**  
> Developed by **NurtureAISpace**  
> **Team:** Suleyman Hajizadeh (Lead Systems Architect), Banu Gurbanizada (Frontend & UI/UX), Yunis (AI/ML), Faruk (Computer Engineering)  
> Live Platform: [https://nurtureaispace.github.io](https://nurtureaispace.github.io)  
> Organization: [https://github.com/NurtureAISpace](https://github.com/NurtureAISpace)

---

## 🌟 Executive Summary

Long-duration human presence in deep space (e.g. 450 to 1000 Sols on Mars) faces a fundamental biophysical hurdle: **food degradation in deep space is not static**. Heat-sensitive vitamins (such as Thiamine B1 and Ascorbic Acid / Vitamin C) degrade continuously over multi-year storage according to **thermodynamic Arrhenius kinetics**. A cooling loop failure or suboptimal storage can trigger severe micronutrient deficiency (beriberi, scurvy, cognitive decline) long before caloric bulk runs out.

**NurtureAISpace** solves this through an end-to-end operational software suite:
1. **Executive Mission Dashboard (Sol-450)**: Live telemetry of habitat caloric security, food mass remaining, daily crop harvest from bio-regenerative agriculture (BLSS), and thermal power draw.
2. **Data Laboratory**: Curated space food inventories, automated data pipeline auditing with 100% integrity validation, and ground-truth validation against empirical NASA Johnson Space Center (JSC) food lab stability datasets ($R^2 \ge 0.99$).
3. **Bio-Regenerative Agro-BLSS Engine**: Advanced cultivars (Chickpea `GC-26`, Microgreen `GHM-01`, Halotolerant Alfalfa `GA-04`, and Probiotic Matrix `GP-FERM`) for closed-loop O2, CO2 scrubbing, water transpiration recovery, and Sol-450 scurvy prevention.
4. **Prediction & Arrhenius Kinetics Engine**: First-principles thermodynamic degradation forecasting using chemical kinetic constants and activation energy ($E_a$), computing exact **Drop-Dead Sols**.
5. **SciPy Constrained Optimization Engine**: Solves multi-objective linear programming to calculate mathematically optimal daily astronaut diets adhering to NASA-STD-3001 constraints while minimizing stowage payload mass and chilling power.
6. **Mission Simulator**: Sol-by-Sol dynamic stress-testing to model refrigeration subsystem breakdowns, greenhouse crop blight, and multi-year survival trajectories.

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

## 🧪 Running the Verification Test Suite

Verify all Arrhenius kinetic models, linear programming bounds, and API endpoints:

```bash
./start.sh test
# or manually:
cd backend && pytest -v
```

All 16 unit & integration tests pass with 100% success rate:
- Arrhenius temperature acceleration & Q10 factors
- First-order exponential decay and half-life formulas
- Empirical benchmark accuracy ($R^2 \ge 0.90$)
- SciPy linear programming optimizer convergence & NASA STD-3001 compliance
- Full Sol-by-Sol habitat simulation with cooling failure injection

---

## 📐 Scientific Architecture & Formulations

See [ARCHITECTURE.md](ARCHITECTURE.md) for full equations, mathematical proofs, and Mermaid diagrams.

### Arrhenius Degradation Law:
$$k(T) = A \cdot \exp\left(-\frac{E_a}{R \cdot T}\right)$$

### First-Order Retention under Variable Temperature:
$$[C](t) = [C]_0 \cdot \exp\left(-\int_0^t k(T(\tau)) \, d\tau\right)$$

### SciPy Linear Optimization:
$$\min_{x} c^T x \quad \text{s.t.} \quad A_{\text{ub}} x \ge b_{\text{ub}}$$

---

## 👥 Organization & Credits
- **Organization**: [NurtureAISpace](https://github.com/NurtureAISpace)
- **Standard**: NASA-STD-3001 (Human Integration Design Handbook)
- **Data References**: NASA Johnson Space Center Space Food Systems Laboratory & Cooper et al. (NASA/TM-2011-216157)
