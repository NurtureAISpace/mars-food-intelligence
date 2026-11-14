import React, { useEffect, useMemo, useState } from 'react';
import { fetchAstronautTimeline } from '../api';
import { CrewHealthState } from '../hooks/useCrewHealth';
import {
  AstronautTimeline,
  CrewAlert,
  CrewEvents,
  CrewHealthSnapshot,
  CrewMemberStatus,
  CrewStatus,
  NutrientKey,
  VitalKey,
} from '../types';
import { ChevronDown, Info, Sprout, ThermometerSun, Leaf } from 'lucide-react';
import { DailyCheckinPanel } from './DailyCheckinPanel';
import { Hero } from '../ui/Hero';
import { Card, DataBadge, ErrorNote, Eyebrow, SectionHead, StatusPill } from '../ui/primitives';
import { C, STATUS_TONE, TONE } from '../ui/tokens';
import {
  ANNOT, AXIS_TITLE, ChartPlate, GlowFilter, HaloDot, LegendItem, SvgTooltip, TICK, nearest, useHoverX, useSvgId,
} from '../ui/chart';

const MISSION_SOLS = 450;
const FORECAST_HORIZON = 120;

const NUTRIENT_COLOR: Record<NutrientKey, string> = { vitamin_c: C.series1, thiamine_b1: C.series2 };

const VITAL_META: Record<VitalKey, { label: string; unit: string; digits: number }> = {
  hr_rest: { label: 'Resting HR', unit: 'bpm', digits: 0 },
  sleep_h: { label: 'Sleep', unit: 'h', digits: 1 },
  body_mass_kg: { label: 'Body Mass', unit: 'kg', digits: 1 },
  fatigue_score: { label: 'Fatigue', unit: '/10', digits: 1 },
};

const fmt = (x: number | null | undefined, digits = 0, suffix = '') =>
  x === null || x === undefined ? '—' : `${x.toFixed(digits)}${suffix}`;

// ---------------------------------------------------------------------------
// SVG line chart over mission Sols
// ---------------------------------------------------------------------------
interface Series { points: Array<[number, number]>; color: string; label: string; dashed?: boolean; opacity?: number }
interface ChartProps {
  title: string;
  subtitle?: React.ReactNode;
  series: Series[];
  yMin: number;
  yMax: number;
  yTitle: string;
  yUnit: string;
  yDigits?: number;
  events: CrewEvents | null;
  nowSol: number;
  threshold?: { y: number; label: string };
  yBand?: { y0: number; y1: number; mean: number; label: string };
  markers?: Array<{ x: number; y: number; color: string; label: string }>;
  legend: LegendItem[];
  width?: number; // viewBox width: wider for full-width charts so text keeps its size
}

const H = 250;
const PAD_L = 58;
const PAD_R = 16;
const PAD_T = 24;
const PAD_B = 42;

const SvgLineChart: React.FC<ChartProps> = ({
  title, subtitle, series, yMin, yMax, yTitle, yUnit, yDigits = 0, events, nowSol, threshold, yBand, markers = [], legend, width = 640,
}) => {
  const W = width;
  const glowId = useSvgId('glow');
  const sx = (sol: number) => PAD_L + (sol / (MISSION_SOLS - 1)) * (W - PAD_L - PAD_R);
  const span = yMax - yMin || 1;
  const sy = (v: number) => H - PAD_B - ((Math.min(Math.max(v, yMin), yMax) - yMin) / span) * (H - PAD_T - PAD_B);
  const path = (pts: Array<[number, number]>) =>
    pts.reduce((acc, [x, y], i) => `${acc}${i === 0 ? 'M' : ' L'} ${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`, '');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * span);
  const { hx, bind } = useHoverX({ x0: PAD_L, x1: W - PAD_R, d0: 0, d1: MISSION_SOLS - 1, width: W });

  const hover = hx === null ? null : series
    .map((s) => ({ s, p: s.points.length ? nearest(s.points, hx) : null }))
    .filter((d): d is { s: Series; p: [number, number] } => d.p !== null && Math.abs(d.p[0] - hx) <= 3);

  return (
    <ChartPlate title={title} subtitle={subtitle} legend={legend}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
        <defs><GlowFilter id={glowId} /></defs>

        {/* Event bands */}
        {events?.greenhouse_outage && (
          <rect x={sx(events.greenhouse_outage.start_sol)} y={PAD_T}
            width={sx(Math.min(events.greenhouse_outage.end_sol, MISSION_SOLS - 1)) - sx(events.greenhouse_outage.start_sol)}
            height={H - PAD_T - PAD_B} fill="#FFFFFF" opacity={0.035} />
        )}
        {events?.cooling_failure && (
          <g>
            <rect x={sx(events.cooling_failure.start_sol)} y={PAD_T}
              width={sx(events.cooling_failure.end_sol) - sx(events.cooling_failure.start_sol)}
              height={H - PAD_T - PAD_B} fill={C.accent} opacity={0.1} />
            <line x1={sx(events.cooling_failure.start_sol)} y1={PAD_T} x2={sx(events.cooling_failure.start_sol)} y2={H - PAD_B}
              stroke={C.accent} strokeWidth="1" strokeDasharray="3 3" opacity={0.8} />
            <text x={sx(events.cooling_failure.start_sol) + 5} y={PAD_T + 12} {...ANNOT}>
              COOLING FAILURE {events.cooling_failure.peak_temp_c}°C
            </text>
          </g>
        )}

        {/* Grid + y ticks */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={sy(v)} x2={W - PAD_R} y2={sy(v)} stroke={C.grid} />
            <text x={PAD_L - 8} y={sy(v) + 4} textAnchor="end" {...TICK}>{v.toFixed(yDigits)}</text>
          </g>
        ))}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke={C.axis} />
        {[0, 100, 200, 300, 400].map((s) => (
          <text key={s} x={sx(s)} y={H - PAD_B + 16} textAnchor="middle" {...TICK}>{s}</text>
        ))}
        {/* Axis titles */}
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 6} textAnchor="middle" {...AXIS_TITLE}>MISSION SOL</text>
        <text transform={`translate(14 ${(PAD_T + H - PAD_B) / 2}) rotate(-90)`} textAnchor="middle" {...AXIS_TITLE}>
          {yTitle.toUpperCase()} ({yUnit})
        </text>

        {/* Personal baseline band */}
        {yBand && (
          <g>
            <rect x={PAD_L} y={sy(yBand.y1)} width={W - PAD_L - PAD_R} height={Math.max(1, sy(yBand.y0) - sy(yBand.y1))}
              fill={C.band} opacity={0.08} />
            <line x1={PAD_L} y1={sy(yBand.mean)} x2={W - PAD_R} y2={sy(yBand.mean)} stroke={C.band} strokeWidth="1" strokeDasharray="2 4" opacity={0.6} />
          </g>
        )}

        {/* Risk threshold (glowing, status red) */}
        {threshold && (
          <g>
            <line x1={PAD_L} y1={sy(threshold.y)} x2={W - PAD_R} y2={sy(threshold.y)} stroke={C.act} strokeWidth="1.5"
              strokeDasharray="6 4" filter={`url(#${glowId})`} />
            <text x={W - PAD_R - 4} y={sy(threshold.y) - 6} textAnchor="end" {...ANNOT}>{threshold.label}</text>
          </g>
        )}

        {series.map((s, i) =>
          s.points.length > 1 ? (
            <path key={i} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={1.5}
              strokeDasharray={s.dashed ? '5 4' : undefined} opacity={s.opacity ?? 1} strokeLinejoin="round" strokeLinecap="round" />
          ) : null
        )}

        {markers.map((m, i) => (
          <g key={i}>
            <HaloDot cx={sx(m.x)} cy={sy(m.y)} color={m.color} />
            <text x={sx(m.x) + 8} y={sy(m.y) + 15} {...ANNOT} fontWeight={600}>{m.label}</text>
          </g>
        ))}

        {/* Current Sol cursor */}
        <line x1={sx(nowSol)} y1={PAD_T} x2={sx(nowSol)} y2={H - PAD_B} stroke={C.fg} strokeWidth="1" opacity={0.45} />
        <text x={sx(nowSol)} y={PAD_T - 8} textAnchor="middle" {...TICK} fill={C.fg}>SOL {nowSol}</text>

        {/* Hover crosshair + readout */}
        {hx !== null && hover && hover.length > 0 && (
          <g pointerEvents="none">
            <line x1={sx(hover[0].p[0])} y1={PAD_T} x2={sx(hover[0].p[0])} y2={H - PAD_B} stroke={C.fg} strokeWidth="1" opacity={0.25} />
            {hover.map(({ s, p }) => <circle key={s.label} cx={sx(p[0])} cy={sy(p[1])} r={3.5} fill={s.color} stroke={C.ink} strokeWidth={1.5} />)}
            <SvgTooltip x={sx(hover[0].p[0])} y={PAD_T + 4} maxX={W - PAD_R}
              lines={[{ text: `Sol ${Math.round(hover[0].p[0])}` },
                ...hover.map(({ s, p }) => ({ text: `${s.label} ${p[1].toFixed(yDigits)} ${yUnit}`, color: s.color }))]} />
          </g>
        )}
        <rect x={PAD_L} y={PAD_T} width={W - PAD_L - PAD_R} height={H - PAD_T - PAD_B} fill="transparent" {...bind} />
      </svg>
    </ChartPlate>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Status ring: arc = lowest vitamin pool (% of body max), colour = status. */
const StatusRing: React.FC<{ status: CrewStatus; pct: number | null }> = ({ status, pct }) => {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const tone = TONE[STATUS_TONE[status]];
  const p = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className={`relative h-16 w-16 shrink-0 rounded-full ${status === 'ACT' ? 'glow-act' : ''}`}
      title="Ring = lowest vitamin body pool, % of maximum">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={tone.hex} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${(p / 100) * circ} ${circ}`} style={{ filter: `drop-shadow(0 0 4px ${tone.hex}88)` }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[11px] font-semibold text-fg">{pct === null ? '—' : `${p.toFixed(0)}%`}</span>
    </div>
  );
};

const AstronautCard: React.FC<{
  member: CrewMemberStatus;
  snapshot: CrewHealthSnapshot;
  selected: boolean;
  onSelect: () => void;
}> = ({ member, snapshot, selected, onSelect }) => {
  const tone = TONE[STATUS_TONE[member.status]];
  const keys = Object.keys(snapshot.nutrients) as NutrientKey[];
  const pcts = keys.map((n) => member.nutrients[n].pool_pct_of_max).filter((v): v is number => v !== null);
  const minPct = pcts.length ? Math.min(...pcts) : null;
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`card card-hover p-5 text-left ${selected ? '!border-accent/70 ring-1 ring-accent/50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold tracking-[0.08em] text-fg">{member.astronaut_id}</span>
        <StatusPill status={member.status} />
      </div>

      <div className="mt-4 flex items-center gap-4">
        <StatusRing status={member.status} pct={minPct} />
        <div>
          <span className="eyebrow block">Sols to risk</span>
          <span className={`font-mono text-4xl font-semibold leading-none ${tone.text}`}>
            {member.status === 'CALIBRATING' ? '—' : member.sols_to_risk === null ? '∞' : member.sols_to_risk.toFixed(0)}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {keys.map((n) => {
          const meta = snapshot.nutrients[n];
          const pct = member.nutrients[n].pool_pct_of_max ?? 0;
          const thrPct = (100 * meta.risk_threshold_mg) / meta.pool_max_mg;
          return (
            <div key={n}>
              <div className="flex justify-between text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: NUTRIENT_COLOR[n] }} />{meta.label}
                </span>
                <span className="font-mono text-fg">{fmt(member.nutrients[n].pool_mg, n === 'vitamin_c' ? 0 : 1, ' mg')}</span>
              </div>
              <div className="relative mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: NUTRIENT_COLOR[n] }} />
                <div className="absolute top-0 h-full w-0.5 bg-act" style={{ left: `${thrPct}%` }} title="risk threshold" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3 text-xs">
        <span className="eyebrow">Top driver</span>
        <span className="font-mono text-soft">
          {member.top_driver ? `${VITAL_META[member.top_driver].label} z${member.driver_z !== null && member.driver_z >= 0 ? '+' : ''}${fmt(member.driver_z, 1)}` : '—'}
        </span>
      </div>
    </button>
  );
};

const AlertCard: React.FC<{ alert: CrewAlert }> = ({ alert }) => {
  const tone = TONE[STATUS_TONE[alert.status]];
  const rec = alert.recommendation;
  return (
    <article className={`well space-y-3 p-4 ${alert.status === 'ACT' ? 'border-act/40' : alert.status === 'WATCH' ? 'border-watch/30' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <StatusPill status={alert.status} />
          <span className="font-mono text-sm font-semibold text-fg">{alert.astronaut_id}</span>
          <span className="font-mono text-xs text-muted">Sol {alert.sol}</span>
        </span>
        {alert.since_sol !== null && <span className="font-mono text-[11px] text-muted">deviation since Sol {alert.since_sol}</span>}
      </div>
      <p className="text-sm leading-relaxed text-soft">{alert.message}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {alert.changes.map((c) => (
          <div key={c.signal} className="rounded-lg border border-line bg-white/[0.02] px-3 py-2">
            <span className="block truncate text-xs text-muted">{c.label}</span>
            <span className={`font-mono text-base font-semibold ${(c.pct_change_vs_baseline ?? 0) < 0 ? tone.text : 'text-fg'}`}>
              {c.pct_change_vs_baseline !== null ? `${c.pct_change_vs_baseline > 0 ? '+' : ''}${c.pct_change_vs_baseline.toFixed(0)}%` : '—'}
            </span>
            <span className="font-mono text-[11px] text-muted"> vs baseline{c.z !== null ? ` · z ${c.z.toFixed(1)}` : ''}</span>
          </div>
        ))}
      </div>
      {rec && (
        <div className="rounded-lg border border-nominal/25 bg-nominal/[0.06] px-3 py-2.5">
          <span className="eyebrow flex items-center gap-1.5 !text-nominal"><Sprout className="h-3.5 w-3.5" />What to eat</span>
          <p className="mt-1 text-sm text-fg">{alert.action}</p>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {rec.food_name}
            {rec.servings_per_sol !== null ? ` · ${rec.servings_per_sol} serving${rec.servings_per_sol === 1 ? '' : 's'}/Sol` : ''}
            {` · ${rec.nutrient_per_serving_mg} mg per serving · ${rec.source} · gap ${fmt(alert.intake_gap_mg_per_sol, 2, ' mg/Sol')}`}
          </p>
        </div>
      )}
    </article>
  );
};

// ---------------------------------------------------------------------------
// Mission timeline bar (scenario switch + Sol slider + custom scenario)
// ---------------------------------------------------------------------------
const MissionTimeline: React.FC<{ crew: CrewHealthState }> = ({ crew }) => {
  const { sol, setSol, scenario, setScenario, presets, applyPreset, snapshot, loading } = crew;
  const activePreset = snapshot?.scenario_preset ?? null;
  const ev = snapshot?.events;
  const pct = (s: number) => `${(100 * s) / (MISSION_SOLS - 1)}%`;
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <Card className="reveal">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div><Eyebrow index="02">Mission timeline</Eyebrow></div>
          {presets.length > 0 && (
            <div className="seg mt-3 flex-wrap" role="group" aria-label="Scenario">
              {presets.map((p) => (
                <button key={p.id} onClick={() => applyPreset(p)} aria-pressed={activePreset?.id === p.id} className="seg-item">
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="text-right">
            <span className="eyebrow block">Storage</span>
            <span className="inline-flex items-center gap-1 font-mono text-lg text-fg">
              <ThermometerSun className="h-4 w-4 text-muted" />{fmt(snapshot?.storage_temp_c, 1, '°C')}
            </span>
          </div>
          <div className="text-right">
            <span className="eyebrow block">Greenhouse</span>
            <span className={`inline-flex items-center gap-1 font-mono text-lg ${snapshot?.greenhouse_online === false ? 'text-watch' : 'text-fg'}`}>
              <Leaf className="h-4 w-4 text-muted" />{snapshot ? (snapshot.greenhouse_online ? 'ONLINE' : 'OFFLINE') : '—'}
            </span>
          </div>
          <div className="whitespace-nowrap text-right">
            <span className="eyebrow block">Current sol{loading ? ' …' : ''}</span>
            <span className="font-mono text-4xl font-semibold leading-none text-accent">{sol}</span>
            <span className="font-mono text-sm text-muted"> / {MISSION_SOLS - 1}</span>
          </div>
        </div>
      </div>

      {/* Track with event bands under the slider */}
      <div className="relative mt-6">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-5 -translate-y-1/2" aria-hidden>
          {ev?.greenhouse_outage && (
            <div className="absolute inset-y-0 rounded bg-white/[0.06]"
              style={{ left: pct(ev.greenhouse_outage.start_sol), width: `calc(${pct(Math.min(ev.greenhouse_outage.end_sol, MISSION_SOLS - 1))} - ${pct(ev.greenhouse_outage.start_sol)})` }} />
          )}
          {ev?.cooling_failure && (
            <div className="absolute inset-y-0 rounded bg-accent/25"
              style={{ left: pct(ev.cooling_failure.start_sol), width: `calc(${pct(ev.cooling_failure.end_sol)} - ${pct(ev.cooling_failure.start_sol)})` }} />
          )}
          <div className="absolute inset-y-0 left-0 rounded-l bg-gradient-to-r from-accent/0 to-accent/10" style={{ width: pct(sol) }} />
        </div>
        <input type="range" min={0} max={MISSION_SOLS - 1} value={sol} onChange={(e) => setSol(Number(e.target.value))}
          className="range relative h-5" aria-label="Current Sol" />
      </div>
      <div className="relative mt-1 h-4 font-mono text-[11px] text-muted" aria-hidden>
        {[0, 100, 200, 300, 400].map((s) => (
          <span key={s} className="absolute -translate-x-1/2" style={{ left: pct(s) }}>{s}</span>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 text-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted">
          <DataBadge kind="synthetic">Simulated scenario</DataBadge>
          {activePreset ? (
            <span>{activePreset.description} <span className="font-mono text-xs">({activePreset.scenario_type})</span></span>
          ) : (
            <span>Custom scenario.</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-4 rounded-sm bg-accent/40" />Cooling failure</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-4 rounded-sm bg-white/15" />Greenhouse offline</span>
          <button onClick={() => setCustomOpen((o) => !o)} aria-expanded={customOpen}
            className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.14em] text-soft hover:text-fg">
            Custom scenario <ChevronDown className={`h-3.5 w-3.5 transition-transform ${customOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Everything shown at a Sol uses only data up to that Sol.</p>

      {customOpen && (
        <div className="reveal mt-4 grid gap-5 rounded-xl border border-line bg-black/20 p-4 md:grid-cols-4">
          <div className="flex items-center justify-between gap-3 md:flex-col md:items-start">
            <span className="text-sm text-soft">Cooling failure event</span>
            <button onClick={() => setScenario({ ...scenario, failure_enabled: !scenario.failure_enabled })}
              aria-pressed={scenario.failure_enabled}
              className={scenario.failure_enabled ? 'btn-primary !py-1.5 text-xs' : 'btn-ghost !py-1.5 text-xs'}>
              {scenario.failure_enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          {([
            ['cooling_failure_sol', 'Failure starts at Sol', 30, 400, 5, ''],
            ['failure_duration_sols', 'Failure duration', 5, 150, 5, ' Sols'],
            ['failure_peak_temp_c', 'Storage peak temperature', 10, 45, 0.5, '°C'],
          ] as const).map(([key, label, min, max, step, unit]) => (
            <label key={key} className={`block ${scenario.failure_enabled ? '' : 'pointer-events-none opacity-40'}`}>
              <span className="flex justify-between text-sm">
                <span className="text-soft">{label}</span>
                <span className="font-mono font-semibold text-fg">{scenario[key]}{unit}</span>
              </span>
              <input type="range" min={min} max={max} step={step} value={scenario[key]}
                onChange={(e) => setScenario({ ...scenario, [key]: Number(e.target.value) })} className="range mt-3 h-4" />
            </label>
          ))}
          <p className="text-xs text-muted md:col-span-4">
            The same power event takes the greenhouse offline for 120 Sols and switches the crew to survival rations.
          </p>
        </div>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export const CrewHealthView: React.FC<{ crew: CrewHealthState }> = ({ crew }) => {
  const { dSol, dScenario, snapshot } = crew;
  const [selected, setSelected] = useState<string>('MS-03');
  const [vital, setVital] = useState<VitalKey>('fatigue_score');
  const [timeline, setTimeline] = useState<AstronautTimeline | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const error = crew.error ?? timelineError;

  useEffect(() => {
    let cancelled = false;
    fetchAstronautTimeline(selected, dScenario)
      .then((d) => { if (!cancelled) { setTimeline(d); setTimelineError(null); } })
      .catch((e) => { if (!cancelled) setTimelineError(String(e)); });
    return () => { cancelled = true; };
  }, [selected, dScenario]);

  const member = snapshot?.crew.find((c) => c.astronaut_id === selected) ?? null;
  const pastPoints = useMemo(() => (timeline ? timeline.timeline.filter((p) => p.sol <= dSol) : []), [timeline, dSol]);

  const poolChart = (n: NutrientKey) => {
    if (!timeline) return null;
    const meta = timeline.nutrients[n];
    const pts: Array<[number, number]> = pastPoints.map((p) => [p.sol, n === 'vitamin_c' ? p.vitamin_c_pool_mg : p.thiamine_b1_pool_mg]);
    const series: Series[] = [{ points: pts, color: NUTRIENT_COLOR[n], label: 'pool' }];
    const f = member?.nutrients[n];
    if (f && f.pool_mg !== null && f.equilibrium_pool_mg !== null && f.personal_turnover_per_sol) {
      const k = f.personal_turnover_per_sol;
      const fc: Array<[number, number]> = [];
      for (let t = 0; t <= FORECAST_HORIZON && dSol + t < MISSION_SOLS; t += 2) {
        const v = f.equilibrium_pool_mg + (f.pool_mg - f.equilibrium_pool_mg) * Math.exp(-k * t);
        fc.push([dSol + t, Math.min(meta.pool_max_mg, v)]);
      }
      series.push({ points: fc, color: C.forecast, label: 'forecast', dashed: true, opacity: 0.75 });
    }
    const markers: ChartProps['markers'] = [];
    const act = timeline.first_act_sol;
    if (act !== null && act <= dSol) {
      const p = timeline.timeline[act];
      markers.push({ x: act, y: n === 'vitamin_c' ? p.vitamin_c_pool_mg : p.thiamine_b1_pool_mg, color: C.act, label: `ACT Sol ${act}` });
    }
    const cross = timeline.threshold_crossing_sol[n];
    if (cross !== null && cross <= dSol) {
      markers.push({ x: cross, y: meta.risk_threshold_mg, color: C.act, label: `crossed Sol ${cross}` });
    }
    const legend: LegendItem[] = [
      { kind: 'line', color: NUTRIENT_COLOR[n], label: 'Body pool (simulated)' },
      { kind: 'dash', color: C.forecast, label: 'Forecast' },
      { kind: 'threshold', color: C.act, label: 'Risk threshold' },
      ...(timeline.events.cooling_failure ? [{ kind: 'event' as const, color: C.accent, label: 'Cooling failure' }] : []),
      ...(timeline.events.greenhouse_outage ? [{ kind: 'event' as const, color: '#FFFFFF', label: 'Greenhouse offline' }] : []),
      ...(markers.length ? [{ kind: 'dot' as const, color: C.act, label: 'ACT / threshold crossing' }] : []),
    ];
    return (
      <SvgLineChart
        title={`${meta.label} body pool`}
        subtitle={f ? `k = ${fmt(f.personal_turnover_per_sol, 4)}/Sol · ${f.sols_to_risk === null ? 'no crossing forecast' : `${f.sols_to_risk.toFixed(0)} Sols to risk`}` : undefined}
        series={series}
        yMin={0}
        yMax={meta.pool_max_mg}
        yTitle="Body pool"
        yUnit="mg"
        yDigits={n === 'vitamin_c' ? 0 : 1}
        events={timeline.events}
        nowSol={dSol}
        threshold={{ y: meta.risk_threshold_mg, label: `risk ${Number(meta.risk_threshold_mg.toPrecision(3))} mg` }}
        markers={markers}
        legend={legend}
      />
    );
  };

  const vitalsChart = () => {
    if (!timeline) return null;
    const b = timeline.baseline[vital];
    const vals = timeline.timeline.map((p) => p[vital]);
    const lo = Math.min(b.band_low, ...vals);
    const hi = Math.max(b.band_high, ...vals);
    const pad = (hi - lo) * 0.08;
    const meta = VITAL_META[vital];
    return (
      <SvgLineChart
        title={`${meta.label} vs personal baseline`}
        subtitle="Baseline = mean ± 2 SD over Sols 0–20"
        series={[{ points: pastPoints.map((p) => [p.sol, p[vital]]), color: C.series1, label: meta.label.toLowerCase() }]}
        yMin={lo - pad}
        yMax={hi + pad}
        yTitle={meta.label}
        yUnit={meta.unit}
        yDigits={meta.digits}
        events={timeline.events}
        nowSol={dSol}
        yBand={{ y0: b.band_low, y1: b.band_high, mean: b.mean, label: 'personal baseline ±2σ' }}
        width={1180}
        legend={[
          { kind: 'line', color: C.series1, label: `${meta.label} (simulated)` },
          { kind: 'band', color: C.band, label: 'Personal baseline ±2σ' },
          ...(timeline.events.cooling_failure ? [{ kind: 'event' as const, color: C.accent, label: 'Cooling failure' }] : []),
        ]}
      />
    );
  };

  const alerts = snapshot ? [...snapshot.active_alerts].sort((a, b) => b.sol - a.sol) : [];

  return (
    <div>
      <Hero
        index="01"
        label="Crew Health"
        lines={['Monitor. Predict.', 'Protect.']}
        subtitle="Daily check-ins + food-driven vitamin forecasts for every crew member."
        planet="mars"
        meta={snapshot && <span className="hidden sm:inline-flex"><StatusPill status={snapshot.crew_status} label={`System status · ${snapshot.crew_status}`} /></span>}
      >
        <DataBadge kind="synthetic">Simulated scenario</DataBadge>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Decision-support prototype, not a medical device</span>
      </Hero>

      <div className="mt-6 space-y-4 lg:space-y-5">
        {error && <ErrorNote>{error}</ErrorNote>}

        <MissionTimeline crew={crew} />

        {/* Crew cards */}
        <section aria-labelledby="crew-head">
          <div className="mb-3 mt-2 flex items-end justify-between gap-3">
            <h2 id="crew-head"><Eyebrow index="03">Crew · select an astronaut</Eyebrow></h2>
            {snapshot && (
              <span className="hidden font-mono text-[11px] text-muted sm:block">
                {(['ACT', 'WATCH', 'NOMINAL'] as CrewStatus[]).map((s) => `${snapshot.status_counts[s] ?? 0} ${s}`).join(' · ')}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {snapshot?.crew.map((m) => (
              <AstronautCard key={m.astronaut_id} member={m} snapshot={snapshot} selected={m.astronaut_id === selected}
                onSelect={() => setSelected(m.astronaut_id)} />
            ))}
          </div>
        </section>

        <DailyCheckinPanel index="04" />

        {/* Selected astronaut charts */}
        <Card className="space-y-5">
          <SectionHead
            index="05"
            label="Vitamin forecast"
            title={<>{selected} <span className="text-muted">— physiological timeline</span></>}
            right={member && <StatusPill status={member.status} size="md" />}
          />
          <p className="-mt-2 font-mono text-xs text-muted">
            First WATCH: {timeline?.first_watch_sol ?? '—'} · First ACT: {timeline?.first_act_sol ?? '—'} · anomaly score (IsolationForest): {fmt(member?.anomaly_score, 2)}
          </p>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {poolChart('vitamin_c')}
            {poolChart('thiamine_b1')}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="eyebrow">Vital sign vs personal baseline</span>
            <div className="seg flex-wrap" role="group" aria-label="Vital sign">
              {(Object.keys(VITAL_META) as VitalKey[]).map((v) => (
                <button key={v} onClick={() => setVital(v)} aria-pressed={vital === v} className="seg-item">
                  {VITAL_META[v].label}
                  {member?.z_scores[v] !== null && member?.z_scores[v] !== undefined && (
                    <span className="ml-1 font-mono opacity-80">z{member.z_scores[v]! >= 0 ? '+' : ''}{member.z_scores[v]!.toFixed(1)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          {vitalsChart()}

          {member?.assessment && (
            <div className="space-y-2">
              <Eyebrow>Current assessment · Sol {dSol}</Eyebrow>
              <AlertCard alert={member.assessment} />
            </div>
          )}
        </Card>

        {/* Alerts */}
        <Card className="space-y-4">
          <SectionHead
            index="06"
            label="Early-warning alerts"
            title={<>Alerts up to Sol {dSol} <span className="font-mono text-muted">({alerts.length})</span></>}
          />
          {snapshot && (
            <div className="grid gap-2 rounded-xl border border-line p-3 text-sm md:grid-cols-3">
              <span className="flex items-center gap-1.5 text-muted md:col-span-3"><Info className="h-3.5 w-3.5" /><span className="eyebrow">Status rules</span></span>
              {(['ACT', 'WATCH', 'NOMINAL'] as CrewStatus[]).map((s) => (
                <div key={s} className="flex items-start gap-2">
                  <span className="shrink-0"><StatusPill status={s} /></span>
                  <span className="text-xs text-muted">{snapshot.status_rules[s]}</span>
                </div>
              ))}
            </div>
          )}
          {alerts.length === 0 ? (
            <p className="text-sm text-muted">No alerts raised yet — all astronauts within their personal baseline.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {alerts.map((a) => <AlertCard key={`${a.astronaut_id}-${a.sol}-${a.status}`} alert={a} />)}
            </div>
          )}
        </Card>

        {snapshot && (
          <p className="border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-muted">
            <span className="text-soft">Data provenance · </span>{snapshot.data_provenance}. Decision-support prototype, not a medical device.
          </p>
        )}
      </div>
    </div>
  );
};
