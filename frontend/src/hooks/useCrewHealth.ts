import { useEffect, useState } from 'react';
import { fetchCrewHealth, fetchCrewScenarios } from '../api';
import type { CrewHealthScenario, CrewHealthSnapshot, CrewScenarioPreset } from '../types';

export function useDebounced<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

export const DEFAULT_SCENARIO: CrewHealthScenario = {
  failure_enabled: true,
  cooling_failure_sol: 150,
  failure_duration_sols: 45,
  failure_peak_temp_c: 29.5,
};

/**
 * Crew Health scenario + Sol state and the /health/crew snapshot for it.
 * Lives in App so the navbar's "CREW STATUS" pill always reflects the scenario/Sol
 * selected on the Crew Health screen, even while another screen is open.
 */
export function useCrewHealth() {
  const [sol, setSol] = useState<number>(200);
  const [scenario, setScenario] = useState<CrewHealthScenario>(DEFAULT_SCENARIO);
  const [presets, setPresets] = useState<CrewScenarioPreset[]>([]);
  const [snapshot, setSnapshot] = useState<CrewHealthSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCrewScenarios().then((d) => setPresets(d.scenarios)).catch((e) => setError(String(e)));
  }, []);

  const dSol = useDebounced(sol, 120);
  const dScenario = useDebounced(scenario, 350);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCrewHealth(dSol, dScenario)
      .then((d) => { if (!cancelled) { setSnapshot(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dSol, dScenario]);

  const applyPreset = (p: CrewScenarioPreset) => {
    if (!p.parameters) return;
    const q = p.parameters;
    setScenario({
      failure_enabled: q.failure_enabled,
      // nominal: failure fields are null; keep the slider defaults
      cooling_failure_sol: q.cooling_failure_sol ?? DEFAULT_SCENARIO.cooling_failure_sol,
      failure_duration_sols: q.failure_duration_sols ?? DEFAULT_SCENARIO.failure_duration_sols,
      failure_peak_temp_c: q.failure_peak_temp_c ?? DEFAULT_SCENARIO.failure_peak_temp_c,
    });
  };

  return { sol, setSol, dSol, scenario, setScenario, dScenario, presets, applyPreset, snapshot, loading, error };
}

export type CrewHealthState = ReturnType<typeof useCrewHealth>;
