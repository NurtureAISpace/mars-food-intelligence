import React, { useEffect, useMemo, useState } from 'react';
import { fetchRealDataI4 } from '../api';
import { RealDataI4, RealDataSeries } from '../types';
import { Satellite, ExternalLink, UserRound, Lightbulb, ShieldAlert, Info, Rocket, Database } from 'lucide-react';

const fmt = (x: number | null | undefined, digits = 1, suffix = '') =>
  x === null || x === undefined ? '—' : `${x.toFixed(digits)}${suffix}`;
const fmtZ = (z: number | null | undefined) => (z === null || z === undefined ? '—' : `${z >= 0 ? '+' : ''}${z.toFixed(1)}`);

// Digits that keep values readable for any analyte (e.g. 0.89 mg/dL vs 250 Thousand/uL)
const digitsFor = (span: number) => (span >= 50 ? 0 : span >= 5 ? 1 : 2);

// ---------------------------------------------------------------------------
// SVG chart: values over timepoints vs personal baseline band and lab reference range
// ---------------------------------------------------------------------------
const W = 720;
const H = 270;
const PAD_L = 56;
const PAD_R = 20;
const PAD_T = 26;
const PAD_B = 42;
const FLIGHT_GAP = 0.9; // extra x-space between L-3 and R+1 for the flight marker

const BaselineChart: React.FC<{
  series: RealDataSeries;
  timepoints: RealDataI4['timepoints'];
  refRange: { low: number | null; high: number | null };
  flagZ: number;
}> = ({ series, timepoints, refRange, flagZ }) => {
  const firstPost = timepoints.findIndex((t) => t.phase === 'post');
  const xIndex = (i: number) => i + (firstPost >= 0 && i >= firstPost ? FLIGHT_GAP : 0);
  const xMaxIdx = xIndex(timepoints.length - 1);
  const sx = (i: number) => PAD_L + 24 + (xIndex(i) / xMaxIdx) * (W - PAD_L - PAD_R - 48);

  const byTp = new Map(series.points.map((p) => [p.timepoint, p]));
  const vals = series.points.map((p) => p.value).filter((v): v is number => v !== null);
  const { band_low, band_high, mean } = series.baseline;

  // y-domain: data + baseline band; the lab range only if it does not squash the data
  let lo = Math.min(...vals, band_low ?? Infinity);
  let hi = Math.max(...vals, band_high ?? -Infinity);
  const core = Math.max(hi - lo, 1e-6);
  const refLowOn = refRange.low !== null && refRange.low >= lo - 2.5 * core;
  const refHighOn = refRange.high !== null && refRange.high <= hi + 2.5 * core;
  if (refLowOn) lo = Math.min(lo, refRange.low!);
  if (refHighOn) hi = Math.max(hi, refRange.high!);
  const pad = (hi - lo) * 0.1 || 1;
  // Blood values are never negative: don't let a wide baseline band push the axis below 0
  const nonNegative = vals.every((v) => v >= 0) && (refRange.low ?? 0) >= 0;
  const yMin = nonNegative ? Math.max(0, lo - pad) : lo - pad;
  const yMax = hi + pad;
  const sy = (v: number) => H - PAD_B - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);
  const yDigits = digitsFor(yMax - yMin);
  const vDigits = digitsFor(core);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));

  const linePts = timepoints
    .map((t, i) => ({ i, p: byTp.get(t.id) }))
    .filter((d) => d.p && d.p.value !== null) as Array<{ i: number; p: NonNullable<ReturnType<typeof byTp.get>> }>;
  const path = linePts.reduce((acc, d, k) => `${acc}${k === 0 ? 'M' : ' L'} ${sx(d.i).toFixed(1)} ${sy(d.p.value!).toFixed(1)}`, '');

  const flightX0 = firstPost > 0 ? sx(firstPost - 1) + 18 : 0;
  const flightX1 = firstPost > 0 ? sx(firstPost) - 18 : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px] h-auto" role="img"
      aria-label={`${series.analyte} for ${series.astronaut} before and after flight`}>
      {/* Grid */}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD_L} y1={sy(v)} x2={W - PAD_R} y2={sy(v)} stroke="#1f2e4d" strokeDasharray="3 3" />
          <text x={PAD_L - 6} y={sy(v) + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
            {v.toFixed(yDigits)}
          </text>
        </g>
      ))}
      <text x={8} y={PAD_T - 10} fill="#64748b" fontSize="9" fontFamily="monospace">{series.unit}</text>

      {/* Flight marker */}
      {firstPost > 0 && (
        <g>
          <rect x={flightX0} y={PAD_T} width={flightX1 - flightX0} height={H - PAD_T - PAD_B} fill="#f97316" opacity={0.12} />
          <line x1={(flightX0 + flightX1) / 2} y1={PAD_T} x2={(flightX0 + flightX1) / 2} y2={H - PAD_B}
            stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={(flightX0 + flightX1) / 2} y={PAD_T - 8} textAnchor="middle" fill="#fdba74" fontSize="9" fontWeight="bold" fontFamily="monospace">
            ~3 DAYS IN ORBIT
          </text>
        </g>
      )}

      {/* Personal baseline band (mean ± flagZ·SD) */}
      {band_low !== null && band_high !== null && mean !== null && (
        <g>
          <rect x={PAD_L} y={sy(band_high)} width={W - PAD_L - PAD_R} height={Math.max(1, sy(band_low) - sy(band_high))}
            fill="#10b981" opacity={0.13} />
          <line x1={PAD_L} y1={sy(mean)} x2={W - PAD_R} y2={sy(mean)} stroke="#10b981" strokeWidth="1" strokeDasharray="2 3" />
          <text x={PAD_L + 4} y={sy(band_high) - 4} fill="#6ee7b7" fontSize="9" fontFamily="monospace">
            personal normal (±{flagZ}σ)
          </text>
        </g>
      )}

      {/* Lab reference range */}
      {refLowOn && (
        <g>
          <line x1={PAD_L} y1={sy(refRange.low!)} x2={W - PAD_R} y2={sy(refRange.low!)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="6 4" />
          <text x={W - PAD_R - 4} y={sy(refRange.low!) + 11} textAnchor="end" fill="#94a3b8" fontSize="9" fontFamily="monospace">
            lab normal min {refRange.low}
          </text>
        </g>
      )}
      {refHighOn && (
        <g>
          <line x1={PAD_L} y1={sy(refRange.high!)} x2={W - PAD_R} y2={sy(refRange.high!)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="6 4" />
          <text x={W - PAD_R - 4} y={sy(refRange.high!) - 4} textAnchor="end" fill="#94a3b8" fontSize="9" fontFamily="monospace">
            lab normal max {refRange.high}
          </text>
        </g>
      )}

      {/* Lab range far outside the data: say so instead of squashing the chart */}
      {(refRange.low !== null && !refLowOn) || (refRange.high !== null && !refHighOn) ? (
        <text x={W - PAD_R - 4} y={H - PAD_B - 6} textAnchor="end" fill="#94a3b8" fontSize="9" fontFamily="monospace">
          lab normal range {refRange.low ?? '—'}–{refRange.high ?? '—'} (partly off chart)
        </text>
      ) : null}

      {/* Values */}
      {linePts.length > 1 && <path d={path} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinejoin="round" />}
      {linePts.map(({ i, p }) => {
        const isBase = timepoints[i].is_baseline;
        const color = p.flagged ? '#f97316' : isBase ? '#10b981' : '#06b6d4';
        return (
          <g key={p.timepoint}>
            {p.flagged && <circle cx={sx(i)} cy={sy(p.value!)} r="10" fill="#f97316" opacity={0.2} />}
            <circle cx={sx(i)} cy={sy(p.value!)} r={p.flagged ? 5.5 : 4} fill={color} stroke="#fff" strokeWidth="1.5" />
            <text x={sx(i)} y={sy(p.value!) - 10} textAnchor="middle" fill={p.flagged ? '#fdba74' : '#cbd5e1'} fontSize="9"
              fontWeight={p.flagged ? 'bold' : 'normal'} fontFamily="monospace">
              {p.value!.toFixed(vDigits)}
            </text>
          </g>
        );
      })}

      {/* X labels */}
      {timepoints.map((t, i) => (
        <g key={t.id}>
          <text x={sx(i)} y={H - PAD_B + 15} textAnchor="middle" fill={t.is_baseline ? '#6ee7b7' : '#cbd5e1'} fontSize="10"
            fontWeight="bold" fontFamily="monospace">{t.id}</text>
          <text x={sx(i)} y={H - PAD_B + 27} textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
            {t.phase === 'pre' ? `${-t.day}d before` : `${t.day}d after`}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export const RealDataView: React.FC = () => {
  const [data, setData] = useState<RealDataI4 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [astronaut, setAstronaut] = useState<string>('C001');
  const [analyte, setAnalyte] = useState<string>('MCV');

  useEffect(() => {
    let cancelled = false;
    fetchRealDataI4()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (d.default_analyte) setAnalyte(d.default_analyte);
        if (d.crew.length && !d.crew.some((c) => c.id === 'C001')) setAstronaut(d.crew[0].id);
      })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, []);

  const seriesIndex = useMemo(() => {
    const m = new Map<string, RealDataSeries>();
    data?.series.forEach((s) => m.set(`${s.astronaut}|${s.analyte}`, s));
    return m;
  }, [data]);

  const analyteMeta = data?.analytes.find((a) => a.name === analyte) ?? null;
  const series = seriesIndex.get(`${astronaut}|${analyte}`) ?? null;
  const panels = useMemo(() => Array.from(new Set(data?.analytes.map((a) => a.panel) ?? [])), [data]);
  const sf = data?.summary.shared_finding ?? null;
  const nc = data?.summary.noise_control ?? null;
  const firstPost = data?.post_flight_timepoints[0] ?? 'R+1';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Satellite className="w-5 h-5 text-orange-400" />
            <h2 className="text-xl font-bold font-mono text-white">REAL NASA DATA · INSPIRATION4</h2>
          </div>
          <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
            4 people flew to orbit for 3 days. NASA published their blood tests before and after.
            <br />
            We compare each person with their own pre-flight normal.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1.5">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 text-[11px] font-mono font-bold uppercase">
            <Database className="w-3.5 h-3.5" />
            <span>Real data · NASA OSDR · Inspiration4 (OSD-569, OSD-575)</span>
          </span>
          <div className="flex flex-wrap gap-3 text-[10px] font-mono">
            {(data?.source.urls ?? []).map((u) => (
              <a key={u.url} href={u.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline">
                <span>{u.label}</span><ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
      {data && (
        <p className="text-[10px] font-mono text-slate-500 -mt-4">
          {data.source.mission}. {data.source.license}; unmodified public files. Prototype, not a medical device.
        </p>
      )}
      {error && (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs font-mono">Backend error: {error}</div>
      )}
      {!data && !error && <p className="text-xs font-mono text-slate-400">Loading real astronaut data…</p>}

      {data && (
        <>
          {/* Astronaut selector */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.crew.map((c) => {
              const s = seriesIndex.get(`${c.id}|${analyte}`);
              const r1 = s?.points.find((p) => p.timepoint === firstPost) ?? null;
              const selected = c.id === astronaut;
              return (
                <button key={c.id} onClick={() => setAstronaut(c.id)}
                  className={`text-left p-4 rounded-xl border transition-all font-mono ${
                    r1?.flagged ? 'bg-orange-500/10' : 'bg-mars-card/60'
                  } ${selected ? 'border-orange-500 ring-1 ring-orange-500/60' : 'border-mars-border hover:border-orange-400/60'}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2 text-white font-bold text-sm">
                      <UserRound className="w-4 h-4 text-slate-400" />
                      <span>{c.id}</span>
                    </span>
                    <span className="text-[10px] text-slate-500">{c.sex === 'F' ? 'female' : c.sex === 'M' ? 'male' : ''}</span>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400">{analyte} on day {firstPost}</div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-sm text-slate-100">{fmt(r1?.value, 2)} <span className="text-[10px] text-slate-500">{s?.unit}</span></span>
                    <span className={`text-[11px] font-bold ${r1?.flagged ? 'text-orange-300' : 'text-slate-400'}`}>
                      z {fmtZ(r1?.z)}{r1?.flagged ? ' · flagged' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chart */}
          <div className="glass-panel rounded-xl p-5 border border-mars-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-mars-border pb-3 font-mono">
              <div>
                <h3 className="font-bold text-white text-sm">
                  {astronaut} — {analyteMeta?.label ?? analyte}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {analyteMeta ? `${analyteMeta.panel} · ${data.source.panels[analyteMeta.panel] ?? ''} · ` : ''}
                  lab name: {analyte}
                </p>
              </div>
              <label className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400">Blood test:</span>
                <select value={analyte} onChange={(e) => setAnalyte(e.target.value)}
                  className="bg-mars-dark border border-mars-border rounded px-2 py-1.5 text-slate-100 focus:border-orange-500 focus:outline-none max-w-[16rem]">
                  {panels.map((p) => (
                    <optgroup key={p} label={data.source.panels[p] ?? p}>
                      {data.analytes.filter((a) => a.panel === p).map((a) => (
                        <option key={a.name} value={a.name}>{a.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>

            {series ? (
              <>
                <div className="bg-mars-dark/90 rounded-lg p-3 border border-mars-border overflow-x-auto">
                  <BaselineChart series={series} timepoints={data.timepoints}
                    refRange={analyteMeta?.reference_range ?? { low: null, high: null }} flagZ={data.method.flag_z} />
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center space-x-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/60" /><span>personal normal (from 3 pre-flight tests)</span></span>
                  <span className="flex items-center space-x-1.5"><span className="w-4 border-t border-dashed border-slate-400" /><span>lab normal range (same for everyone)</span></span>
                  <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /><span>flagged: |z| &gt; {data.method.flag_z}</span></span>
                  <span className="flex items-center space-x-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500/20" /><span>spaceflight</span></span>
                  <span>x-axis not to scale</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono flex items-start space-x-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-cyan-400" />
                  <span>
                    {data.method.plain_text} Personal normal for {astronaut}: {fmt(series.baseline.mean, 2)} {series.unit}
                    {series.baseline.sd_source === 'floor' ? ' (pre-flight tests were very close together, so a minimum spread was used).' : '.'}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-xs font-mono text-slate-500">
                No usable series for {astronaut} · {analyte} (fewer than 2 pre-flight values in the NASA file).
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* What we found */}
            <div className="glass-panel-glow rounded-xl p-5 space-y-4 font-mono">
              <h3 className="font-bold text-white text-sm uppercase flex items-center space-x-2">
                <Lightbulb className="w-4 h-4 text-orange-400" /><span>What we found</span>
              </h3>
              {sf ? (
                <>
                  <p className="text-sm text-slate-200 leading-relaxed font-sans">{sf.plain_text}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                    {sf.per_astronaut.map((p) => (
                      <button key={p.astronaut} onClick={() => { setAstronaut(p.astronaut); setAnalyte(sf.analyte); }}
                        className="text-left bg-mars-dark/70 rounded p-2 border border-mars-border hover:border-orange-400/60">
                        <span className="text-white font-bold block">{p.astronaut}</span>
                        <span className="text-slate-300 block">{fmt(p.baseline_mean, 1)} → {fmt(p.value, 1)} {sf.unit}</span>
                        <span className={p.flagged ? 'text-orange-300' : 'text-slate-400'}>
                          {fmt(p.pct_change, 1, '%')} · z {fmtZ(p.z)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{sf.sensitivity.plain_text}</p>
                  {(analyte !== sf.analyte) && (
                    <button onClick={() => setAnalyte(sf.analyte)}
                      className="px-3 py-1.5 rounded bg-orange-500 text-white text-[11px] font-bold hover:bg-orange-600">
                      Show {sf.analyte} on the chart
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-300 font-sans">
                  No blood value changed in the same direction in every crew member one day after landing.
                </p>
              )}

              {nc && (
                <div className="p-3 rounded-lg bg-mars-dark border border-mars-border space-y-2">
                  <span className="text-cyan-400 font-bold uppercase text-[11px] flex items-center space-x-1.5">
                    <Rocket className="w-3.5 h-3.5" /><span>Sanity check: how often do flags appear with no flight?</span>
                  </span>
                  {([
                    [`Before flight (${nc.control_timepoint} vs ${nc.control_baseline.join(' + ')})`, nc.control_flagged, nc.control_tests, nc.control_pct, 'bg-slate-400'],
                    [`After flight (${nc.flight_timepoint} vs all 3 pre-flight)`, nc.flight_flagged, nc.flight_tests, nc.flight_pct, 'bg-orange-500'],
                  ] as const).map(([label, f, n, pct, bar]) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{label}</span>
                        <span className="text-slate-200">{f}/{n} tests flagged · {fmt(pct, 0, '%')}</span>
                      </div>
                      <div className="h-1.5 bg-mars-card rounded mt-0.5 overflow-hidden">
                        <div className={`h-full rounded ${bar}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{nc.plain_text}</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{nc.chance_note}</p>
                </div>
              )}
            </div>

            {/* Honest limits */}
            <div className="glass-panel rounded-xl p-5 border border-mars-border space-y-3 font-mono">
              <h3 className="font-bold text-white text-sm uppercase flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" /><span>Honest limits</span>
              </h3>
              <ul className="space-y-3">
                {data.limitations.map((l) => (
                  <li key={l.key} className="flex items-start space-x-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-amber-200 block">{l.title}</span>
                      <span className="text-[12px] text-slate-300 leading-relaxed font-sans">{l.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-slate-500 border-t border-mars-border pt-3">{data.source.citation}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
