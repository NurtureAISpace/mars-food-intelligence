// Shapes of the backend check-in API (backend/app/services/checkin_service.py) and of local IndexedDB records.

export type Color = 'green' | 'amber' | 'red';
export type ServerStatus = 'NOMINAL' | 'WATCH' | 'ACT';

export const NUMBER_FIELDS = [
  'heart_rate_bpm',
  'systolic_mmHg',
  'diastolic_mmHg',
  'blood_glucose_mg_dl',
  'body_temp_c',
  'sleep_hours',
] as const;
export type NumberField = (typeof NUMBER_FIELDS)[number];
export type Field = NumberField | 'mood_1_5';

export interface ThresholdRow {
  field: string;
  color: 'amber' | 'red';
  direction: 'below' | 'above';
  value: number;
  inclusive: boolean;
  status: string;
  source: string;
  where_in_source?: string | null;
}

export interface GuideIndicator {
  key: string;
  label: string;
  unit: string;
  fields: Field[];
  range_text: string;
  how_to_measure: string;
  why_it_matters_in_space: string;
  hazard: string;
  thresholds: ThresholdRow[];
  sources: Array<{ id: string; citation: string; doi_or_url: string; access: string }>;
}

/** GET /api/v1/health/checkin/guide */
export interface Guide {
  disclaimer: string;
  routine: { when: string; order: string[]; why: string };
  baseline: { min_prior_entries: number; flag_abs_z: number };
  status_rules: Record<string, string>;
  input_limits: Record<string, { min: number; max: number }>;
  indicators: GuideIndicator[];
}

/** POST /api/v1/health/checkin body (client_id + measured_at are the optional offline-client fields). */
export interface CheckinPayload {
  astronaut_id: string;
  sol: number;
  heart_rate_bpm: number;
  systolic_mmHg: number;
  diastolic_mmHg: number;
  blood_glucose_mg_dl: number;
  body_temp_c: number;
  sleep_hours: number;
  mood_1_5: number;
  notes?: string | null;
  client_id: string;
  measured_at: string;
  /** Anonymized code made on this device from the name (see pseudonym.ts). The name itself is never sent. */
  pseudonym?: string;
}

/** One stored check-in as returned by GET /api/v1/health/checkins (and as `record` in the POST response). */
export interface ServerCheckin {
  astronaut_id: string;
  sol: number;
  heart_rate_bpm: number;
  systolic_mmHg: number;
  diastolic_mmHg: number;
  blood_glucose_mg_dl: number;
  body_temp_c: number;
  sleep_hours: number;
  mood_1_5: number;
  notes?: string | null;
  client_id?: string;
  measured_at?: string;
  pseudonym?: string;
  recorded_at: string;
  overall_status: ServerStatus;
  colors: Record<string, Color>;
  baseline_flags: string[];
}

export interface ServerHistory {
  astronaut_id: string;
  count: number;
  streak: { current_sols: number; last_sol: number | null; total_checkins: number };
  checkins: ServerCheckin[];
}

/** Offline range-only check computed on the device from the cached guide. Never the final status. */
export interface Provisional {
  overall: Color;
  indicators: Array<{ key: string; label: string; color: Color }>;
}

export type SyncState = 'pending' | 'synced' | 'failed';

/** Server outcome stored on a local entry once it has synced. */
export interface ServerOutcome {
  status: ServerStatus;
  recorded_at: string;
  duplicate: boolean;
  colors: Record<string, Color>;
  headline: string | null;
  contact_flight_surgeon: boolean;
  baseline_flags: string[];
}

/** A check-in as stored in IndexedDB on this device. */
export interface LocalCheckin {
  client_id: string;
  astronaut_id: string;
  created_at: string;
  payload: CheckinPayload;
  sync: SyncState;
  attempts: number;
  /** epoch ms; earliest time an automatic retry may run (manual "Sync now" ignores it) */
  next_attempt_at: number | null;
  last_error: string | null;
  provisional: Provisional | null;
  server: ServerOutcome | null;
}

/** Who uses this device. Stored ONLY in this device's IndexedDB; `name` is never sent to the backend. */
export interface Profile {
  name: string;
  seat: number;      // 1..4 -> crew id C00k (config.ts)
  pseudonym: string; // "CREW-XXXXXX", the only identity the backend and dashboard see
  created_at: string;
}
