// Food & Vitamins: what happens to the crew's vitamins in a normal mission vs. a food-storage failure.
// Uses the existing demo presets (GET /health/scenarios: "nominal" and "severe_cooling_failure"), the crew
// snapshot at the last mission Sol and the early-warning alerts. Every number shown comes from those responses.
import React, { useEffect, useState } from 'react';
import { Flag, Snowflake, ThermometerSun, Users } from 'lucide-react';
import { fetchAlertsPreset, fetchCrewPreset, fetchCrewScenarios } from '../api';
import type { CrewAlert, CrewAlertsResponse, CrewHealthSnapshot, CrewMemberStatus, CrewScenarioPreset } from '../types';
import { DataTag, ErrorBox, GlassPanel, Loading, Section, SelectCard, StatusBadge } from '../ui/glass';

const NORMAL_ID = 'nominal';
const FAILURE_ID = 'severe_cooling_failure';

const VITAMIN: Record<string, string> = { vitamin_c: 'Vitamin C', thiamine_b1: 'Vitamin B1', vitamin_d: 'Vitamin D' };
const DRIVER: Record<string, string> = {
  hr_rest: 'Resting heart rate', sleep_h: 'Sleep', body_mass_kg: 'Body weight', fatigue_score: 'Tiredness',
};

const vit = (key: string | null | undefined) => (key ? VITAMIN[key] ?? key.replace(/_/g, ' ') : 'A vitamin');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plain action from the model's recommendation ("change the menu" when it is a food). */
function actionOf(a: CrewAlert): string {
  const r = a.recommendation;
  if (!r) return 'measure again and check the crew log';
  return r.food_id ? `change the menu — add ${r.food_name}` : `add a ${vit(a.nutrient)} supplement`;
}

/** One sentence + one action per crew member, from the snapshot's own numbers. */
function crewSentence(m: CrewMemberStatus): string {
  if (m.status === 'CALIBRATING') return "Still learning this person's normal.";
  const a = m.assessment;
  if (m.status === 'NOMINAL' || !a) return 'Vitamins stay above the safe level.';
  if (!a.recommendation) return `${DRIVER[a.top_vital_driver] ?? 'A vital sign'} changed from their usual. Action: measure again.`;
  const s = a.sols_to_risk;
  if (s !== null && s <= 0) return `${vit(a.nutrient)} is already below the safe level. Action: ${actionOf(a)}.`;
  const when = s !== null ? ` — expected problem in ~${Math.round(s)} Sols` : '';
  return `${vit(a.nutrient)} is running low${when}. Action: ${actionOf(a)}.`;
}

type Step = { title: string; line: string };

/** 4-step briefing from the first vitamin alert of the scenario (earliest Sol with a forecast problem date). */
function timeline(snap: CrewHealthSnapshot, alerts: CrewAlertsResponse, preset?: CrewScenarioPreset): Step[] | null {
  const focus = [...alerts.alerts]
    .filter((a) => a.nutrient && a.projected_risk_sol !== null)
    .sort((x, y) => x.sol - y.sol)[0];
  if (!focus) return null;
  const ev = snap.events.cooling_failure;
  const cold = preset?.parameters?.nominal_storage_temp_c;
  const start = ev
    ? `Sol ${ev.start_sol}: food storage warms to ${ev.peak_temp_c} °C for ${ev.end_sol - ev.start_sol} Sols.`
    : `Food stays cold${typeof cold === 'number' ? ` (${cold} °C)` : ''} all mission.`;
  const lead = (focus.projected_risk_sol as number) - focus.sol;
  return [
    { title: 'Start', line: start },
    { title: `Warning · Sol ${focus.sol}`, line: `${focus.astronaut_id}: ${vit(focus.nutrient)} starts running low.` },
    { title: `Problem would start · Sol ${focus.projected_risk_sol}`, line: `${lead} Sols after the warning.` },
    { title: 'Action', line: `${cap(actionOf(focus))}.` },
  ];
}

const Timeline: React.FC<{ steps: Step[] }> = ({ steps }) => (
  <ol className="relative grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-4">
    <span aria-hidden className="absolute left-6 right-6 top-6 hidden h-px bg-indigo-400/40 lg:block" />
    {steps.map((s, i) => (
      <li key={s.title} className="relative flex gap-4 lg:flex-col lg:gap-3">
        <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border border-indigo-400/60 bg-indigo-600 text-xl font-bold text-white shadow-[0_0_20px_-4px_rgba(99,102,241,0.8)]">
          {i + 1}
        </span>
        <span>
          <span className="block text-lg font-semibold text-white">{s.title}</span>
          <span className="block text-base text-slate-300">{s.line}</span>
        </span>
      </li>
    ))}
  </ol>
);

export const PredictionView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [presets, setPresets] = useState<CrewScenarioPreset[]>([]);
  const [selected, setSelected] = useState<string>(FAILURE_ID);
  const [result, setResult] = useState<{ id: string; snap: CrewHealthSnapshot; alerts: CrewAlertsResponse } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCrewScenarios().then((d) => setPresets(d.scenarios)).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const snap = await fetchCrewPreset(selected);
        const alerts = await fetchAlertsPreset(selected, snap.sol);
        if (!cancelled) setResult({ id: selected, snap, alerts });
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const preset = (id: string) => presets.find((p) => p.id === id);
  const normal = preset(NORMAL_ID)?.parameters;
  const failure = preset(FAILURE_ID)?.parameters;
  const current = result && result.id === selected ? result : null;
  const steps = current ? timeline(current.snap, current.alerts, preset(selected)) : null;

  return (
    <GlassPanel
      title="Food & Vitamins"
      subtitle="Stored food loses vitamins. We warn before the crew runs low."
      onBack={onBack}
      tags={<DataTag kind="simulated" />}
    >
      {current && (
        <p className="-mt-2 text-sm text-slate-300">
          Simulated {current.snap.scenario.mission_sols}-Sol Mars mission crew ({current.snap.crew.map((m) => m.astronaut_id).join(', ')}) — not the Inspiration4 crew.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectCard selected={selected === NORMAL_ID} onClick={() => setSelected(NORMAL_ID)} icon={Snowflake}
          title="Normal mission"
          subtitle={typeof normal?.nominal_storage_temp_c === 'number' ? `Food stored at ${normal.nominal_storage_temp_c} °C` : undefined} />
        <SelectCard selected={selected === FAILURE_ID} onClick={() => setSelected(FAILURE_ID)} icon={ThermometerSun}
          title="Storage failure"
          subtitle={failure?.cooling_failure_sol != null ? `Cooling fails at Sol ${failure.cooling_failure_sol}, up to ${failure.failure_peak_temp_c} °C` : undefined} />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {!current && !error && <Loading />}

      {current && (
        <>
          <Section icon={Users} title={`Crew at Sol ${current.snap.sol}`}>
            <ul className="divide-y divide-white/10">
              {current.snap.crew.map((m) => (
                <li key={m.astronaut_id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-5">
                  <span className="w-24 shrink-0 font-mono text-lg font-semibold text-white">{m.astronaut_id}</span>
                  <span className="w-44 shrink-0"><StatusBadge status={m.status} /></span>
                  <span className="text-base text-white">{crewSentence(m)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={Flag} title="Mission timeline">
            {steps ? <Timeline steps={steps} /> : <p className="text-lg text-white">No vitamin problem expected in this mission.</p>}
          </Section>
        </>
      )}
    </GlassPanel>
  );
};
