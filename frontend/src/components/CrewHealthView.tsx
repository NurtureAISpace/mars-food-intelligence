import React, { useEffect, useMemo, useState } from 'react';
import { fetchCrewHealth, fetchAstronautTimeline } from '../api';
import {
  AstronautTimeline,
  CrewAlert,
  CrewEvents,
  CrewHealthScenario,
  CrewHealthSnapshot,
  CrewMemberStatus,
  CrewStatus,
  NutrientKey,
  VitalKey,
} from '../types';
import { HeartPulse, AlertTriangle, FlaskConical, ThermometerSun, Sprout, UserRound, Activity, Info } from 'lucide-react';

const MISSION_SOLS = 450;
const FORECAST_HORIZON = 120;

const STATUS_STYLE: Record<CrewStatus, { text: string; bg: string; border: string; dot: string }> = {
  CALIBRATING: { text: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-500/30', dot: 'bg-slate-400' },
  NOMINAL: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  WATCH: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', dot: 'bg-amber-400' },
  ACT: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', dot: 'bg-red-500' },
};

const NUTRIENT_COLOR: Record<NutrientKey, string> = { vitamin_c: '#06b6d4', thiamine_b1: '#a78bfa' };

const VITAL_META: Record<VitalKey, { label: string; unit: string; digits: number }> = {
  hr_rest: { label: 'Resting HR', unit: 'bpm', digits: 0 },
  sleep_h: { label: 'Sleep', unit: 'h', digits: 1 },
  body_mass_kg: { label: 'Body Mass', unit: 'kg', digits: 1 },
  fatigue_score: { label: 'Fatigue', unit: '/10', digits: 1 },
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

const fmt = (x: number | null | undefined, digits = 0, suffix = '') =>
  x === null || x === undefined ? '—' : `${x.toFixed(digits)}${suffix}`;

// ---------------------------------------------------------------------------
// Minimal SVG line chart (same visual language as the other views)
// ---------------------------------------------------------------------------
interface Series { points: Array<[number, number]>; color: string; width?: number; dashed?: boolean; opacity?: number }
interface ChartProps {
  title: string;
  subtitle?: string;
  series: Series[];
  yMin: number;
  yMax: number;
  yUnit: string;
  yDigits?: number;
  events: CrewEvents | null;
  nowSol: number;
  threshold?: { y: number; label: string };
  yBand?: { y0: number; y1: number; mean: number; label: string };
  markers?: Array<{ x: number; y: number; color: string; label: string }>;
}

const W = 700;
const H = 230;
const PAD_L = 52;
const PAD_R = 16;
const PAD_T = 22;
const PAD_B = 30;

const SvgLineChart: React.FC<ChartProps> = ({
  title, subtitle, series, yMin, yMax, yUnit, yDigits = 0, events, nowSol, threshold, yBand, markers = [],
}) => {
  const sx = (sol: number) => PAD_L + (sol / (MISSION_SOLS - 1)) * (W - PAD_L - PAD_R);
  const span = yMax - yMin || 1;
  const sy = (v: number) => H - PAD_B - ((Math.min(Math.max(v, yMin), yMax) - yMin) / span) * (H - PAD_T - PAD_B);
  const path = (pts: Array<[number, number]>) =>
    pts.reduce((acc, [x, y], i) => `${acc}${i === 0 ? 'M' : ' L'} ${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`, '');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * span);

  return (
    <div className="bg-mars-dark/90 rounded-lg p-3 border border-mars-border">
      <div className="flex items-baseline justify-between mb-1 font-mono">
        <span className="text-xs font-bold text-white uppercase">{title}</span>
        {subtitle && <span className="text-[10px] text-slate-400">{subtitle}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Event bands */}
        {events?.greenhouse_outage && (
          <rect x={sx(events.greenhouse_outage.start_sol)} y={PAD_T}
            width={sx(events.greenhouse_outage.end_sol) - sx(events.greenhouse_outage.start_sol)}
            height={H - PAD_T - PAD_B} fill="#10b981" opacity={0.06} />
        )}
        {events?.cooling_failure && (
          <g>
            <rect x={sx(events.cooling_failure.start_sol)} y={PAD_T}
              width={sx(events.cooling_failure.end_sol) - sx(events.cooling_failure.start_sol)}
              height={H - PAD_T - PAD_B} fill="#f97316" opacity={0.13} />
            <line x1={sx(events.cooling_failure.start_sol)} y1={PAD_T} x2={sx(events.cooling_failure.start_sol)} y2={H - PAD_B}
              stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x={sx(events.cooling_failure.start_sol) + 4} y={PAD_T + 10} fill="#fdba74" fontSize="9" fontFamily="monospace">
              COOLING FAILURE {events.cooling_failure.peak_temp_c}°C
            </text>
          </g>
        )}

        {/* Grid */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={sy(v)} x2={W - PAD_R} y2={sy(v)} stroke="#1f2e4d" strokeDasharray="3 3" />
            <text x={PAD_L - 6} y={sy(v) + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
              {v.toFixed(yDigits)}
            </text>
          </g>
        ))}
        {[0, 100, 200, 300, 400].map((s) => (
          <text key={s} x={sx(s)} y={H - PAD_B + 14} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
            Sol {s}
          </text>
        ))}
        <text x={8} y={PAD_T - 8} fill="#64748b" fontSize="9" fontFamily="monospace">{yUnit}</text>

        {/* Personal baseline band */}
        {yBand && (
          <g>
            <rect x={PAD_L} y={sy(yBand.y1)} width={W - PAD_L - PAD_R} height={Math.max(1, sy(yBand.y0) - sy(yBand.y1))}
              fill="#10b981" opacity={0.12} />
            <line x1={PAD_L} y1={sy(yBand.mean)} x2={W - PAD_R} y2={sy(yBand.mean)} stroke="#10b981" strokeWidth="1" strokeDasharray="2 3" />
            <text x={W - PAD_R - 4} y={sy(yBand.y1) - 4} textAnchor="end" fill="#6ee7b7" fontSize="9" fontFamily="monospace">
              {yBand.label}
            </text>
          </g>
        )}

        {/* Risk threshold */}
        {threshold && (
          <g>
            <line x1={PAD_L} y1={sy(threshold.y)} x2={W - PAD_R} y2={sy(threshold.y)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={W - PAD_R - 4} y={sy(threshold.y) - 4} textAnchor="end" fill="#fca5a5" fontSize="9" fontFamily="monospace">
              {threshold.label}
            </text>
          </g>
        )}

        {series.map((s, i) =>
          s.points.length > 1 ? (
            <path key={i} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={s.width ?? 2}
              strokeDasharray={s.dashed ? '5 4' : undefined} opacity={s.opacity ?? 1} strokeLinejoin="round" />
          ) : null
        )}

        {markers.map((m, i) => (
          <g key={i}>
            <circle cx={sx(m.x)} cy={sy(m.y)} r="4.5" fill={m.color} stroke="#fff" strokeWidth="1.5" />
            <text x={sx(m.x) + 7} y={sy(m.y) + 12} fill={m.color} fontSize="9" fontWeight="bold" fontFamily="monospace">{m.label}</text>
          </g>
        ))}

        {/* Current Sol cursor */}
        <line x1={sx(nowSol)} y1={PAD_T} x2={sx(nowSol)} y2={H - PAD_B} stroke="#e2e8f0" strokeWidth="1" opacity={0.6} />
        <text x={sx(nowSol)} y={PAD_T - 6} textAnchor="middle" fill="#e2e8f0" fontSize="9" fontFamily="monospace">SOL {nowSol}</text>
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const StatusPill: React.FC<{ status: CrewStatus }> = ({ status }) => {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${s.bg} ${s.border} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'ACT' ? 'animate-pulse' : ''}`} />
      <span>{status}</span>
    </span>
  );
};

const AstronautCard: React.FC<{
  member: CrewMemberStatus;
  snapshot: CrewHealthSnapshot;
  selected: boolean;
  onSelect: () => void;
}> = ({ member, snapshot, selected, onSelect }) => {
  const s = STATUS_STYLE[member.status];
  return (
    <button
      onClick={onSelect}
      className={`text-left p-4 rounded-xl border transition-all font-mono ${s.bg} ${
        selected ? 'border-orange-500 ring-1 ring-orange-500/60' : `${s.border} hover:border-orange-400/60`
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center space-x-2 text-white font-bold text-sm">
          <UserRound className="w-4 h-4 text-slate-400" />
          <span>{member.astronaut_id}</span>
        </span>
        <StatusPill status={member.status} />
      </div>
      <div className="mt-3 space-y-2">
        {(Object.keys(snapshot.nutrients) as NutrientKey[]).map((n) => {
          const meta = snapshot.nutrients[n];
          const pct = member.nutrients[n].pool_pct_of_max ?? 0;
          const thrPct = (100 * meta.risk_threshold_mg) / meta.pool_max_mg;
          return (
            <div key={n}>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{meta.label} pool</span>
                <span className="text-slate-200">{fmt(member.nutrients[n].pool_mg, n === 'vitamin_c' ? 0 : 1, ' mg')}</span>
              </div>
              <div className="relative h-1.5 bg-mars-dark rounded mt-0.5 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${Math.min(100, pct)}%`, background: NUTRIENT_COLOR[n] }} />
                <div className="absolute top-0 h-full w-px bg-red-500" style={{ left: `${thrPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-slate-500 block">SOLS TO RISK</span>
          <span className={`text-sm font-bold ${s.text}`}>
            {member.status === 'CALIBRATING' ? '—' : member.sols_to_risk === null ? '∞' : member.sols_to_risk.toFixed(0)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">TOP DRIVER</span>
          <span className="text-slate-200">
            {member.top_driver ? `${VITAL_META[member.top_driver].label} z${member.driver_z !== null && member.driver_z >= 0 ? '+' : ''}${fmt(member.driver_z, 1)}` : '—'}
          </span>
        </div>
      </div>
    </button>
  );
};

const AlertCard: React.FC<{ alert: CrewAlert }> = ({ alert }) => (
  <div className={`p-3 rounded-lg border font-mono text-xs space-y-2 ${STATUS_STYLE[alert.status].bg} ${STATUS_STYLE[alert.status].border}`}>
    <div className="flex items-center justify-between">
      <span className="flex items-center space-x-2">
        <StatusPill status={alert.status} />
        <span className="text-white font-bold">{alert.astronaut_id}</span>
        <span className="text-slate-400">Sol {alert.sol}</span>
      </span>
      {alert.since_sol !== null && <span className="text-[10px] text-slate-400">deviation since Sol {alert.since_sol}</span>}
    </div>
    <p className="text-slate-200 leading-relaxed">{alert.message}</p>
    <div className="grid grid-cols-3 gap-2 text-[10px]">
      {alert.changes.map((c) => (
        <div key={c.signal} className="bg-mars-dark/70 rounded p-1.5 border border-mars-border">
          <span className="text-slate-500 block truncate">{c.label}</span>
          <span className={(c.pct_change_vs_baseline ?? 0) < 0 ? 'text-red-300' : 'text-amber-300'}>
            {c.pct_change_vs_baseline !== null ? `${c.pct_change_vs_baseline > 0 ? '+' : ''}${c.pct_change_vs_baseline.toFixed(0)}%` : '—'}
          </span>
          <span className="text-slate-500"> vs baseline{c.z !== null ? ` · z ${c.z.toFixed(1)}` : ''}</span>
        </div>
      ))}
    </div>
    {alert.recommendation && (
      <div className="flex items-start space-x-2 text-[11px] text-emerald-300">
        <Sprout className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          {alert.action}
          <span className="text-slate-500"> — {alert.recommendation.source}; gap {fmt(alert.intake_gap_mg_per_sol, 2, ' mg/Sol')}</span>
        </span>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export const CrewHealthView: React.FC = () => {
  const [sol, setSol] = useState<number>(200);
  const [scenario, setScenario] = useState<CrewHealthScenario>({
    failure_enabled: true,
    cooling_failure_sol: 150,
    failure_duration_sols: 45,
    failure_peak_temp_c: 29.5,
  });
  const [selected, setSelected] = useState<string>('MS-03');
  const [vital, setVital] = useState<VitalKey>('fatigue_score');
  const [snapshot, setSnapshot] = useState<CrewHealthSnapshot | null>(null);
  const [timeline, setTimeline] = useState<AstronautTimeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  useEffect(() => {
    let cancelled = false;
    fetchAstronautTimeline(selected, dScenario)
      .then((d) => { if (!cancelled) setTimeline(d); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [selected, dScenario]);

  const member = snapshot?.crew.find((c) => c.astronaut_id === selected) ?? null;
  const pastPoints = useMemo(() => (timeline ? timeline.timeline.filter((p) => p.sol <= dSol) : []), [timeline, dSol]);

  const poolChart = (n: NutrientKey) => {
    if (!timeline) return null;
    const meta = timeline.nutrients[n];
    const pts: Array<[number, number]> = pastPoints.map((p) => [p.sol, n === 'vitamin_c' ? p.vitamin_c_pool_mg : p.thiamine_b1_pool_mg]);
    const series: Series[] = [{ points: pts, color: NUTRIENT_COLOR[n], width: 2.5 }];
    const f = member?.nutrients[n];
    if (f && f.pool_mg !== null && f.equilibrium_pool_mg !== null && f.personal_turnover_per_sol) {
      const k = f.personal_turnover_per_sol;
      const fc: Array<[number, number]> = [];
      for (let t = 0; t <= FORECAST_HORIZON && dSol + t < MISSION_SOLS; t += 2) {
        const v = f.equilibrium_pool_mg + (f.pool_mg - f.equilibrium_pool_mg) * Math.exp(-k * t);
        fc.push([dSol + t, Math.min(meta.pool_max_mg, v)]);
      }
      series.push({ points: fc, color: '#f8fafc', width: 1.5, dashed: true, opacity: 0.7 });
    }
    const markers: ChartProps['markers'] = [];
    const act = timeline.first_act_sol;
    if (act !== null && act <= dSol) {
      const p = timeline.timeline[act];
      markers.push({ x: act, y: n === 'vitamin_c' ? p.vitamin_c_pool_mg : p.thiamine_b1_pool_mg, color: '#f87171', label: `ACT Sol ${act}` });
    }
    const cross = timeline.threshold_crossing_sol[n];
    if (cross !== null && cross <= dSol) {
      markers.push({ x: cross, y: meta.risk_threshold_mg, color: '#fca5a5', label: `crossed Sol ${cross}` });
    }
    return (
      <SvgLineChart
        title={`${meta.label} body pool`}
        subtitle={f ? `k=${fmt(f.personal_turnover_per_sol, 4)}/Sol · ${f.sols_to_risk === null ? 'no crossing forecast' : `${f.sols_to_risk.toFixed(0)} Sols to risk`} · dashed = forecast` : undefined}
        series={series}
        yMin={0}
        yMax={meta.pool_max_mg}
        yUnit="mg"
        yDigits={n === 'vitamin_c' ? 0 : 1}
        events={timeline.events}
        nowSol={dSol}
        threshold={{ y: meta.risk_threshold_mg, label: `risk threshold ${meta.risk_threshold_mg} mg` }}
        markers={markers}
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
    return (
      <SvgLineChart
        title={`${VITAL_META[vital].label} vs personal baseline`}
        subtitle="green band = baseline mean ± 2 SD (Sols 0–20)"
        series={[{ points: pastPoints.map((p) => [p.sol, p[vital]]), color: '#f59e0b', width: 1.5 }]}
        yMin={lo - pad}
        yMax={hi + pad}
        yUnit={VITAL_META[vital].unit}
        yDigits={VITAL_META[vital].digits}
        events={timeline.events}
        nowSol={dSol}
        yBand={{ y0: b.band_low, y1: b.band_high, mean: b.mean, label: 'personal baseline ±2σ' }}
      />
    );
  };

  const alerts = snapshot ? [...snapshot.active_alerts].sort((a, b) => b.sol - a.sol) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <HeartPulse className="w-5 h-5 text-orange-400" />
            <h2 className="text-xl font-bold font-mono text-white">CREW HEALTH MONITOR</h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Food vitamin degradation → body vitamin pool → deviation from personal baseline → explainable early warning → corrective action.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded border border-amber-500/50 bg-amber-500/10 text-amber-300 text-[11px] font-mono font-bold uppercase">
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Synthetic data</span>
          </span>
          {snapshot && <StatusPill status={snapshot.crew_status} />}
        </div>
      </div>
      {snapshot && (
        <p className="text-[10px] font-mono text-slate-500 -mt-4">Data provenance: {snapshot.data_provenance}. Prototype, not a medical device.</p>
      )}
      {error && (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs font-mono">Backend error: {error}</div>
      )}

      {/* Astronaut status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {snapshot?.crew.map((m) => (
          <AstronautCard key={m.astronaut_id} member={m} snapshot={snapshot} selected={m.astronaut_id === selected}
            onSelect={() => setSelected(m.astronaut_id)} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="glass-panel rounded-xl p-5 border border-mars-border space-y-5 font-mono text-xs">
          <h3 className="font-bold text-white text-sm border-b border-mars-border pb-3 uppercase">Mission Timeline & Scenario</h3>

          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-slate-300">Current Sol:</span>
              <span className="text-orange-400 font-bold">SOL {sol}{loading ? ' …' : ''}</span>
            </div>
            <input type="range" min={0} max={MISSION_SOLS - 1} value={sol} onChange={(e) => setSol(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer" />
            <p className="text-[10px] text-slate-500 mt-1">Everything shown at a Sol uses only data up to that Sol.</p>
          </div>

          <div className="flex items-center justify-between border-t border-mars-border pt-4">
            <span className="flex items-center space-x-2 text-slate-300">
              <ThermometerSun className="w-4 h-4 text-orange-400" />
              <span>Cooling failure event</span>
            </span>
            <button
              onClick={() => setScenario({ ...scenario, failure_enabled: !scenario.failure_enabled })}
              className={`px-3 py-1 rounded border font-bold ${scenario.failure_enabled
                ? 'bg-orange-500/20 border-orange-500/50 text-orange-300' : 'bg-mars-dark border-mars-border text-slate-400'}`}
            >
              {scenario.failure_enabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          <div className={scenario.failure_enabled ? '' : 'opacity-40 pointer-events-none'}>
            {([
              ['cooling_failure_sol', 'Failure starts at Sol', 30, 400, 5, ''],
              ['failure_duration_sols', 'Failure duration', 5, 150, 5, ' Sols'],
              ['failure_peak_temp_c', 'Storage peak temperature', 10, 45, 0.5, '°C'],
            ] as const).map(([key, label, min, max, step, unit]) => (
              <div key={key} className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-slate-300">{label}:</span>
                  <span className="text-white font-bold">{scenario[key]}{unit}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={scenario[key]}
                  onChange={(e) => setScenario({ ...scenario, [key]: Number(e.target.value) })}
                  className="w-full accent-orange-500 cursor-pointer" />
              </div>
            ))}
            <p className="text-[10px] text-slate-500">
              The same power event takes the greenhouse offline for 120 Sols and switches the crew to survival rations.
            </p>
          </div>

          {snapshot && (
            <div className="p-3 rounded-lg bg-mars-dark border border-mars-border space-y-1.5">
              <span className="text-orange-400 font-bold uppercase text-[11px] flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5" /><span>Status rules</span>
              </span>
              {(['ACT', 'WATCH', 'NOMINAL'] as CrewStatus[]).map((s) => (
                <div key={s} className="flex items-start space-x-2 text-[10px]">
                  <span className={`w-14 shrink-0 font-bold ${STATUS_STYLE[s].text}`}>{s}</span>
                  <span className="text-slate-400">{snapshot.status_rules[s]}</span>
                </div>
              ))}
              <div className="flex justify-between text-[10px] pt-1 border-t border-mars-border text-slate-400">
                <span>Storage {fmt(snapshot.storage_temp_c, 1, '°C')}</span>
                <span>Greenhouse {snapshot.greenhouse_online ? 'ONLINE' : 'OFFLINE'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Selected astronaut charts */}
        <div className="glass-panel rounded-xl p-5 border border-mars-border lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-mars-border pb-3 gap-2 font-mono">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" /><span>{selected} — PHYSIOLOGICAL TIMELINE</span>
              </h3>
              <p className="text-[10px] text-slate-400">
                First WATCH: {timeline?.first_watch_sol ?? '—'} · First ACT: {timeline?.first_act_sol ?? '—'} · anomaly score (IsolationForest): {fmt(member?.anomaly_score, 2)}
              </p>
            </div>
            {member && <StatusPill status={member.status} />}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {poolChart('vitamin_c')}
            {poolChart('thiamine_b1')}
          </div>

          <div className="flex flex-wrap gap-1.5 font-mono">
            {(Object.keys(VITAL_META) as VitalKey[]).map((v) => (
              <button key={v} onClick={() => setVital(v)}
                className={`px-2.5 py-1 rounded text-[11px] ${vital === v ? 'bg-orange-500 text-white' : 'bg-mars-dark border border-mars-border text-slate-300 hover:text-white'}`}>
                {VITAL_META[v].label}
                {member?.z_scores[v] !== null && member?.z_scores[v] !== undefined && (
                  <span className="opacity-70"> z{member.z_scores[v]! >= 0 ? '+' : ''}{member.z_scores[v]!.toFixed(1)}</span>
                )}
              </button>
            ))}
          </div>
          {vitalsChart()}

          {member?.assessment && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-orange-400 uppercase">Current assessment (Sol {dSol})</span>
              <AlertCard alert={member.assessment} />
            </div>
          )}
        </div>
      </div>

      {/* Alert list */}
      <div className="glass-panel rounded-xl p-5 border border-mars-border space-y-3">
        <h3 className="font-mono font-bold text-white text-sm uppercase flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Early-warning alerts up to Sol {dSol} ({alerts.length})</span>
        </h3>
        {alerts.length === 0 ? (
          <p className="text-xs font-mono text-slate-500">No alerts raised yet — all astronauts within their personal baseline.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {alerts.map((a) => <AlertCard key={`${a.astronaut_id}-${a.sol}-${a.status}`} alert={a} />)}
          </div>
        )}
      </div>
    </div>
  );
};
