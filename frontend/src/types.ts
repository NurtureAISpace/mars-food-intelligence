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
