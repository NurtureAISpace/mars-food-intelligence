export interface DashboardTelemetry {
  mission_sol: number;
  sol_milestone: string;
  crew_size: number;
  food_security_index_pct: number;
  remaining_food_mass_kg: number;
  days_of_rations_remaining: number;
  daily_crop_harvest_biomass_g: number;
  total_active_crops: number;
  habitat_cooling_power_kw: number;
  nasa_std_3001_status: string;
  active_alerts: Array<{
    level: string;
    message: string;
  }>;
}

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  preservation_method: string;
  package_type: string;
  serving_size_g: number;
  packaging_mass_g: number;
  water_to_rehydrate_ml: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  lipids_g: number;
  vitamin_c_mg: number;
  thiamine_b1_mg: number;
  potassium_mg: number;
  iron_mg: number;
  shelf_life_nominal_sols_at_21C: number;
  shelf_life_chilled_sols_at_4C: number;
  arrhenius_A: number;
  activation_energy_Ea_kJ_mol: number;
  kinetic_order: number;
  sensory_initial_score: number;
  storage_temp_recommended_c: number;
}

export interface DataAuditReport {
  total_records: number;
  categories_breakdown: Record<string, number>;
  missing_fields_count: number;
  data_quality_score_pct: number;
  unit_consistency_verified: boolean;
  scientific_bounds_passed: boolean;
  audit_notes: string[];
}

export interface ValidationBenchmarks {
  model_architecture: string;
  total_benchmark_series: number;
  aggregate_rmse: number;
  aggregate_r2_score: number;
  validation_verdict: string;
  series: Array<{
    food_id: string;
    food_name: string;
    nutrient: string;
    temperature_c: number;
    sample_points: number;
    rmse: number;
    r2_score: number;
    datapoints: Array<{
      sol: number;
      measured_retention: number;
      predicted_retention: number;
      residual: number;
    }>;
  }>;
}

export interface ShelfLifePrediction {
  food_id: string;
  food_name: string;
  storage_temperature_c: number;
  rate_constant_k_per_day: number;
  half_life_sols: number;
  critical_threshold_pct: number;
  drop_dead_sol: number;
  status: string;
  retention_curve: Array<{
    sol: number;
    retention_pct: number;
  }>;
}

export interface OptimizationResponse {
  success: boolean;
  objective_mode: string;
  crew_size: number;
  mission_sol: number;
  optimal_daily_metrics: {
    total_calories_kcal: number;
    calories_per_crew_kcal: number;
    total_protein_g: number;
    total_vitamin_c_mg: number;
    total_thiamine_b1_mg: number;
    total_potassium_mg: number;
    total_daily_mass_kg: number;
    rehydration_water_required_liters: number;
    cooling_power_draw_watts: number;
  };
  nasa_std_3001_compliance: {
    calories_compliance_pct: number;
    protein_compliance_pct: number;
    vitamin_c_compliance_pct: number;
    thiamine_b1_compliance_pct: number;
  };
  allocated_food_plan: Array<{
    id: string;
    name: string;
    category: string;
    daily_servings: number;
    total_mass_g: number;
    calories_provided: number;
  }>;
}

export interface SimulationResult {
  mission_parameters: {
    duration_sols: number;
    crew_size: number;
    storage_regime: string;
    ration_strategy: string;
    crop_area_m2: number;
    cooling_failure_sol: number | null;
    crop_failure_sol: number | null;
  };
  summary_metrics: {
    mission_survived: boolean;
    first_critical_sol: number | null;
    minimum_food_security_index: number;
    final_food_security_index: number;
    total_biomass_harvested_kg: number;
    total_cumulative_energy_kwh: number;
    total_alerts_count: number;
  };
  critical_advisories: string[];
  telemetry_timeline: Array<{
    sol: number;
    storage_temp_c: number;
    remaining_mass_kg: number;
    daily_fresh_biomass_g: number;
    thiamine_retention_pct: number;
    vitamin_c_retention_pct: number;
    sensory_score: number;
    food_security_index: number;
    power_draw_kw: number;
    active_alarm_count: number;
  }>;
}

// ---------------------------------------------------------------------------
// Crew Health (synthetic crew data; vitamin degradation from Arrhenius model)
// ---------------------------------------------------------------------------
export type CrewStatus = 'CALIBRATING' | 'NOMINAL' | 'WATCH' | 'ACT';
export type NutrientKey = 'vitamin_c' | 'thiamine_b1';
export type VitalKey = 'hr_rest' | 'sleep_h' | 'body_mass_kg' | 'fatigue_score';

export interface CrewHealthScenario {
  failure_enabled: boolean;
  cooling_failure_sol: number;
  failure_duration_sols: number;
  failure_peak_temp_c: number;
}

export interface CrewNutrientMeta {
  label: string;
  pool_max_mg: number;
  risk_threshold_mg: number;
  absorption: number;
  population_turnover_per_day: number;
}

export interface CrewEvents {
  cooling_failure: { start_sol: number; end_sol: number; peak_temp_c: number } | null;
  greenhouse_outage: { start_sol: number; end_sol: number } | null;
}

export interface CrewAlertChange {
  signal: string;
  label: string;
  baseline: number | null;
  current: number | null;
  pct_change_vs_baseline: number | null;
  z: number | null;
}

export interface CrewAlert {
  astronaut_id: string;
  sol: number;
  status: CrewStatus;
  nutrient: NutrientKey;
  pool_mg: number | null;
  risk_threshold_mg: number;
  sols_to_risk: number | null;
  projected_risk_sol: number | null;
  top_vital_driver: VitalKey;
  driver_z: number | null;
  anomaly_score: number | null;
  since_sol: number | null;
  since_signal: string | null;
  changes: CrewAlertChange[];
  intake_gap_mg_per_sol: number | null;
  recommendation: {
    food_id: string;
    food_name: string;
    source: string;
    nutrient_per_serving_mg: number;
    servings_per_sol: number | null;
    feasible: boolean;
  } | null;
  action: string;
  message: string;
}

export interface CrewMemberStatus {
  astronaut_id: string;
  status: CrewStatus;
  worst_nutrient: NutrientKey | null;
  sols_to_risk: number | null;
  top_driver: VitalKey | null;
  driver_z: number | null;
  anomaly_score: number | null;
  iso_outlier: boolean;
  vitals: Record<VitalKey, number | null>;
  z_scores: Record<VitalKey, number | null>;
  nutrients: Record<NutrientKey, {
    pool_mg: number | null;
    pool_pct_of_max: number | null;
    personal_turnover_per_sol: number | null;
    equilibrium_pool_mg: number | null;
    sols_to_risk: number | null;
  }>;
  first_watch_sol: number | null;
  first_act_sol: number | null;
  assessment: CrewAlert | null;
}

export interface CrewHealthSnapshot {
  data_provenance: string;
  scenario: Record<string, unknown> & { mission_sols: number; calibration_sols: number; failure_enabled: boolean };
  events: CrewEvents;
  sol: number;
  storage_temp_c: number;
  greenhouse_online: boolean;
  crew_status: CrewStatus;
  status_counts: Record<CrewStatus, number>;
  status_rules: Record<CrewStatus, string>;
  nutrients: Record<NutrientKey, CrewNutrientMeta>;
  crew: CrewMemberStatus[];
  active_alerts: CrewAlert[];
}

export interface AstronautTimelinePoint {
  sol: number;
  storage_temp_c: number;
  vitamin_c_intake_mg: number;
  vitamin_c_pool_mg: number;
  vitamin_c_sols_to_risk: number | null;
  thiamine_b1_intake_mg: number;
  thiamine_b1_pool_mg: number;
  thiamine_b1_sols_to_risk: number | null;
  hr_rest: number;
  sleep_h: number;
  body_mass_kg: number;
  fatigue_score: number;
  z_hr_rest: number | null;
  z_sleep_h: number | null;
  z_body_mass_kg: number | null;
  z_fatigue_score: number | null;
  anomaly_score: number;
  status: CrewStatus;
  worst_nutrient: NutrientKey | null;
  sols_to_risk: number | null;
  top_driver: VitalKey | null;
  driver_z: number | null;
}

export interface AstronautTimeline {
  data_provenance: string;
  astronaut_id: string;
  events: CrewEvents;
  nutrients: Record<NutrientKey, CrewNutrientMeta>;
  baseline: Record<VitalKey, { mean: number; sd: number; band_low: number; band_high: number }>;
  pool_baseline_mg: Record<NutrientKey, number>;
  first_watch_sol: number | null;
  first_act_sol: number | null;
  threshold_crossing_sol: Record<NutrientKey, number | null>;
  alerts: CrewAlert[];
  timeline: AstronautTimelinePoint[];
}

export interface CrewAlertsResponse {
  data_provenance: string;
  sol: number;
  count: number;
  alerts: CrewAlert[];
}

// ==========================================
// ECLSS & Regolith Hydro-Management (Faruk Karimli)
// ==========================================

export interface RegolithSensorNodeData {
  node_id: string;
  zone_name: string;
  target_crop: string;
  depth_cm: number;
  volumetric_water_content_pct: number;
  soil_temperature_c: number;
  electrical_conductivity_ds_m: number;
  regolith_ph: number;
  irrigation_valve_open: boolean;
  status: string;
}

export interface LifeSupportTelemetryData {
  sol: number;
  crew_size: number;
  atmosphere: {
    total_pressure_kpa: number;
    partial_pressure_o2_kpa: number;
    partial_pressure_co2_kpa: number;
    cabin_temperature_c: number;
    relative_humidity_pct: number;
  };
  reserves: {
    o2_reserve_kg: number;
    potable_water_l: number;
    water_loop_closure_pct: number;
  };
  daily_rates: {
    crew_o2_consumption_kg: number;
    plant_o2_generation_kg: number;
    ogs_electrolysis_o2_kg: number;
    co2_absorbed_by_crops_kg: number;
    sabatier_water_recovered_l: number;
    water_transpired_crops_l: number;
    net_water_daily_delta_l: number;
  };
  power: {
    solar_power_generated_kwh: number;
    power_consumed_kwh: number;
    battery_state_of_charge_pct: number;
  };
  contingencies: {
    dust_storm_active: boolean;
    o2_leak_active: boolean;
  };
  regolith_moisture_sensors: RegolithSensorNodeData[];
  active_alerts: string[];
  overall_eclss_status: string;
  author: string;
}

export interface LifeSupportSimulationResult {
  mission_sols: number;
  crew_size: number;
  closed_loop_enabled: boolean;
  final_metrics: {
    remaining_o2_kg: number;
    remaining_water_l: number;
    final_battery_soc_pct: number;
    survival_verdict: string;
  };
  timeline: Array<{
    sol: number;
    o2_reserve_kg: number;
    potable_water_reserve_l: number;
    battery_soc_pct: number;
    power_generation_kwh: number;
    avg_regolith_moisture_vwc: number;
    active_irrigation_valves: number;
    dust_storm_active: boolean;
    o2_leak_active: boolean;
    life_support_index_pct: number;
  }>;
  alerts: string[];
  author: string;
}

// ---------------------------------------------------------------------------
// Real NASA data: Inspiration4 blood panels (NASA OSDR OSD-569 CBC, OSD-575 CMP)
// ---------------------------------------------------------------------------
export type RefStatus = 'in' | 'LOW' | 'HIGH' | 'n/a';

export interface RealDataPoint {
  timepoint: string;
  value: number | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_status: RefStatus;
  z: number | null;
  flagged: boolean;
}

export interface RealDataSeries {
  astronaut: string;
  analyte: string;
  unit: string;
  panel: string;
  baseline: {
    timepoints: string[];
    n: number;
    mean: number | null;
    sd: number | null;
    sd_source: 'personal' | 'floor' | 'none';
    band_low: number | null;
    band_high: number | null;
  };
  points: RealDataPoint[];
}

export interface RealDataSharedFinding {
  analyte: string;
  label: string;
  unit: string;
  timepoint: string;
  direction: 'up' | 'down';
  n_crew_flagged: number;
  n_crew: number;
  mean_pct_change: number | null;
  n_beyond_all_preflight_values: number;
  n_inside_reference_range: number;
  per_astronaut: Array<{
    astronaut: string;
    value: number | null;
    baseline_mean: number | null;
    z: number | null;
    flagged: boolean;
    pct_change: number | null;
    beyond_all_preflight_values: boolean;
    ref_status: RefStatus;
  }>;
  sensitivity: { sd_floor_fraction_of_range: number; n_crew_flagged: number; plain_text: string };
  other_all_crew_analytes: string[];
  plain_text: string;
}

export interface RealDataNoiseControl {
  control_timepoint: string;
  control_baseline: string[];
  control_flagged: number;
  control_tests: number;
  control_pct: number | null;
  flight_timepoint: string;
  flight_flagged: number;
  flight_tests: number;
  flight_pct: number | null;
  single_flags_mostly_noise: boolean;
  n_analytes: number;
  expected_all_crew_by_chance: number | null;
  chance_note: string;
  plain_text: string;
}

export interface RealDataI4 {
  source: {
    name: string;
    mission: string;
    osd_ids: string[];
    panels: Record<string, string>;
    urls: Array<{ label: string; url: string }>;
    license: string;
    citation: string;
    mission_days: number;
  };
  crew: Array<{ id: string; sex: string | null }>;
  timepoints: Array<{ id: string; phase: 'pre' | 'post'; day: number; label: string; is_baseline: boolean }>;
  baseline_timepoints: string[];
  post_flight_timepoints: string[];
  analytes: Array<{
    name: string;
    label: string;
    unit: string;
    panel: string;
    reference_range: { low: number | null; high: number | null };
  }>;
  default_analyte: string | null;
  series: RealDataSeries[];
  method: { flag_z: number; sd_floor_fraction_of_range: number; plain_text: string };
  summary: {
    flag_z: number;
    flags_per_timepoint: Array<{ timepoint: string; flagged: number; tests: number; pct: number | null }>;
    shared_finding: RealDataSharedFinding | null;
    crew_consistent_shifts: Array<{ analyte: string; label: string; direction: 'up' | 'down'; astronauts: string[]; z: Array<number | null> }>;
    noise_control: RealDataNoiseControl;
  };
  limitations: Array<{ key: string; title: string; text: string }>;
}
