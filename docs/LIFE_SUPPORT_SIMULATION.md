# ECLSS & Regolith Hydro-Management Simulation Module

> **NASA Space Apps Challenge 2026**  
> **Lead Life Support Architect & Computer Engineering:** Faruk Karimli ([`fkarimli23291@ada.edu.az`](mailto:fkarimli23291@ada.edu.az))  
> **Team:** NurtureAISpace

---

## 🛰️ 1. Executive Summary & Engineering Motivation

Long-duration human habitation on the surface of Mars (e.g. 450 to 1000 Sols) requires an autonomous, resilient, and closed-loop **Environmental Control and Life Support System (ECLSS)**. Without closed-loop recycling, delivering consumables (Oxygen and Water) from Earth to Mars would require an unsustainable launch payload ($> 15,000\text{ kg}$ per crew of 4).

This module delivers a complete **Computer Engineering and Life Support Simulation** architecture:
1. **Atmosphere Revitalization Subsystem (ARS):**
   - Water electrolysis through the Oxygen Generation System (OGS): $2\text{H}_2\text{O} \to 2\text{H}_2 + \text{O}_2$.
   - Sabatier carbon-loop reactor (${\text{CO}_2 + 4\text{H}_2 \to \text{CH}_4 + 2\text{H}_2\text{O}}$) to close the loop on human metabolic ${\text{CO}_2}$.
   - Intra-habitat atmospheric partial pressure monitoring ($p\text{O}_2 = 21.3\text{ kPa}$, $p\text{CO}_2 < 0.53\text{ kPa}$, total pressure $101.3\text{ kPa}$; assumed nominal values).
2. **Smart Soil & Regolith Moisture Platform (IoT Embedded Microcontroller):**
   - Derived from Faruk Karimli's **`ideas/Soil Moisture Platform (locked).pptx`** research.
   - Volumetric Water Content (VWC %) monitoring via capacitive soil probes across 3 illustrative greenhouse beds (microgreens, chickpea, alfalfa). Sensor readings and per-bed gas exchange are **synthetic**.
   - Automated microcontroller-driven micro-irrigation pulse valves: auto-trigger at $\text{VWC} \le 38\%$ and auto-cutoff at $\text{VWC} \ge 50\%$.
   - Electrical Conductivity (EC) monitoring to mitigate hyper-saline regolith osmotic shock.
3. **Contingency Resilience & Fail-Safe Telemetry:**
   - Simulated global Martian dust storm (assumed 72% drop in solar output; habitat runs on battery reserves).
   - Real-time simulation of cabin micro-depressurization leaks (O2 auto-injection buffer activation).

---

## 📐 2. Biophysical & Chemical Formulations

### 2.1 Crew Metabolic Baseline (NASA BVAD)
Per-crewmember rates come from NASA BVAD: Anderson MS, Ewert MK, Keener JF, *Life Support Baseline Values and Assumptions Document*, NASA/TP-2015-218570/REV1, Jan 2018 (https://ntrs.nasa.gov/citations/20180001338). They are given per crewmember-day; the code converts them to per Sol ($\times 1.02749$). For a crew of $N$ astronauts:

$$\text{O}_2\text{ Demand} = N \times 0.816 \, \text{kg/day} \quad \text{(Table 3-33, p. 63)}$$

$$\text{CO}_2\text{ Production} = N \times 1.04 \, \text{kg/day} \quad \text{(Table 3-33, p. 63)}$$

$$\text{Potable Water (drinking + food rehydration)} = N \times 2.50 \, \text{kg/day} \quad \text{(Table 4-20, p. 77)}$$

$$\text{Hygiene Water} = N \times 7.32 \, \text{kg/day} \quad \text{(Table 4-20, Mature Planetary Base, p. 77)}$$

### 2.2 Electrolytic Oxygen Generation (OGS)
The stoichiometric electrolysis ratio is:

$$\text{H}_2\text{O required} = 1.126 \times \text{O}_2 \, \text{kg}$$

$$\text{H}_2\text{ produced} = 0.126 \times \text{O}_2 \, \text{kg}$$

### 2.3 Sabatier Water Recovery
Using byproduct $\text{H}_2$ from electrolysis and expired crew $\text{CO}_2$:

$$\text{CO}_2 + 4\text{H}_2 \xrightarrow{\text{Ni Catalyst, } 350-400^\circ\text{C}} \text{CH}_4 + 2\text{H}_2\text{O}$$

$$\text{Water Recovery Ratio} = 0.818 \, \text{kg }\text{H}_2\text{O} / \text{kg }\text{CO}_2$$

With Water Recovery System (WRS) urine processor distillation and plant transpiration recapture:

$$\text{Loop Closure Efficiency} = \frac{\text{WRS Recaptured Water}}{\text{Total Crew Consumed Water}} \times 100\%$$

The WRS recovery factor (0.94) and the resulting loop closure are assumed scenario values (no cited source).

### 2.4 Regolith IoT Soil Moisture Dynamics (Embedded Controller)
For each sensor probe $i$ at depth $d$:

$$\text{VWC}_{t+1} = \begin{cases} 
\min(58.0\%, \text{VWC}_t + \Delta_{\text{irrigate}}) & \text{if valve is OPEN} \\
\max(12.0\%, \text{VWC}_t - \text{ET}(T)) & \text{if valve is CLOSED}
\end{cases}$$

Where evapotranspiration rate $\text{ET}(T) = 1.8 \times (1 + 0.04(T_{\text{ambient}} - 20))$.

---

## 💻 3. Code Architecture & Map

| File Path | Role & Technical Description |
|---|---|
| `backend/app/models/life_support_eclss.py` | Core ECLSS data classes, stoichiometry parameters, and microcontroller micro-irrigation controller. |
| `backend/app/services/life_support_service.py` | Telemetry aggregator, 450-Sol dynamic trajectory runner, and contingency fault injection. |
| `backend/app/api/routes_life_support.py` | FastAPI REST endpoints (`/api/v1/life-support/*`). |
| `backend/tests/test_life_support_simulation.py` | Pytest verification suite (6 unit & integration tests). |
| `frontend/src/components/LifeSupportView.tsx` | Interactive React telemetry dashboard, sensor status cards, and SVG vector trajectory graph. |
| `frontend/src/types.ts` & `frontend/src/api.ts` | TypeScript schema definitions and async API bindings. |

---

## 📡 4. REST API Documentation

### 1. Snapshot Telemetry
`GET /api/v1/life-support/telemetry`
- **Query Params:** `sol` (int), `crew_size` (int), `dust_storm_active` (bool), `o2_leak_active` (bool)
- **Response:** Current atmospheric $p\text{O}_2, p\text{CO}_2$, OGS generation rates, Sabatier water recovery, and power grid balance.

### 2. Regolith Sensor Nodes
`GET /api/v1/life-support/regolith-sensors`
- **Response:** Array of 3 synthetic soil moisture sensor nodes with VWC%, EC salinity, root temperature, and valve state.

### 3. Dynamic Mission Simulation
`POST /api/v1/life-support/simulate`
- **Body:** JSON configuration for mission duration, dust storms, cabin leaks, and closed-loop toggle.
- **Response:** Sol-by-Sol timeline of consumable reserves and final survival verdict (`NOMINAL_SURVIVED`).

---

## 5. Data provenance

- **Cited:** crew O₂/CO₂/water rates, from NASA BVAD (above).
- **Derived:** stoichiometric ratios, from the reaction equations.
- **Synthetic scenario assumptions:** reserves, power, recovery efficiencies, sensor readings, greenhouse gas exchange,
  and dust storm and leak effects.

All life-support API responses carry a `data_provenance` field. See [DATA_SOURCES.md](DATA_SOURCES.md).

**Sabatier hydrogen limit:** water recovered is `min(CO₂ × 0.818, H₂ × 4.5)`. The factor 4.5 = 36/8 kg H₂O per kg H₂
comes from the stoichiometry (CO₂ + 4H₂ → CH₄ + 2H₂O); it was previously 8.9. With the default crew the hydrogen limit
binds, giving about 1.36 L/Sol of Sabatier water.
