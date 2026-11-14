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
import {
  HeartPulse,
  AlertTriangle,
  FlaskConical,
  ThermometerSun,
  Sprout,
  UserRound,
  Activity,
  Info,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Inspiration4Panel } from './Inspiration4Panel';

const MISSION_SOLS = 450;
const FORECAST_HORIZON = 120;

const STATUS_STYLE: Record<CrewStatus, { text: string; bg: string; border: string; dot: string; glow: string }> = {
  CALIBRATING: {
    text: 'text-slate-300',
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/40',
    dot: 'bg-slate-400',
    glow: 'shadow-slate-500/10'
  },
  NOMINAL: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    dot: 'bg-emerald-400',
    glow: 'shadow-emerald-500/20'
  },
  WATCH: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/50',
    dot: 'bg-amber-400',
    glow: 'shadow-amber-500/20'
  },
  ACT: {
    text: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/60',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/30'
  },
};

const NUTRIENT_COLOR: Record<NutrientKey, string> = {
  vitamin_c: '#22d3ee', // high-contrast cyan
  thiamine_b1: '#a78bfa', // electric purple
};

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
// High-Contrast SVG Line Chart (Optimized for 1080p Projector & Remote Viewing)
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
const H = 240;
const PAD_L = 58;
const PAD_R = 18;
const PAD_T = 24;
const PAD_B = 32;

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
    <div className="bg-mars-void/90 rounded-xl p-3.5 border border-white/10 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2 font-mono gap-1">
        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          <span>{title}</span>
        </span>
        {subtitle && <span className="text-[10px] text-slate-300">{subtitle}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Greenhouse Outage Band */}
        {events?.greenhouse_outage && (
          <rect
            x={sx(events.greenhouse_outage.start_sol)}
            y={PAD_T}
            width={sx(events.greenhouse_outage.end_sol) - sx(events.greenhouse_outage.start_sol)}
            height={H - PAD_T - PAD_B}
            fill="#10b981"
            opacity={0.08}
          />
        )}

        {/* Cooling Failure Event Band */}
        {events?.cooling_failure && (
          <g>
            <rect
              x={sx(events.cooling_failure.start_sol)}
              y={PAD_T}
              width={sx(events.cooling_failure.end_sol) - sx(events.cooling_failure.start_sol)}
              height={H - PAD_T - PAD_B}
              fill="#f97316"
              opacity={0.18}
            />
            <line
              x1={sx(events.cooling_failure.start_sol)}
              y1={PAD_T}
              x2={sx(events.cooling_failure.start_sol)}
              y2={H - PAD_B}
              stroke="#f97316"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <text
              x={sx(events.cooling_failure.start_sol) + 5}
              y={PAD_T + 12}
              fill="#ffedd5"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
            >
              COOLING MALFUNCTION {events.cooling_failure.peak_temp_c}°C
            </text>
          </g>
        )}

        {/* High-Contrast Horizontal Grid Lines & Y Ticks */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={sy(v)} x2={W - PAD_R} y2={sy(v)} stroke="#1e2d4a" strokeDasharray="3 3" />
            <text x={PAD_L - 8} y={sy(v) + 3} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace" fontWeight="600">
              {v.toFixed(yDigits)}
            </text>
          </g>
        ))}

        {/* X Ticks (Projector-Proof Contrast) */}
        {[0, 100, 200, 300, 400].map((s) => (
          <text key={s} x={sx(s)} y={H - PAD_B + 16} textAnchor="middle" fill="#cbd5e1" fontSize="10" fontFamily="monospace" fontWeight="600">
            Sol {s}
          </text>
        ))}
        <text x={10} y={PAD_T - 8} fill="#cbd5e1" fontSize="10" fontWeight="bold" fontFamily="monospace">{yUnit}</text>

        {/* Personal Baseline Band */}
        {yBand && (
          <g>
            <rect
              x={PAD_L}
              y={sy(yBand.y1)}
              width={W - PAD_L - PAD_R}
              height={Math.max(1, sy(yBand.y0) - sy(yBand.y1))}
              fill="#10b981"
              opacity={0.16}
            />
            <line x1={PAD_L} y1={sy(yBand.mean)} x2={W - PAD_R} y2={sy(yBand.mean)} stroke="#34d399" strokeWidth="1.2" strokeDasharray="3 3" />
            <text x={W - PAD_R - 4} y={sy(yBand.y1) - 6} textAnchor="end" fill="#6ee7b7" fontSize="10" fontWeight="bold" fontFamily="monospace">
              {yBand.label}
            </text>
          </g>
        )}

        {/* Risk Threshold Line (Bold Red) */}
        {threshold && (
          <g>
            <line x1={PAD_L} y1={sy(threshold.y)} x2={W - PAD_R} y2={sy(threshold.y)} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" />
            <text x={W - PAD_R - 4} y={sy(threshold.y) - 6} textAnchor="end" fill="#fca5a5" fontSize="10" fontWeight="bold" fontFamily="monospace">
              CRITICAL LIMIT: {threshold.label}
            </text>
          </g>
        )}

        {/* Plotted Series Paths */}
        {series.map((s, i) =>
          s.points.length > 1 ? (
            <path
              key={i}
              d={path(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2.5}
              strokeDasharray={s.dashed ? '6 4' : undefined}
              opacity={s.opacity ?? 1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null
        )}

        {/* Milestone Markers */}
        {markers.map((m, i) => (
          <g key={i}>
            <circle cx={sx(m.x)} cy={sy(m.y)} r="5.5" fill={m.color} stroke="#ffffff" strokeWidth="2" />
            <text x={sx(m.x) + 8} y={sy(m.y) + 13} fill={m.color} fontSize="10" fontWeight="bold" fontFamily="monospace">
              {m.label}
            </text>
          </g>
        ))}

        {/* Current Sol Scrubber Line */}
        <line x1={sx(nowSol)} y1={PAD_T} x2={sx(nowSol)} y2={H - PAD_B} stroke="#ffffff" strokeWidth="1.5" opacity={0.8} />
        <rect x={sx(nowSol) - 26} y={PAD_T - 18} width="52" height="15" rx="3" fill="#ff6b18" />
        <text x={sx(nowSol)} y={PAD_T - 7} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">
          SOL {nowSol}
        </text>
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Status Pill & Astronaut Card Components
// ---------------------------------------------------------------------------
const StatusPill: React.FC<{ status: CrewStatus }> = ({ status }) => {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold ${s.bg} ${s.border} ${s.text} shadow-sm ${s.glow}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot} ${status === 'ACT' ? 'animate-ping' : ''}`} />
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
      className={`text-left p-4 rounded-2xl border transition-all font-mono relative overflow-hidden ${
        selected
          ? 'bg-gradient-to-b from-orange-500/20 via-mars-card to-mars-card border-orange-500 ring-2 ring-orange-500/50 shadow-xl shadow-orange-500/10'
          : `${s.bg} ${s.border} hover:border-orange-400/70 hover:scale-[1.01]`
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center space-x-2 text-white font-bold text-sm">
          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
            <UserRound className="w-3.5 h-3.5 text-slate-300" />
          </div>
          <span>{member.astronaut_id}</span>
        </span>
        <StatusPill status={member.status} />
      </div>

      {/* Dual Vitamin Pool Meters */}
      <div className="mt-3.5 space-y-2.5">
        {(Object.keys(snapshot.nutrients) as NutrientKey[]).map((n) => {
          const meta = snapshot.nutrients[n];
          const pct = member.nutrients[n].pool_pct_of_max ?? 0;
          const thrPct = (100 * meta.risk_threshold_mg) / meta.pool_max_mg;
          return (
            <div key={n}>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300">{meta.label} Pool</span>
                <span className="text-white font-bold">{fmt(member.nutrients[n].pool_mg, n === 'vitamin_c' ? 0 : 1, ' mg')}</span>
              </div>
              <div className="relative h-2 bg-mars-void rounded-full mt-1 overflow-hidden border border-white/5">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(4, pct))}%`, background: NUTRIENT_COLOR[n] }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
                  style={{ left: `${thrPct}%` }}
                  title={`Risk Threshold: ${meta.risk_threshold_mg} mg`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Horizon & Top Driver */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs pt-3 border-t border-white/10">
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Sols to Risk</span>
          <span className={`text-base font-bold ${member.status === 'ACT' ? 'text-red-400' : member.status === 'WATCH' ? 'text-amber-400' : 'text-emerald-400'}`}>
            {member.status === 'CALIBRATING' ? '—' : member.sols_to_risk === null ? 'Safe (∞)' : `${member.sols_to_risk.toFixed(0)} Sols`}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Top Driver</span>
          <span className="text-slate-200 text-xs block truncate font-medium">
            {member.top_driver ? `${VITAL_META[member.top_driver].label} z${member.driver_z !== null && member.driver_z >= 0 ? '+' : ''}${fmt(member.driver_z, 1)}` : 'Nominal'}
          </span>
        </div>
      </div>
    </button>
  );
};

const AlertCard: React.FC<{ alert: CrewAlert }> = ({ alert }) => (
  <div className={`p-4 rounded-xl border font-mono text-xs space-y-3 ${STATUS_STYLE[alert.status].bg} ${STATUS_STYLE[alert.status].border} shadow-lg`}>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/10 pb-2">
      <div className="flex items-center space-x-2">
        <StatusPill status={alert.status} />
        <span className="text-white font-bold text-sm">{alert.astronaut_id}</span>
        <span className="text-slate-400">• Sol {alert.sol}</span>
      </div>
      {alert.since_sol !== null && (
        <span className="text-[11px] text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
          Intake drift detected since Sol {alert.since_sol}
        </span>
      )}
    </div>

    <p className="text-slate-100 text-xs sm:text-sm leading-relaxed">{alert.message}</p>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
      {alert.changes.map((c) => (
        <div key={c.signal} className="bg-mars-void/80 rounded-lg p-2.5 border border-white/10">
          <span className="text-slate-400 block text-[11px] truncate font-medium">{c.label}</span>
          <span className={`text-sm font-bold ${(c.pct_change_vs_baseline ?? 0) < 0 ? 'text-red-400' : 'text-amber-400'}`}>
            {c.pct_change_vs_baseline !== null ? `${c.pct_change_vs_baseline > 0 ? '+' : ''}${c.pct_change_vs_baseline.toFixed(0)}%` : '—'}
          </span>
          <span className="text-slate-400 text-[11px] block mt-0.5">
            vs baseline{c.z !== null ? ` (z = ${c.z.toFixed(1)})` : ''}
          </span>
        </div>
      ))}
    </div>

    {alert.recommendation && (
      <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 flex items-start space-x-2.5">
        <Sprout className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
        <div>
          <span className="font-bold text-white block">Actionable Corrective Diet:</span>
          <span className="text-emerald-300">
            {alert.action}
          </span>
          <span className="text-slate-300 block text-[11px] mt-0.5">
            Source: {alert.recommendation.source} • Micronutrient Gap: {fmt(alert.intake_gap_mg_per_sol, 1, ' mg/Sol')}
          </span>
        </div>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Main Crew Health View
// ---------------------------------------------------------------------------
interface CrewHealthViewProps {
  missionSol?: number;
  setMissionSol?: (sol: number) => void;
  onNavigate?: (tab: string) => void;
}

export const CrewHealthView: React.FC<CrewHealthViewProps> = ({
  missionSol: parentSol,
  setMissionSol: setParentSol,
  onNavigate,
}) => {
  const [sol, setSol] = useState<number>(parentSol !== undefined && parentSol <= MISSION_SOLS - 1 ? parentSol : 192);
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

  // Sync with parent missionSol if changed externally
  useEffect(() => {
    if (parentSol !== undefined && parentSol !== sol && parentSol <= MISSION_SOLS - 1) {
      setSol(parentSol);
    }
  }, [parentSol]);

  const updateSol = (newSol: number) => {
    setSol(newSol);
    if (setParentSol) setParentSol(newSol);
  };

  const dSol = useDebounced(sol, 100);
  const dScenario = useDebounced(scenario, 300);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCrewHealth(dSol, dScenario)
      .then((d) => {
        if (!cancelled) {
          setSnapshot(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dSol, dScenario]);

  useEffect(() => {
    let cancelled = false;
    fetchAstronautTimeline(selected, dScenario)
      .then((d) => {
        if (!cancelled) setTimeline(d);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => { cancelled = true; };
  }, [selected, dScenario]);

  // Demo Story Presets (Crucial for 3-Minute Live Judge Pitch)
  const applyPreset = (step: 'nominal' | 'watch' | 'act' | 'nofailure') => {
    if (step === 'nominal') {
      setScenario(prev => ({ ...prev, failure_enabled: true, cooling_failure_sol: 150 }));
      updateSol(149);
      setSelected('CDR-01');
    } else if (step === 'watch') {
      setScenario(prev => ({ ...prev, failure_enabled: true, cooling_failure_sol: 150 }));
      updateSol(165);
      setSelected('PLT-02');
    } else if (step === 'act') {
      setScenario(prev => ({ ...prev, failure_enabled: true, cooling_failure_sol: 150 }));
      updateSol(192);
      setSelected('MS-03');
    } else if (step === 'nofailure') {
      setScenario(prev => ({ ...prev, failure_enabled: false }));
      updateSol(250);
      setSelected('MS-03');
    }
  };

  const member = snapshot?.crew.find((c) => c.astronaut_id === selected) ?? null;
  const pastPoints = useMemo(() => (timeline ? timeline.timeline.filter((p) => p.sol <= dSol) : []), [timeline, dSol]);

  const poolChart = (n: NutrientKey) => {
    if (!timeline) return null;
    const meta = timeline.nutrients[n];
    const pts: Array<[number, number]> = pastPoints.map((p) => [
      p.sol,
      n === 'vitamin_c' ? p.vitamin_c_pool_mg : p.thiamine_b1_pool_mg,
    ]);
    const series: Series[] = [{ points: pts, color: NUTRIENT_COLOR[n], width: 3 }];
    const f = member?.nutrients[n];
    if (f && f.pool_mg !== null && f.equilibrium_pool_mg !== null && f.personal_turnover_per_sol) {
      const k = f.personal_turnover_per_sol;
      const fc: Array<[number, number]> = [];
      for (let t = 0; t <= FORECAST_HORIZON && dSol + t < MISSION_SOLS; t += 2) {
        const v = f.equilibrium_pool_mg + (f.pool_mg - f.equilibrium_pool_mg) * Math.exp(-k * t);
        fc.push([dSol + t, Math.min(meta.pool_max_mg, v)]);
      }
      series.push({ points: fc, color: '#f8fafc', width: 2, dashed: true, opacity: 0.85 });
    }
    const markers: ChartProps['markers'] = [];
    const act = timeline.first_act_sol;
    if (act !== null && act <= dSol) {
      const p = timeline.timeline[act];
      markers.push({
        x: act,
        y: n === 'vitamin_c' ? p.vitamin_c_pool_mg : p.thiamine_b1_pool_mg,
        color: '#f87171',
        label: `ACT Sol ${act}`,
      });
    }
    const cross = timeline.threshold_crossing_sol[n];
    if (cross !== null && cross <= dSol) {
      markers.push({ x: cross, y: meta.risk_threshold_mg, color: '#fca5a5', label: `crossed Sol ${cross}` });
    }
    return (
      <SvgLineChart
        title={`${meta.label} Body Pool`}
        subtitle={
          f
            ? `k=${fmt(f.personal_turnover_per_sol, 4)}/Sol • ${
                f.sols_to_risk === null ? 'no crossing forecast' : `${f.sols_to_risk.toFixed(0)} Sols to risk`
              } • dashed = 120-Sol forecast`
            : undefined
        }
        series={series}
        yMin={0}
        yMax={meta.pool_max_mg}
        yUnit="mg"
        yDigits={n === 'vitamin_c' ? 0 : 1}
        events={timeline.events}
        nowSol={dSol}
        threshold={{ y: meta.risk_threshold_mg, label: `${meta.risk_threshold_mg} mg threshold` }}
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
    const pad = (hi - lo) * 0.1;
    return (
      <SvgLineChart
        title={`${VITAL_META[vital].label} vs Personal Baseline`}
        subtitle="Green band = astronaut personal baseline mean ± 2 SD (Sols 0–20 calibration)"
        series={[{ points: pastPoints.map((p) => [p.sol, p[vital]]), color: '#f59e0b', width: 2 }]}
        yMin={lo - pad}
        yMax={hi + pad}
        yUnit={VITAL_META[vital].unit}
        yDigits={VITAL_META[vital].digits}
        events={timeline.events}
        nowSol={dSol}
        yBand={{ y0: b.band_low, y1: b.band_high, mean: b.mean, label: 'personal normal ±2σ' }}
      />
    );
  };

  const alerts = snapshot ? [...snapshot.active_alerts].sort((a, b) => b.sol - a.sol) : [];

  return (
    <div className="space-y-6">
      {/* Hero Header & Provenance */}
      <div className="nova-panel-elevated rounded-2xl p-5 sm:p-6 border border-white/10 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-mono font-bold tracking-wider uppercase">
                <HeartPulse className="w-3.5 h-3.5 text-orange-400" />
                <span>NASA Challenge Solution</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-semibold">
                <FlaskConical className="w-3 h-3" />
                <span>Synthetic Mission Simulation</span>
              </span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">• Decision-Support Prototype</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold font-sans text-white tracking-tight mt-2.5">
              Crew Health & Micronutrient Early-Warning Monitor
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-3xl mt-1 leading-relaxed">
              We forecast the invisible micronutrient gap between Earth blood draws: from food storage temperature degradation to body vitamin pool depletion and personal-baseline anomaly detection.
            </p>
          </div>

          {/* Whole Crew Health Status Capsule */}
          {snapshot && (
            <div className="flex items-center space-x-3 bg-mars-void/80 p-3 rounded-xl border border-white/10 shrink-0">
              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-400 block uppercase">Crew Overall State</span>
                <span className="text-sm font-bold text-white">4 Astronauts</span>
              </div>
              <StatusPill status={snapshot.crew_status} />
            </div>
          )}
        </div>

        {/* 1-Click Demo Story Bar (Pitch Presets) */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
          <span className="text-slate-300 font-bold flex items-center space-x-1.5 shrink-0">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span>3-Minute Pitch Presets:</span>
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
            <button
              onClick={() => applyPreset('nominal')}
              className={`px-3 py-2 rounded-xl border text-center transition-all ${
                sol === 149 && scenario.failure_enabled
                  ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/30 border-emerald-400'
                  : 'bg-mars-void/80 border-white/10 text-slate-300 hover:text-white hover:border-slate-500'
              }`}
            >
              1. Sol 149: All Nominal
            </button>
            <button
              onClick={() => applyPreset('watch')}
              className={`px-3 py-2 rounded-xl border text-center transition-all ${
                sol === 165 && scenario.failure_enabled
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/30 border-amber-400'
                  : 'bg-mars-void/80 border-white/10 text-slate-300 hover:text-white hover:border-slate-500'
              }`}
            >
              2. Sol 165: Outage & Watch
            </button>
            <button
              onClick={() => applyPreset('act')}
              className={`px-3 py-2 rounded-xl border text-center transition-all ${
                sol === 192 && scenario.failure_enabled
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold shadow-lg shadow-red-500/40 border-red-400 animate-pulse'
                  : 'bg-mars-void/80 border-white/10 text-slate-300 hover:text-white hover:border-slate-500'
              }`}
            >
              ★ 3. Sol 192: ACT Alert (~50 Sols Early)
            </button>
            <button
              onClick={() => applyPreset('nofailure')}
              className={`px-3 py-2 rounded-xl border text-center transition-all ${
                !scenario.failure_enabled
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30 border-cyan-400'
                  : 'bg-mars-void/80 border-white/10 text-slate-300 hover:text-white hover:border-slate-500'
              }`}
            >
              4. Nominal Baseline (0 False Alarms)
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/50 bg-red-500/15 text-red-300 text-xs font-mono flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>Backend sync notice: {error}. Check backend server on port 8001.</span>
        </div>
      )}

      {/* 4 Astronaut Status Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 text-xs font-mono">
          <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center space-x-1.5">
            <UserRound className="w-3.5 h-3.5 text-cyan-400" />
            <span>Select Astronaut Profile ({snapshot?.crew.length || 4} Crew Members)</span>
          </span>
          <span className="text-slate-400 text-[11px]">Click a card to inspect full physiological telemetry</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {snapshot?.crew.map((m) => (
            <AstronautCard
              key={m.astronaut_id}
              member={m}
              snapshot={snapshot}
              selected={m.astronaut_id === selected}
              onSelect={() => setSelected(m.astronaut_id)}
            />
          ))}
        </div>
      </div>

      {/* Main Interactive Stage: Telemetry Controls & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Timeline Scrubber & Scenario Injections */}
        <div className="lg:col-span-4 nova-panel rounded-2xl p-5 border border-white/10 space-y-5 font-mono text-xs">
          <h3 className="font-bold text-white text-sm border-b border-white/10 pb-3 uppercase flex items-center justify-between">
            <span>Mission Timeline Controls</span>
            <span className="text-orange-400 font-bold">SOL {sol}</span>
          </h3>

          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-slate-300">Scrub Mission Sol:</span>
              <span className="text-white font-bold">Sol {sol} / {MISSION_SOLS}</span>
            </div>
            <input
              type="range"
              min={0}
              max={MISSION_SOLS - 1}
              value={sol}
              onChange={(e) => updateSol(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-2 bg-mars-void rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Sol 0 (Baseline)</span>
              <span>Sol 150 (Event)</span>
              <span className="text-orange-400 font-bold">Sol 192 (Alert)</span>
              <span>Sol 450</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Causal analysis: Telemetry at Sol {sol} strictly uses data observed up to this Sol.
            </p>
          </div>

          {/* Cooling Failure Toggle & Sliders */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-2 text-slate-200 font-semibold">
                <ThermometerSun className="w-4 h-4 text-orange-400" />
                <span>Habitat Cooling Loop</span>
              </span>
              <button
                onClick={() => setScenario({ ...scenario, failure_enabled: !scenario.failure_enabled })}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  scenario.failure_enabled
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'bg-mars-void border border-white/10 text-slate-400'
                }`}
              >
                {scenario.failure_enabled ? 'FAILURE INJECTED' : 'NOMINAL (OFF)'}
              </button>
            </div>

            <div className={scenario.failure_enabled ? 'space-y-3 pt-1' : 'opacity-40 pointer-events-none space-y-3 pt-1'}>
              {([
                ['cooling_failure_sol', 'Failure Starts at Sol', 30, 400, 5, ''],
                ['failure_duration_sols', 'Outage Duration', 5, 150, 5, ' Sols'],
                ['failure_peak_temp_c', 'Peak Storage Temp', 10, 45, 0.5, '°C'],
              ] as const).map(([key, label, min, max, step, unit]) => (
                <div key={key}>
                  <div className="flex justify-between mb-1 text-[11px]">
                    <span className="text-slate-300">{label}:</span>
                    <span className="text-orange-400 font-bold">{scenario[key]}{unit}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={scenario[key]}
                    onChange={(e) => setScenario({ ...scenario, [key]: Number(e.target.value) })}
                    className="w-full accent-orange-500 cursor-pointer h-1.5 bg-mars-void rounded"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* System Status Logic Summary */}
          {snapshot && (
            <div className="p-3.5 rounded-xl bg-mars-void/90 border border-white/10 space-y-2">
              <span className="text-slate-200 font-bold uppercase text-[11px] flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Explainable Status Thresholds</span>
              </span>
              {(['ACT', 'WATCH', 'NOMINAL'] as CrewStatus[]).map((s) => (
                <div key={s} className="flex items-start space-x-2 text-[10px]">
                  <span className={`w-14 shrink-0 font-bold ${STATUS_STYLE[s].text}`}>{s}:</span>
                  <span className="text-slate-300">{snapshot.status_rules[s]}</span>
                </div>
              ))}
              <div className="flex justify-between text-[10px] pt-2 border-t border-white/10 text-slate-300">
                <span>Ration Temp: <strong className="text-white">{fmt(snapshot.storage_temp_c, 1, '°C')}</strong></span>
                <span>Greenhouse: <strong className={snapshot.greenhouse_online ? 'text-emerald-400' : 'text-red-400'}>{snapshot.greenhouse_online ? 'ONLINE' : 'OFFLINE'}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (8 Cols): Selected Astronaut Charts & Alerts */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Astronaut Header */}
          <div className="nova-panel rounded-2xl p-5 border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-3 gap-2 font-mono">
              <div>
                <h3 className="font-bold text-white text-base flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>{selected} — PHYSIOLOGICAL TIMELINE & POOL RETENTION</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  First WATCH Sol: <strong className="text-amber-400">{timeline?.first_watch_sol ?? 'None'}</strong> • First ACT Sol: <strong className="text-red-400">{timeline?.first_act_sol ?? 'None'}</strong> • IsolationForest Anomaly Score: <strong className="text-cyan-400">{fmt(member?.anomaly_score, 2)}</strong>
                </p>
              </div>
              {member && <StatusPill status={member.status} />}
            </div>

            {/* Dual Pool Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {poolChart('vitamin_c')}
              {poolChart('thiamine_b1')}
            </div>

            {/* Vital Signs vs Baseline Band */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                <span className="text-xs text-slate-300 font-bold uppercase">Biometric Vital vs Personal Normal:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(VITAL_META) as VitalKey[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVital(v)}
                      className={`px-3 py-1 rounded-full text-xs transition-all ${
                        vital === v
                          ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                          : 'bg-mars-void border border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      {VITAL_META[v].label}
                      {member?.z_scores[v] !== null && member?.z_scores[v] !== undefined && (
                        <span className="opacity-80 text-[10px]"> (z={member.z_scores[v]! >= 0 ? '+' : ''}{member.z_scores[v]!.toFixed(1)})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {vitalsChart()}
            </div>

            {/* Current Sol Assessment */}
            {member?.assessment && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Explainable Assessment for {selected} at Sol {dSol}</span>
                </span>
                <AlertCard alert={member.assessment} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Alerts List (All Crew) */}
      <div className="nova-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="font-mono font-bold text-white text-sm uppercase flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Active Early-Warning Advisories up to Sol {dSol} ({alerts.length})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {alerts.length === 0 ? 'All crew nominal' : 'Early intervention prevents pool exhaustion'}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="p-6 rounded-xl bg-mars-void/60 text-center font-mono text-xs text-slate-400 border border-white/5">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            No active early-warning alerts up to Sol {dSol}. All crew vitals and body vitamin stores remain within their personal baseline normal.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {alerts.map((a) => (
              <AlertCard key={`${a.astronaut_id}-${a.sol}-${a.status}`} alert={a} />
            ))}
          </div>
        )}
      </div>

      {/* REAL DATA SPOTLIGHT: NASA OSDR INSPIRATION4 PANEL */}
      <Inspiration4Panel />
    </div>
  );
};
