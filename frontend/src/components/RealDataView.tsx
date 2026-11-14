import React, { useEffect, useMemo, useState } from 'react';
import { fetchRealDataI4 } from '../api';
import { RealDataI4, RealDataSeries } from '../types';
import { ExternalLink, Info, Rocket } from 'lucide-react';
import { Hero } from '../ui/Hero';
import { Card, DataBadge, ErrorNote, Eyebrow, SectionHead } from '../ui/primitives';
import { C } from '../ui/tokens';
import { ANNOT, AXIS_TITLE, ChartLegend, HaloDot, TICK } from '../ui/chart';

const fmt = (x: number | null | undefined, digits = 1, suffix = '') =>
  x === null || x === undefined ? '—' : `${x.toFixed(digits)}${suffix}`;
const fmtZ = (z: number | null | undefined) => (z === null || z === undefined ? '—' : `${z >= 0 ? '+' : ''}${z.toFixed(1)}`);

// Digits that keep values readable for any analyte (e.g. 0.89 mg/dL vs 250 Thousand/uL)
const digitsFor = (span: number) => (span >= 50 ? 0 : span >= 5 ? 1 : 2);

// Flagged values are a warning state → WATCH amber; text stays in text colours.
const FLAG = C.watch;

// ---------------------------------------------------------------------------
// SVG chart: values over timepoints vs personal baseline band and lab reference range
// ---------------------------------------------------------------------------
const W = 1100;
const H = 330;
const PAD_L = 74;
const PAD_R = 24;
const PAD_T = 30;
const PAD_B = 58;
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
  const sx = (i: number) => PAD_L + 30 + (xIndex(i) / xMaxIdx) * (W - PAD_L - PAD_R - 60);

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

  const flightX0 = firstPost > 0 ? sx(firstPost - 1) + 26 : 0;
  const flightX1 = firstPost > 0 ? sx(firstPost) - 26 : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[640px]" role="img"
      aria-label={`${series.analyte} for ${series.astronaut} before and after flight`}>
      {/* Grid */}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD_L} y1={sy(v)} x2={W - PAD_R} y2={sy(v)} stroke={C.grid} />
          <text x={PAD_L - 10} y={sy(v) + 4} textAnchor="end" {...TICK} fontSize={12}>{v.toFixed(yDigits)}</text>
        </g>
      ))}
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke={C.axis} />
      <text transform={`translate(18 ${(PAD_T + H - PAD_B) / 2}) rotate(-90)`} textAnchor="middle" {...AXIS_TITLE} fontSize={11.5}>
        {series.analyte.toUpperCase()} ({series.unit})
      </text>
      <text x={(PAD_L + W - PAD_R) / 2} y={H - 4} textAnchor="middle" {...AXIS_TITLE} fontSize={11.5}>
        BLOOD DRAW (DAYS RELATIVE TO LAUNCH / LANDING)
      </text>

      {/* Flight marker */}
      {firstPost > 0 && (
        <g>
          <rect x={flightX0} y={PAD_T} width={flightX1 - flightX0} height={H - PAD_T - PAD_B} fill={C.accent} opacity={0.1} />
          <line x1={(flightX0 + flightX1) / 2} y1={PAD_T} x2={(flightX0 + flightX1) / 2} y2={H - PAD_B}
            stroke={C.accent} strokeWidth="1" strokeDasharray="3 3" opacity={0.8} />
          <text x={(flightX0 + flightX1) / 2} y={PAD_T - 10} textAnchor="middle" {...ANNOT} fontSize={12} fontWeight={600}>
            ~3 DAYS IN ORBIT
          </text>
        </g>
      )}

      {/* Personal baseline band (mean ± flagZ·SD) */}
      {band_low !== null && band_high !== null && mean !== null && (
        <g>
          <rect x={PAD_L} y={sy(band_high)} width={W - PAD_L - PAD_R} height={Math.max(1, sy(band_low) - sy(band_high))}
            fill={C.band} opacity={0.08} />
          <line x1={PAD_L} y1={sy(mean)} x2={W - PAD_R} y2={sy(mean)} stroke={C.band} strokeWidth="1" strokeDasharray="2 4" opacity={0.6} />
          <text x={PAD_L + 6} y={sy(band_high) - 6} {...ANNOT} fontSize={11.5}>personal normal (±{flagZ}σ)</text>
        </g>
      )}

      {/* Lab reference range */}
      {refLowOn && (
        <g>
          <line x1={PAD_L} y1={sy(refRange.low!)} x2={W - PAD_R} y2={sy(refRange.low!)} stroke={C.muted} strokeWidth="1" strokeDasharray="6 5" opacity={0.7} />
          <text x={W - PAD_R - 4} y={sy(refRange.low!) + 15} textAnchor="end" {...TICK} fontSize={11.5}>lab normal min {refRange.low}</text>
        </g>
      )}
      {refHighOn && (
        <g>
          <line x1={PAD_L} y1={sy(refRange.high!)} x2={W - PAD_R} y2={sy(refRange.high!)} stroke={C.muted} strokeWidth="1" strokeDasharray="6 5" opacity={0.7} />
          <text x={W - PAD_R - 4} y={sy(refRange.high!) - 6} textAnchor="end" {...TICK} fontSize={11.5}>lab normal max {refRange.high}</text>
        </g>
      )}

      {/* Lab range far outside the data: say so instead of squashing the chart */}
      {(refRange.low !== null && !refLowOn) || (refRange.high !== null && !refHighOn) ? (
        <text x={W - PAD_R - 4} y={H - PAD_B - 8} textAnchor="end" {...TICK} fontSize={11.5}>
          lab normal range {refRange.low ?? '—'}–{refRange.high ?? '—'} (partly off chart)
        </text>
      ) : null}

      {/* Values */}
      {linePts.length > 1 && <path d={path} fill="none" stroke={C.series1} strokeWidth="1.5" strokeLinejoin="round" />}
      {linePts.map(({ i, p }) => {
        const isBase = timepoints[i].is_baseline;
        const color = p.flagged ? FLAG : isBase ? C.band : C.series1;
        return (
          <g key={p.timepoint}>
            <HaloDot cx={sx(i)} cy={sy(p.value!)} color={color} r={p.flagged ? 5 : 4} />
            <text x={sx(i)} y={sy(p.value!) - 14} textAnchor="middle" fill={C.fg} fontSize={12}
              fontWeight={p.flagged ? 700 : 400} fontFamily={TICK.fontFamily}>
              {p.value!.toFixed(vDigits)}{p.flagged ? ' ⚑' : ''}
            </text>
            <title>{`${timepoints[i].id}: ${p.value} ${series.unit} · z ${fmtZ(p.z)}${p.flagged ? ' · flagged' : ''}`}</title>
          </g>
        );
      })}

      {/* X labels */}
      {timepoints.map((t, i) => (
        <g key={t.id}>
          <text x={sx(i)} y={H - PAD_B + 19} textAnchor="middle" fill={C.fg} fontSize={12.5} fontWeight={600} fontFamily={TICK.fontFamily}>{t.id}</text>
          <text x={sx(i)} y={H - PAD_B + 34} textAnchor="middle" {...TICK} fontSize={11}>
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
    <div>
      <Hero
        index="02"
        label="Real NASA Data"
        lines={['Real crew.', 'Real blood.']}
        subtitle="Inspiration4 blood tests from NASA's open database (OSD-569, OSD-575)."
        planet="earth"
      >
        <DataBadge kind="real">Real data · NASA OSDR · Inspiration4</DataBadge>
        {(data?.source.urls ?? []).map((u) => (
          <a key={u.url} href={u.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-soft transition hover:border-white/30 hover:text-fg">
            {u.label}<ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </Hero>

      <div className="mt-6 space-y-4 lg:space-y-5">
        <p className="max-w-3xl text-base leading-relaxed text-soft">
          4 people flew to orbit for 3 days. NASA published their blood tests before and after.{' '}
          <span className="text-fg">We compare each person with their own pre-flight normal.</span>
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data && !error && <p className="font-mono text-xs text-muted">Loading real astronaut data…</p>}

        {data && (
          <>
            {/* Astronaut selector */}
            <section aria-labelledby="i4-crew">
              <h2 id="i4-crew" className="mb-3"><Eyebrow index="03">Crew · {analyte} on day {firstPost}</Eyebrow></h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                {data.crew.map((c) => {
                  const s = seriesIndex.get(`${c.id}|${analyte}`);
                  const r1 = s?.points.find((p) => p.timepoint === firstPost) ?? null;
                  const selected = c.id === astronaut;
                  return (
                    <button key={c.id} onClick={() => setAstronaut(c.id)} aria-pressed={selected}
                      className={`card card-hover p-4 text-left sm:p-5 ${selected ? '!border-accent/70 ring-1 ring-accent/50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold tracking-[0.08em] text-fg">{c.id}</span>
                        <span className="eyebrow">{c.sex === 'F' ? 'female' : c.sex === 'M' ? 'male' : ''}</span>
                      </div>
                      <div className="mt-3 font-mono text-2xl font-semibold text-fg sm:text-3xl">
                        {fmt(r1?.value, 2)} <span className="text-xs font-normal text-muted">{s?.unit}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span className="text-muted">z {fmtZ(r1?.z)}</span>
                        {r1?.flagged && (
                          <span className="rounded-full border border-watch/40 bg-watch/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-watch">flagged</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Chart */}
            <Card className="space-y-4">
              <SectionHead
                index="04"
                label="Before vs after flight"
                title={<>{astronaut} <span className="text-muted">— {analyteMeta?.label ?? analyte}</span></>}
                right={
                  <label className="flex items-center gap-2 text-sm">
                    <span className="eyebrow">Blood test</span>
                    <select value={analyte} onChange={(e) => setAnalyte(e.target.value)} className="field !w-auto max-w-[16rem]">
                      {panels.map((p) => (
                        <optgroup key={p} label={data.source.panels[p] ?? p}>
                          {data.analytes.filter((a) => a.panel === p).map((a) => (
                            <option key={a.name} value={a.name}>{a.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                }
              />
              <p className="-mt-2 font-mono text-xs text-muted">
                {analyteMeta ? `${analyteMeta.panel} · ${data.source.panels[analyteMeta.panel] ?? ''} · ` : ''}lab name: {analyte}
              </p>

              {series ? (
                <>
                  <p className="-mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted md:hidden">Swipe the chart to see after-flight values →</p>
                  <div className="well overflow-x-auto p-3 sm:p-4">
                    <BaselineChart series={series} timepoints={data.timepoints}
                      refRange={analyteMeta?.reference_range ?? { low: null, high: null }} flagZ={data.method.flag_z} />
                  </div>
                  <ChartLegend
                    items={[
                      { kind: 'line', color: C.series1, label: 'Measured value (real)' },
                      { kind: 'band', color: C.band, label: 'Personal normal (from 3 pre-flight tests)' },
                      { kind: 'dash', color: C.muted, label: 'Lab normal range (same for everyone)' },
                      { kind: 'dot', color: FLAG, label: `Flagged: |z| > ${data.method.flag_z}` },
                      { kind: 'event', color: C.accent, label: 'Spaceflight' },
                    ]}
                    note="x-axis not to scale"
                  />
                  <p className="flex items-start gap-2 text-sm text-muted">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {data.method.plain_text} Personal normal for {astronaut}: <span className="font-mono text-fg">{fmt(series.baseline.mean, 2)} {series.unit}</span>
                      {series.baseline.sd_source === 'floor' ? ' (pre-flight tests were very close together, so a minimum spread was used).' : '.'}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">
                  No usable series for {astronaut} · {analyte} (fewer than 2 pre-flight values in the NASA file).
                </p>
              )}
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
              {/* What we found */}
              <Card className="space-y-4 !border-accent/25">
                <SectionHead index="05" label="What we found" />
                {sf ? (
                  <>
                    <p className="text-base font-medium leading-relaxed text-fg sm:text-lg">{sf.plain_text}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {sf.per_astronaut.map((p) => (
                        <button key={p.astronaut} onClick={() => { setAstronaut(p.astronaut); setAnalyte(sf.analyte); }}
                          className="well p-3 text-left transition hover:border-white/25">
                          <span className="block font-mono text-sm font-semibold text-fg">{p.astronaut}</span>
                          <span className="block font-mono text-xs text-soft">{fmt(p.baseline_mean, 1)} → {fmt(p.value, 1)} {sf.unit}</span>
                          <span className={`font-mono text-xs ${p.flagged ? 'text-watch' : 'text-muted'}`}>
                            {fmt(p.pct_change, 1, '%')} · z {fmtZ(p.z)}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-muted">{sf.sensitivity.plain_text}</p>
                    {(analyte !== sf.analyte) && (
                      <button onClick={() => setAnalyte(sf.analyte)} className="btn-primary">Show {sf.analyte} on the chart</button>
                    )}
                  </>
                ) : (
                  <p className="text-base text-soft">
                    No blood value changed in the same direction in every crew member one day after landing.
                  </p>
                )}

                {nc && (
                  <div className="well space-y-3 p-4">
                    <span className="eyebrow flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5" />Sanity check: how often do flags appear with no flight?</span>
                    {([
                      [`Before flight (${nc.control_timepoint} vs ${nc.control_baseline.join(' + ')})`, nc.control_flagged, nc.control_tests, nc.control_pct, 'bg-muted'],
                      [`After flight (${nc.flight_timepoint} vs all 3 pre-flight)`, nc.flight_flagged, nc.flight_tests, nc.flight_pct, 'bg-accent'],
                    ] as const).map(([label, f, n, pct, bar]) => (
                      <div key={label}>
                        <div className="flex justify-between gap-3 text-xs text-muted">
                          <span>{label}</span>
                          <span className="whitespace-nowrap font-mono text-fg">{f}/{n} · {fmt(pct, 0, '%')}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
                        </div>
                      </div>
                    ))}
                    <p className="text-sm leading-relaxed text-soft">{nc.plain_text}</p>
                    <p className="text-xs leading-relaxed text-muted">{nc.chance_note}</p>
                  </div>
                )}
              </Card>

              {/* Honest limits */}
              <Card className="space-y-4">
                <SectionHead index="06" label="Honest limits" />
                <ol className="space-y-4">
                  {data.limitations.map((l, i) => (
                    <li key={l.key} className="grid grid-cols-[auto_1fr] gap-3">
                      <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <span className="block text-sm font-semibold text-fg">{l.title}</span>
                        <span className="text-sm leading-relaxed text-muted">{l.text}</span>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="border-t border-line pt-3 font-mono text-[11px] leading-relaxed text-muted">{data.source.citation}</p>
              </Card>
            </div>

            <p className="border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-muted">
              <span className="text-real">REAL DATA · NASA OSDR</span> · {data.source.mission}. {data.source.license}; unmodified public files.
              Decision-support prototype, not a medical device.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
