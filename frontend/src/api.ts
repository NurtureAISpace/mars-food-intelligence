import {
  DashboardTelemetry,
  FoodItem,
  DataAuditReport,
  ValidationBenchmarks,
  ShelfLifePrediction,
  OptimizationResponse,
  SimulationResult,
  CrewHealthScenario,
  CrewScenarioPresets,
  CrewHealthSnapshot,
  AstronautTimeline,
  CrewAlertsResponse,
  LifeSupportTelemetryData,
  RegolithSensorNodeData,
  LifeSupportSimulationResult,
  RealDataI4,
  CheckinInput,
  CheckinResult,
  CheckinHistory,
  CheckinGuide
} from './types';

const API_BASE = '/api/v1';

/** Static demo build (VITE_STATIC_DEMO=1, GitHub Pages): no backend; GETs read the JSON snapshot that
 *  scripts/export_snapshot.py wrote to public/snapshot/. Without the flag every call goes to /api as before. */
export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === '1';

/** '/api/v1/health/crew?scenario=x' -> 'health_crew_scenario_x.json' (same rule as scripts/export_snapshot.py). */
export function snapshotKey(url: string): string {
  return url.replace(/^\/api\/v1\//, '').replace(/[^A-Za-z0-9._-]+/g, '_') + '.json';
}

function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!STATIC_DEMO) return fetch(url, init);
  if (init?.method && init.method !== 'GET') {
    const body = JSON.stringify({ detail: 'Not available in the online demo snapshot (no server).' });
    return Promise.resolve(new Response(body, { status: 503, statusText: 'Static demo', headers: { 'Content-Type': 'application/json' } }));
  }
  return fetch(`${import.meta.env.BASE_URL}snapshot/${snapshotKey(url)}`);
}

export async function fetchDashboardTelemetry(sol: number = 450, crewSize: number = 4): Promise<DashboardTelemetry> {
  const res = await apiFetch(`${API_BASE}/dashboard/telemetry?sol=${sol}&crew_size=${crewSize}`);
  if (!res.ok) throw new Error(`Telemetry fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchFoodCatalog(): Promise<{ count: number; items: FoodItem[] }> {
  const res = await apiFetch(`${API_BASE}/datalab/catalog`);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchDatasetAudit(): Promise<DataAuditReport> {
  const res = await apiFetch(`${API_BASE}/datalab/audit`);
  if (!res.ok) throw new Error(`Audit fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchValidationBenchmarks(): Promise<ValidationBenchmarks> {
  const res = await apiFetch(`${API_BASE}/datalab/validation-benchmarks`);
  if (!res.ok) throw new Error(`Benchmarks fetch failed: ${res.statusText}`);
  return res.json();
}

export async function predictShelfLife(params: {
  food_id: string;
  storage_temperature_c: number;
  critical_nutrient: string;
  degradation_threshold_pct: number;
  max_sols: number;
}): Promise<ShelfLifePrediction> {
  const res = await apiFetch(`${API_BASE}/prediction/shelf-life`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Shelf life prediction failed: ${res.statusText}`);
  return res.json();
}

export async function optimizeDailyDiet(params: {
  crew_size: number;
  mission_sol: number;
  storage_temperature_c: number;
  objective_mode: string;
  max_biomass_available_g: number;
  max_rehydration_water_l: number;
}): Promise<OptimizationResponse> {
  const res = await apiFetch(`${API_BASE}/optimization/solve-diet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Diet optimization failed: ${res.statusText}`);
  return res.json();
}

export async function runMissionSimulation(params: {
  mission_duration_sols: number;
  crew_size: number;
  storage_regime: string;
  cooling_failure_sol: number | null;
  failure_duration_sols: number;
  failure_peak_temp_c: number;
  crop_failure_sol: number | null;
  crop_area_m2: number;
  ration_strategy: string;
}): Promise<SimulationResult> {
  const res = await apiFetch(`${API_BASE}/simulator/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Mission simulation failed: ${res.statusText}`);
  return res.json();
}

function crewScenarioQuery(s: CrewHealthScenario): string {
  return new URLSearchParams({
    failure_enabled: String(s.failure_enabled),
    cooling_failure_sol: String(s.cooling_failure_sol),
    failure_duration_sols: String(s.failure_duration_sols),
    failure_peak_temp_c: String(s.failure_peak_temp_c),
  }).toString();
}

export async function fetchCrewScenarios(): Promise<CrewScenarioPresets> {
  const res = await apiFetch(`${API_BASE}/health/scenarios`);
  if (!res.ok) throw new Error(`Scenario presets fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchCrewHealth(sol: number, scenario: CrewHealthScenario): Promise<CrewHealthSnapshot> {
  const res = await apiFetch(`${API_BASE}/health/crew?sol=${sol}&${crewScenarioQuery(scenario)}`);
  if (!res.ok) throw new Error(`Crew health fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchAstronautTimeline(astronautId: string, scenario: CrewHealthScenario): Promise<AstronautTimeline> {
  const res = await apiFetch(`${API_BASE}/health/astronaut/${encodeURIComponent(astronautId)}/timeline?${crewScenarioQuery(scenario)}`);
  if (!res.ok) throw new Error(`Astronaut timeline fetch failed: ${res.statusText}`);
  return res.json();
}

/** Crew snapshot for a demo preset from GET /health/scenarios (default Sol: last mission Sol). */
export async function fetchCrewPreset(scenarioId: string): Promise<CrewHealthSnapshot> {
  const res = await apiFetch(`${API_BASE}/health/crew?scenario=${encodeURIComponent(scenarioId)}`);
  if (!res.ok) throw new Error(`Crew health fetch failed: ${res.statusText}`);
  return res.json();
}

/** Crew snapshot at the last Sol of a mission length (`horizon_sols`, from a destination) for a demo preset.
 *  The response's `horizon` block holds every Sol/day number the Food & Vitamins screen shows. */
export async function fetchCrewPresetHorizon(scenarioId: string, horizonSols: number): Promise<CrewHealthSnapshot> {
  const q = new URLSearchParams({ scenario: scenarioId, horizon_sols: String(horizonSols) }).toString();
  const res = await apiFetch(`${API_BASE}/health/crew?${q}`);
  if (!res.ok) throw new Error(`Crew health fetch failed: ${res.statusText}`);
  return res.json();
}

/** All early-warning alerts up to `sol` for a demo preset. */
export async function fetchAlertsPreset(scenarioId: string, sol: number): Promise<CrewAlertsResponse> {
  const res = await apiFetch(`${API_BASE}/health/alerts?sol=${sol}&scenario=${encodeURIComponent(scenarioId)}`);
  if (!res.ok) throw new Error(`Crew alerts fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchCrewAlerts(sol: number, scenario: CrewHealthScenario): Promise<CrewAlertsResponse> {
  const res = await apiFetch(`${API_BASE}/health/alerts?sol=${sol}&${crewScenarioQuery(scenario)}`);
  if (!res.ok) throw new Error(`Crew alerts fetch failed: ${res.statusText}`);
  return res.json();
}


export async function fetchLifeSupportTelemetry(params: {
  sol?: number;
  crew_size?: number;
  dust_storm_active?: boolean;
  o2_leak_active?: boolean;
}): Promise<LifeSupportTelemetryData> {
  const query = new URLSearchParams({
    sol: String(params.sol ?? 450),
    crew_size: String(params.crew_size ?? 4),
    dust_storm_active: String(params.dust_storm_active ?? false),
    o2_leak_active: String(params.o2_leak_active ?? false),
  }).toString();
  const res = await apiFetch(`${API_BASE}/life-support/telemetry?${query}`);
  if (!res.ok) throw new Error(`Life support telemetry fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchRegolithSensors(): Promise<{
  count: number;
  sensors: RegolithSensorNodeData[];
  controller: string;
}> {
  const res = await apiFetch(`${API_BASE}/life-support/regolith-sensors`);
  if (!res.ok) throw new Error(`Regolith sensors fetch failed: ${res.statusText}`);
  return res.json();
}

export async function runLifeSupportSimulation(params: {
  mission_duration_sols: number;
  crew_size: number;
  dust_storm_sol: number | null;
  dust_storm_duration: number;
  o2_leak_sol: number | null;
  o2_leak_duration: number;
  greenhouse_area_m2: number;
  enable_closed_loop: boolean;
}): Promise<LifeSupportSimulationResult> {
  const res = await apiFetch(`${API_BASE}/life-support/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Life support simulation failed: ${res.statusText}`);
  return res.json();
}

export async function fetchRealDataI4(): Promise<RealDataI4> {
  const res = await apiFetch(`${API_BASE}/real-data/i4`);
  if (!res.ok) throw new Error(`Real data fetch failed: ${res.statusText}`);
  return res.json();
}

async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body?.detail)) {
      return body.detail
        .map((d: { loc?: Array<string | number>; msg?: string }) => `${(d.loc ?? []).slice(1).join('.') || 'input'}: ${d.msg ?? ''}`)
        .join('; ');
    }
    if (typeof body?.detail === 'string') return body.detail;
  } catch {
    /* not JSON */
  }
  return `${fallback}: ${res.statusText}`;
}

export async function submitCheckin(payload: CheckinInput): Promise<CheckinResult> {
  const res = await apiFetch(`${API_BASE}/health/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await errorDetail(res, 'Check-in failed'));
  return res.json();
}

export async function fetchCheckins(astronautId: string): Promise<CheckinHistory> {
  const res = await apiFetch(`${API_BASE}/health/checkins?astronaut_id=${encodeURIComponent(astronautId)}`);
  if (!res.ok) throw new Error(await errorDetail(res, 'Check-in history fetch failed'));
  return res.json();
}

export async function fetchCheckinGuide(): Promise<CheckinGuide> {
  const res = await apiFetch(`${API_BASE}/health/checkin/guide`);
  if (!res.ok) throw new Error(await errorDetail(res, 'Check-in guide fetch failed'));
  return res.json();
}
