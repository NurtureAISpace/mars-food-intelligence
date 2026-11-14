// Food & Vitamins: what happens to the crew's vitamins for a chosen destination (Earth orbit / Moon / Mars) and a
// chosen food scenario (normal mission / storage failure).
// - Destinations and scenario presets: GET /health/scenarios.
// - Everything else: ONE response, GET /health/crew?scenario=<id>&horizon_sols=<destination horizon>. Its `horizon`
//   block holds every Sol/day number shown here (warning, problem, per-crew vitamins, cooling failure, mission end).
// A destination changes only the mission length (forecast horizon); the model is the same for all three.
import React, { useEffect, useState } from 'react';
import {
  ArrowRight, Flag, Globe, Moon, Pill, Satellite, ShieldAlert, Snowflake, ThermometerSun, Users,
} from 'lucide-react';
import { fetchCrewPresetHorizon, fetchCrewScenarios } from '../api';
import type { CrewDestination, CrewHealthSnapshot, CrewHorizon, CrewMemberStatus, CrewScenarioPreset, SolDay } from '../types';
import {
  Bullets, Details, ErrorBox, GlassPanel, KVList, KVRow, Loading, Section, SelectCard, SourceTag, StatTile, StatusBadge,
} from '../ui/glass';

const NORMAL_ID = 'nominal';
const FAILURE_ID = 'severe_cooling_failure';

const VITAMIN: Record<string, string> = { vitamin_c: 'Vitamin C', thiamine_b1: 'Vitamin B1', vitamin_d: 'Vitamin D' };
const DRIVER: Record<string, string> = {
  hr_rest: 'resting heart rate', sleep_h: 'sleep', body_mass_kg: 'body weight', fatigue_score: 'tiredness',
};
const DEST_ICON: Record<string, typeof Globe> = { earth_orbit: Satellite, moon: Moon, mars: Globe };

const vit = (key: string | null | undefined) => (key ? VITAMIN[key] ?? key.replace(/_/g, ' ') : 'A vitamin');

type Rec = NonNullable<CrewHorizon['first_warning']>['recommendation'];
/** Plain action from the model's recommendation ("change the menu" when it is a food). */
function actionOf(rec: Rec, nutrient: string): string {
  if (!rec) return 'measure again and check with the flight surgeon';
  return rec.food_id ? `change the menu: add ${rec.food_name}` : `consider a ${vit(nutrient)} supplement (check with the flight surgeon)`;
}

/** "Smith 2005" from a citation string; "assumed" for model assumptions. */
function shortSource(d: CrewDestination): string {
  if (d.status === 'assumed') return 'assumed';
  const author = (d.source_citation ?? d.source).split(/[ ,]/)[0];
  const year = /\((\d{4})\)/.exec(d.source_citation ?? '')?.[1];
  return year ? `${author} ${year}` : author;
}

function durationText(d: CrewDestination): string {
  const unit = d.unit === 'sol' ? 'Sols' : 'days';
  return d.status === 'assumed' ? `~${d.mission_length} ${unit} (assumed)` : `Up to ${d.mission_length} ${unit} (${shortSource(d)})`;
}

const DEST_META: Record<string, string> = {
  earth_orbit: 'Inspiration4 (real NASA data) flew here',
  moon: 'A short crewed trip',
  mars: 'The full simulated mission',
};

/** Unit-aware formatting: Days for Earth orbit / Moon, Sols for Mars. Values always come from the API (sol + day). */
function unitFormat(d: CrewDestination | undefined) {
  const sol = d?.unit === 'sol';
  return {
    at: (x: SolDay) => (sol ? `Sol ${x.sol}` : `Day ${x.day}`),
    lead: (h: NonNullable<CrewHorizon['first_warning']>) => (sol ? `${h.lead_sols} Sols` : `${h.lead_days} days`),
    length: (h: CrewHorizon) => (sol ? `${h.horizon_sols} Sols` : `${h.horizon_days} days`),
    word: sol ? 'Sols' : 'days',
  };
}

type Step = { title: string; line: string };

function timeline(h: CrewHorizon, u: ReturnType<typeof unitFormat>, storageTemp: unknown): Step[] {
  const cf = h.cooling_failure;
  const start = cf
    ? cf.in_mission
      ? `${u.at(cf.start)}: food storage warms to ${cf.peak_temp_c} °C${cf.end.sol >= h.horizon_sols ? ' until the mission ends' : ` until ${u.at(cf.end)}`}.`
      : `The storage failure is set for ${u.at(cf.start)}, after this mission ends.`
    : `Food stays cold${typeof storageTemp === 'number' ? ` (${storageTemp} °C)` : ''} all mission.`;
  const fw = h.first_warning;
  if (!fw) {
    return [
      { title: 'Start', line: start },
      { title: `Mission ends · ${u.at(h.last)}`, line: `After ${u.length(h)}.` },
      { title: 'Result', line: 'Vitamins last the whole mission.' },
      { title: 'Action', line: 'Keep the menu and the daily check-ins.' },
    ];
  }
  return [
    { title: 'Start', line: start },
    { title: `Warning · ${u.at(fw.warning)}`, line: `${fw.astronaut_id}: ${vit(fw.nutrient)} starts running low.` },
    { title: `Problem would start · ${u.at(fw.problem)}`, line: `${u.lead(fw)} after the warning.` },
    { title: 'Action', line: `${actionOf(fw.recommendation, fw.nutrient).replace(/^./, (c) => c.toUpperCase())}.` },
  ];
}

const Timeline: React.FC<{ steps: Step[] }> = ({ steps }) => (
  <ol className="relative grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-5">
    <span aria-hidden className="absolute left-6 right-6 top-6 hidden h-px bg-indigo-400/40 lg:block" />
    {steps.map((s, i) => (
      <li key={s.title} className="relative flex gap-4 lg:flex-col lg:gap-3">
        <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border border-indigo-400/60 bg-indigo-600 text-[22px] font-bold text-white shadow-[0_0_20px_-4px_rgba(99,102,241,0.8)]">
          {i + 1}
        </span>
        <span>
          <span className="block text-[20px] font-semibold text-white">{s.title}</span>
          <span className="mt-1 block text-[18px] leading-relaxed text-slate-300">{s.line}</span>
        </span>
      </li>
    ))}
  </ol>
);

/** Up to 4 risks/actions, built only from the horizon block and the end-of-mission snapshot. */
function risks(snap: CrewHealthSnapshot, h: CrewHorizon, u: ReturnType<typeof unitFormat>): string[] {
  const out: string[] = [];
  const cf = h.cooling_failure;
  if (cf?.in_mission) {
    out.push(`Food storage warms to ${cf.peak_temp_c} °C from ${u.at(cf.start)}: vitamins in stored food break down faster.`);
  }
  const fw = h.first_warning;
  if (fw) {
    out.push(`${fw.astronaut_id}: ${vit(fw.nutrient)} may run low around ${u.at(fw.problem)}. Action: ${actionOf(fw.recommendation, fw.nutrient)}.`);
  }
  for (const p of h.per_astronaut) {
    for (const [n, v] of Object.entries(p.vitamins)) {
      if (!v.runs_low || (fw && p.astronaut_id === fw.astronaut_id && n === fw.nutrient)) continue;
      out.push(`${p.astronaut_id}: ${vit(n)} may run low around ${u.at(v.runs_low)}. Check with the flight surgeon.`);
    }
  }
  const lowIds = new Set(h.per_astronaut.filter((p) => Object.values(p.vitamins).some((v) => v.runs_low)).map((p) => p.astronaut_id));
  const flagged = snap.crew.filter((m) => (m.status === 'WATCH' || m.status === 'ACT') && !lowIds.has(m.astronaut_id));
  const vital = flagged.filter((m) => m.driver_kind === 'vital_zscore');
  const trend = flagged.filter((m) => m.driver_kind !== 'vital_zscore');
  if (vital.length) {
    const what = Array.from(new Set(vital.map((m) => DRIVER[m.driver_signal ?? m.top_driver ?? ''] ?? 'a vital sign')));
    out.push(`${vital.map((m) => m.astronaut_id).join(', ')}: ${what.join(' / ')} changed from their usual. Measure again at the next check-in.`);
  }
  if (trend.length) {
    const what = Array.from(new Set(trend.map((m) => vit(m.driver_signal ?? m.worst_nutrient))));
    out.push(`${trend.map((m) => m.astronaut_id).join(', ')}: ${what.join(' / ')} trending down, but above the safe level until the mission ends.`);
  }
  if (!fw && !lowIds.size) {
    out.push(`No vitamin falls below the safe level within ${u.length(h)}. Keep the daily check-ins so the forecast stays up to date.`);
  }
  return out.slice(0, 4);
}

const VitaminCard: React.FC<{ m: CrewMemberStatus; v: CrewHorizon['per_astronaut'][number] | undefined; u: ReturnType<typeof unitFormat> }> = ({ m, v, u }) => (
  <div className="inner-card flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-mono text-[22px] font-semibold text-white">{m.astronaut_id}</span>
      <StatusBadge status={m.status} />
    </div>
    <KVList>
      {['vitamin_c', 'thiamine_b1', 'vitamin_d'].map((n) => {
        const low = v?.vitamins[n]?.runs_low ?? null;
        return (
          <KVRow key={n} label={VITAMIN[n]} dot={low ? 'amber' : 'green'}
            value={low ? `Runs low ~${u.at(low)}` : 'OK all mission'} valueClass={low ? 'text-watch' : 'text-white'} />
        );
      })}
    </KVList>
  </div>
);

export const PredictionView: React.FC<{ onBack?: () => void; onNavigate?: (tab: string) => void }> = ({ onBack, onNavigate }) => {
  const [presets, setPresets] = useState<CrewScenarioPreset[]>([]);
  const [destinations, setDestinations] = useState<CrewDestination[]>([]);
  const [destId, setDestId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(FAILURE_ID);
  const [result, setResult] = useState<{ key: string; snap: CrewHealthSnapshot } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCrewScenarios()
      .then((d) => {
        setPresets(d.scenarios);
        setDestinations(d.destinations ?? []);
        setDestId(d.default_destination ?? d.destinations?.[d.destinations.length - 1]?.id ?? null);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const dest = destinations.find((d) => d.id === destId);
  const key = `${selected}|${dest?.horizon_sols ?? ''}`;

  useEffect(() => {
    if (!dest) return;
    let cancelled = false;
    setError(null);
    fetchCrewPresetHorizon(selected, dest.horizon_sols)
      .then((snap) => { if (!cancelled) setResult({ key, snap }); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const u = unitFormat(dest);
  const current = result && result.key === key ? result : null;
  const snap = current?.snap;
  const h = snap?.horizon;
  const cf = h?.cooling_failure;
  const normalTemp = presets.find((p) => p.id === NORMAL_ID)?.parameters?.nominal_storage_temp_c;
  const attention = snap ? snap.crew.filter((m) => m.status === 'WATCH' || m.status === 'ACT').length : 0;
  const sim = <SourceTag kind="simulated" />;

  return (
    <GlassPanel
      title="Food & Vitamins"
      subtitle="Stored food slowly loses vitamins. Pick a destination and a food scenario: we show if a vitamin could run low, and how much warning the crew gets."
      onBack={onBack}
      tags={sim}
    >
      {snap && (
        <p className="-mt-4 text-[16px] text-slate-300">
          Simulated crew ({snap.crew.map((m) => m.astronaut_id).join(', ')}), not the Inspiration4 crew.
        </p>
      )}

      <Section icon={Globe} title="1. Where is the crew going?" right={sim}>
        {!destinations.length && !error && <Loading />}
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-3">
          {destinations.map((d) => (
            <SelectCard key={d.id} selected={d.id === destId} onClick={() => setDestId(d.id)} icon={DEST_ICON[d.id] ?? Globe}
              title={d.label} subtitle={DEST_META[d.id] ?? durationText(d)}
              chips={[
                { tone: 'blue', label: 'Duration', text: durationText(d) },
                { tone: 'violet', label: 'Gravity', text: d.gravity },
                { tone: 'sky', label: 'Resupply', text: d.resupply },
              ]}
              extra={d.id === 'earth_orbit' && onNavigate ? (
                <button type="button" onClick={() => onNavigate('realdata')}
                  className="inline-flex min-h-[48px] items-center gap-2 text-[18px] font-semibold text-indigo-200 hover:text-white">
                  See the real NASA data <ArrowRight className="h-5 w-5" aria-hidden />
                </button>
              ) : undefined}
            />
          ))}
        </div>
      </Section>

      <Section icon={Snowflake} title="2. What happens to the food?" right={sim}>
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
          <SelectCard selected={selected === NORMAL_ID} onClick={() => setSelected(NORMAL_ID)} icon={Snowflake}
            title="Normal mission" subtitle="Food stays cold the whole time"
            chips={[
              { tone: 'blue', label: 'Storage', text: typeof normalTemp === 'number' ? `${normalTemp} °C all mission` : 'Cold all mission' },
              { tone: 'green', label: 'Greenhouse', text: 'Online' },
              { tone: 'neutral', label: 'Vitamin loss', text: 'Normal slow rate' },
            ]} />
          <SelectCard selected={selected === FAILURE_ID} onClick={() => setSelected(FAILURE_ID)} icon={ThermometerSun}
            title="Storage failure" subtitle="Food cooling breaks down mid-mission"
            chips={cf ? [
              { tone: 'red', label: 'Starts', text: cf.in_mission ? u.at(cf.start) : `${u.at(cf.start)} (after this mission)` },
              { tone: 'amber', label: 'Peak', text: `${cf.peak_temp_c} °C for ${dest?.unit === 'sol' ? `${cf.duration_sols} Sols` : `${cf.duration_days} days`}` },
              { tone: 'neutral', label: 'Greenhouse', text: 'Offline after the failure' },
            ] : undefined} />
        </div>
      </Section>

      {error && <ErrorBox>{error}</ErrorBox>}
      {dest && !current && !error && <Loading />}

      {snap && h && dest && (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {h.first_warning ? (
              <StatTile value={u.lead(h.first_warning)} tone="text-watch" label="Warning before the vitamin problem starts" source={sim} />
            ) : (
              <StatTile value="All OK" tone="text-nominal" label="Vitamins last the whole mission" source={sim} />
            )}
            <StatTile value={u.length(h)} label={`Mission length to ${dest.label}`} source={sim} />
            <StatTile value={`${attention} / ${snap.crew.length}`} tone={attention ? 'text-watch' : 'text-white'}
              label="Crew needing attention at the end" source={sim} />
          </div>

          <Section icon={Flag} title="Mission timeline" right={sim}>
            <Timeline steps={timeline(h, u, snap.scenario.nominal_storage_temp_c)} />
          </Section>

          <Section icon={Pill} title={`Vitamins per crew member (to ${u.at(h.last)})`} right={sim}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
              {snap.crew.map((m) => (
                <VitaminCard key={m.astronaut_id} m={m} v={h.per_astronaut.find((p) => p.astronaut_id === m.astronaut_id)} u={u} />
              ))}
            </div>
          </Section>

          <Section icon={ShieldAlert} title="Risks & actions" right={sim}>
            <Bullets items={risks(snap, h, u)} />
          </Section>

          <Details>
            <p>{h.note}</p>
            <p>
              Mission length for {dest.label}: {durationText(dest)}.
              {dest.where_in_source ? ` Source: ${dest.source_citation} (${dest.where_in_source})` : ` ${dest.note}`}
            </p>
            <p>The model counts in Sols (Mars days of 24 h 40 min). Day numbers are Sols × {h.sol_in_earth_days.toFixed(5)}.</p>
          </Details>
        </>
      )}

      {snap && !h && <p className="text-[18px] text-white"><Users className="inline h-5 w-5" aria-hidden /> No forecast summary in this response.</p>}
    </GlassPanel>
  );
};
