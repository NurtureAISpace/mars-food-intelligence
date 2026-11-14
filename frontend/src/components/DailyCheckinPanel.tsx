/// <reference types="vite/client" />
import React, { useEffect, useState } from 'react';
import { fetchCheckinGuide, fetchCheckins, submitCheckin } from '../api';
import {
  CheckinColor,
  CheckinField,
  CheckinGuide,
  CheckinGuideIndicator,
  CheckinHistory,
  CheckinHistoryEntry,
  CheckinIndicatorKey,
  CheckinIndicatorResult,
  CheckinInput,
  CheckinResult,
  CheckinThreshold,
} from '../types';
import {
  Info, Flame, PhoneCall, Sprout, Sparkles, Send, CheckCircle2, AlertTriangle, Rocket, BellRing, ArrowUpRight,
} from 'lucide-react';
import { Card, SectionHead, TonePill } from '../ui/primitives';
import { C, StatusTone, TONE } from '../ui/tokens';
import { AXIS_TITLE, ChartLegend, TICK } from '../ui/chart';

// Offline-first Astronaut App (apps/astronaut). Override with VITE_ASTRONAUT_APP_URL at build time.
const ASTRONAUT_APP_URL: string = import.meta.env.VITE_ASTRONAUT_APP_URL ?? 'http://localhost:3001';

// Check-in colours map onto the shared status palette (NOMINAL / WATCH / ACT)
const COLOR_TONE: Record<CheckinColor, StatusTone> = { green: 'nominal', amber: 'watch', red: 'act' };
const COLOR_LABEL: Record<CheckinColor, string> = { green: 'GREEN', amber: 'AMBER', red: 'RED' };
const OVERALL_COLOR: Record<string, CheckinColor> = { NOMINAL: 'green', WATCH: 'amber', ACT: 'red' };

const CREW = ['CDR-01', 'PLT-02', 'MS-03', 'MS-04'];
const DEFAULT_SOL = 250;
const MOODS: Array<{ v: number; emoji: string; label: string }> = [
  { v: 1, emoji: '😞', label: 'Very low' },
  { v: 2, emoji: '🙁', label: 'Low' },
  { v: 3, emoji: '😐', label: 'Okay' },
  { v: 4, emoji: '🙂', label: 'Good' },
  { v: 5, emoji: '😄', label: 'Great' },
];

// Demo values for the live pitch: MS-03 on Sol 250 (thiamine forecast is in ACT in the mission scenario)
const DEMO: Omit<CheckinInput, 'astronaut_id' | 'sol'> = {
  heart_rate_bpm: 84,
  systolic_mmHg: 134,
  diastolic_mmHg: 86,
  blood_glucose_mg_dl: 96,
  body_temp_c: 37.3,
  sleep_hours: 5.5,
  mood_1_5: 2,
  notes: 'Noisy night, fan in sleep station.',
};

type FormState = Record<Exclude<CheckinField, 'mood_1_5'>, string> & { mood_1_5: number | null; notes: string };
const EMPTY_FORM: FormState = {
  heart_rate_bpm: '', systolic_mmHg: '', diastolic_mmHg: '', blood_glucose_mg_dl: '', body_temp_c: '', sleep_hours: '',
  mood_1_5: null, notes: '',
};

const NUMBER_FIELDS: Array<{ key: CheckinIndicatorKey; fields: Array<{ f: Exclude<CheckinField, 'mood_1_5'>; placeholder: string; step: string }> }> = [
  { key: 'heart_rate', fields: [{ f: 'heart_rate_bpm', placeholder: 'e.g. 64', step: '1' }] },
  { key: 'blood_pressure', fields: [
    { f: 'systolic_mmHg', placeholder: 'upper, e.g. 118', step: '1' },
    { f: 'diastolic_mmHg', placeholder: 'lower, e.g. 76', step: '1' },
  ] },
  { key: 'blood_glucose', fields: [{ f: 'blood_glucose_mg_dl', placeholder: 'fasting, e.g. 90', step: '1' }] },
  { key: 'body_temperature', fields: [{ f: 'body_temp_c', placeholder: 'e.g. 36.8', step: '0.1' }] },
  { key: 'sleep', fields: [{ f: 'sleep_hours', placeholder: 'e.g. 7.5', step: '0.25' }] },
];

const FIELDS_OF: Record<CheckinIndicatorKey, CheckinField[]> = {
  heart_rate: ['heart_rate_bpm'],
  blood_pressure: ['systolic_mmHg', 'diastolic_mmHg'],
  blood_glucose: ['blood_glucose_mg_dl'],
  body_temperature: ['body_temp_c'],
  sleep: ['sleep_hours'],
  mood: ['mood_1_5'],
};

// Series identity for the mini charts (BP has two: upper/lower)
const FIELD_SERIES: Partial<Record<CheckinField, { label: string; color: string; dashed?: boolean }>> = {
  systolic_mmHg: { label: 'Upper (systolic)', color: C.series1 },
  diastolic_mmHg: { label: 'Lower (diastolic)', color: C.series2, dashed: true },
};

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
const ColorPill: React.FC<{ color: CheckinColor; text?: string }> = ({ color, text }) => (
  <TonePill tone={COLOR_TONE[color]} pulse={color === 'red'}>{text ?? COLOR_LABEL[color]}</TonePill>
);

/** (i) icon with a hover / keyboard-focus "How to measure" popover. */
const InfoTip: React.FC<{ g?: CheckinGuideIndicator }> = ({ g }) => {
  if (!g) return null;
  return (
    <span className="group relative inline-flex" tabIndex={0} aria-label={`How to measure ${g.label}`}>
      <Info className="h-3.5 w-3.5 cursor-help text-muted hover:text-fg" />
      <span className="pointer-events-none absolute -left-2 top-5 z-30 hidden w-64 rounded-xl border border-white/15 bg-[#0E0F13] p-3 text-xs normal-case leading-relaxed text-soft shadow-2xl group-hover:block group-focus:block">
        <span className="eyebrow mb-1 block !text-accent">How to measure</span>
        {g.how_to_measure}
        <span className="mt-1.5 block font-mono text-[11px] text-muted">{g.range_text}</span>
      </span>
    </span>
  );
};

/** Green reference band for one field from its thresholds (values that are neither amber nor red). */
function greenBand(thresholds: CheckinThreshold[], field: CheckinField): [number | null, number | null] {
  const ts = thresholds.filter((t) => t.field === field && t.color === 'amber');
  const lows = ts.filter((t) => t.direction === 'below').map((t) => t.value);
  const highs = ts.filter((t) => t.direction === 'above').map((t) => t.value);
  return [lows.length ? Math.max(...lows) : null, highs.length ? Math.min(...highs) : null];
}

/** Mini SVG history chart: values per Sol, dots coloured by status, green band = reference range. */
const MiniHistoryChart: React.FC<{
  entries: CheckinHistoryEntry[];
  indicator: CheckinIndicatorKey;
  thresholds: CheckinThreshold[];
  unit?: string;
}> = ({ entries, indicator, thresholds, unit }) => {
  const W = 280, H = 104, L = 34, R = 8, T = 8, B = 28;
  const fields = FIELDS_OF[indicator];
  const pts = entries.slice(-30);
  if (pts.length === 0) {
    return <div className="flex h-[96px] items-center justify-center font-mono text-[11px] text-muted">No history yet</div>;
  }
  const vals = pts.flatMap((e) => fields.map((f) => e[f] as number));
  const bands = fields.map((f) => greenBand(thresholds, f));
  const bandVals = bands.flat().filter((v): v is number => v !== null);
  let lo = Math.min(...vals, ...bandVals);
  let hi = Math.max(...vals, ...bandVals);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1;
  lo -= pad; hi += pad;
  const s0 = pts[0].sol, s1 = pts[pts.length - 1].sol;
  const sx = (s: number) => (s1 === s0 ? (L + W - R) / 2 : L + ((s - s0) / (s1 - s0)) * (W - L - R));
  const sy = (v: number) => H - B - ((v - lo) / (hi - lo)) * (H - T - B);
  const multi = fields.length > 1;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${indicator} history`}>
        {bands.map(([b0, b1], i) => (
          <rect key={i} x={L} width={W - L - R}
            y={sy(b1 ?? hi)} height={Math.max(1, sy(b0 ?? lo) - sy(b1 ?? hi))} fill={C.band} opacity={0.07} />
        ))}
        {[lo + pad, hi - pad].map((v) => (
          <g key={v}>
            <line x1={L} y1={sy(v)} x2={W - R} y2={sy(v)} stroke={C.grid} />
            <text x={L - 5} y={sy(v) + 3.5} textAnchor="end" {...TICK} fontSize={9.5}>
              {Math.abs(v) >= 20 ? v.toFixed(0) : v.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={L} y={H - 13} {...TICK} fontSize={9.5}>Sol {s0}</text>
        {s1 !== s0 && <text x={W - R} y={H - 13} textAnchor="end" {...TICK} fontSize={9.5}>Sol {s1}</text>}
        <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" {...AXIS_TITLE} fontSize={9}>
          SOL{unit ? ` · ${unit.toUpperCase()}` : ''}
        </text>
        {fields.map((f) => {
          const s = FIELD_SERIES[f] ?? { color: C.series1 };
          return (
            <g key={f}>
              {pts.length > 1 && (
                <path fill="none" stroke={s.color} strokeWidth="1.5" opacity={0.85} strokeLinejoin="round"
                  strokeDasharray={'dashed' in s && s.dashed ? '4 3' : undefined}
                  d={pts.map((e, i) => `${i ? 'L' : 'M'} ${sx(e.sol).toFixed(1)} ${sy(e[f] as number).toFixed(1)}`).join(' ')} />
              )}
              {pts.map((e) => {
                const hex = TONE[COLOR_TONE[e.colors?.[indicator] ?? 'green']].hex;
                return (
                  <g key={`${f}-${e.sol}`}>
                    <circle cx={sx(e.sol)} cy={sy(e[f] as number)} r={5.5} fill={hex} opacity={0.18} />
                    <circle cx={sx(e.sol)} cy={sy(e[f] as number)} r={2.6} fill={hex} stroke={C.ink} strokeWidth="1">
                      <title>{`Sol ${e.sol}: ${e[f]}`}</title>
                    </circle>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {multi && (
        <ChartLegend items={fields.map((f) => {
          const s = FIELD_SERIES[f]!;
          return { kind: s.dashed ? 'dash' : 'line', color: s.color, label: s.label };
        })} />
      )}
    </div>
  );
};

const ResultCard: React.FC<{ r: CheckinIndicatorResult; history: CheckinHistoryEntry[] }> = ({ r, history }) => {
  const t = TONE[COLOR_TONE[r.status_color]];
  const esc = r.guidance.escalate_to_flight_surgeon;
  const assumed = r.reference.thresholds.some((x) => x.status === 'assumed');
  return (
    <div className={`well space-y-3 p-4 ${t.border}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="eyebrow block">{r.label}</span>
          <span className={`font-mono text-2xl font-semibold ${t.text}`}>{r.display_value}</span>
        </div>
        <ColorPill color={r.status_color} />
      </div>
      <p className="text-sm leading-relaxed text-soft">{r.meaning}</p>
      <div className="rounded-lg border border-line bg-white/[0.02] px-3 py-2">
        <span className="eyebrow block !text-accent">What to do</span>
        <span className="text-sm text-fg">{r.guidance.what_to_do}</span>
      </div>
      {esc.required && (
        <div className="flex items-start gap-2 text-sm text-act">
          <PhoneCall className="mt-0.5 h-4 w-4 shrink-0" /><span className="text-fg">{esc.reason}</span>
        </div>
      )}
      <div className={`flex items-start gap-2 text-xs ${r.personal_baseline.flag ? 'text-watch' : 'text-muted'}`}>
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className={r.personal_baseline.flag ? 'text-fg' : ''}>{r.personal_baseline.message}</span>
      </div>
      <MiniHistoryChart entries={history} indicator={r.key} thresholds={r.reference.thresholds} unit={r.unit} />
      <div className="space-y-1 text-xs leading-relaxed text-muted">
        <span className="flex items-start gap-1.5">
          <Rocket className="mt-0.5 h-3 w-3 shrink-0" /><span>{r.guidance.why_it_matters_in_space}</span>
        </span>
        <span className="block font-mono text-[11px]">
          {r.reference.range_text} · Source: {r.reference.sources.filter((x) => x.id !== 'MODEL_ASSUMPTION').map((x) => x.id).join(', ') || '—'}
          {assumed && <span className="text-watch"> · some cut-offs assumed</span>}
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export const DailyCheckinPanel: React.FC<{ index?: string }> = ({ index }) => {
  const [guide, setGuide] = useState<CheckinGuide | null>(null);
  const [astronaut, setAstronaut] = useState<string>('MS-03');
  const [sol, setSol] = useState<number>(DEFAULT_SOL);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [history, setHistory] = useState<CheckinHistory | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCheckinGuide().then(setGuide).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    fetchCheckins(astronaut)
      .then((h) => {
        if (cancelled) return;
        setHistory(h);
        setSol(h.streak.last_sol !== null ? h.streak.last_sol + 1 : DEFAULT_SOL);
      })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [astronaut]);

  const g = (k: CheckinIndicatorKey) => guide?.indicators.find((i) => i.key === k);
  const limits = guide?.input_limits;
  const doneThisSol = history?.checkins.some((c) => c.sol === sol) ?? false;
  const streakN = result?.streak.current_sols ?? history?.streak.current_sols ?? 0;

  const loadDemo = () => {
    setForm({
      heart_rate_bpm: String(DEMO.heart_rate_bpm), systolic_mmHg: String(DEMO.systolic_mmHg),
      diastolic_mmHg: String(DEMO.diastolic_mmHg), blood_glucose_mg_dl: String(DEMO.blood_glucose_mg_dl),
      body_temp_c: String(DEMO.body_temp_c), sleep_hours: String(DEMO.sleep_hours),
      mood_1_5: DEMO.mood_1_5, notes: DEMO.notes ?? '',
    });
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = NUMBER_FIELDS.flatMap((n) => n.fields).filter(({ f }) => form[f].trim() === '');
    if (missing.length || form.mood_1_5 === null) {
      setError('Please fill in every measurement and pick a mood.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: CheckinInput = {
        astronaut_id: astronaut, sol,
        heart_rate_bpm: Number(form.heart_rate_bpm), systolic_mmHg: Number(form.systolic_mmHg),
        diastolic_mmHg: Number(form.diastolic_mmHg), blood_glucose_mg_dl: Number(form.blood_glucose_mg_dl),
        body_temp_c: Number(form.body_temp_c), sleep_hours: Number(form.sleep_hours), mood_1_5: form.mood_1_5,
        notes: form.notes.trim() || null,
      };
      const r = await submitCheckin(payload);
      setResult(r);
      setHistory(await fetchCheckins(astronaut));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const overallColor = result ? OVERALL_COLOR[result.overall.status] : null;
  const overallTone = overallColor ? TONE[COLOR_TONE[overallColor]] : null;
  const entries = history?.checkins ?? [];

  return (
    <Card className="space-y-5">
      <SectionHead
        index={index}
        label="Daily check-in"
        title="How is the crew today?"
        right={
          <>
            <select value={astronaut} onChange={(e) => setAstronaut(e.target.value)} aria-label="Astronaut"
              className="field !w-auto !rounded-full !py-1.5 font-mono">
              {CREW.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 font-mono text-xs text-muted">
              SOL
              <input type="number" min={0} max={1000} value={sol} onChange={(e) => setSol(Math.max(0, Number(e.target.value)))}
                className="field !w-24 !rounded-full !py-1.5 font-mono font-semibold !text-accent" />
            </label>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-xs text-fg">
              <Flame className="h-3.5 w-3.5 text-accent" />
              Streak <span className="font-semibold text-accent">{streakN}</span> sol{streakN === 1 ? '' : 's'}
            </span>
            <a href={ASTRONAUT_APP_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-1.5 text-xs">
              Open Astronaut App <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </>
        }
      />
      <p className="-mt-2 text-sm text-muted">
        Measure, enter, and get a colour-coded answer: <span className="text-nominal">green</span> = fine,{' '}
        <span className="text-watch">amber</span> = look after yourself, <span className="text-act">red</span> = contact the flight surgeon.
      </p>

      {/* Routine reminder */}
      <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${doneThisSol
        ? 'border-nominal/30 bg-nominal/[0.06]' : 'border-white/15 bg-white/[0.03]'}`}>
        {doneThisSol ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-nominal" /> : <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
        <span className="text-fg">
          {doneThisSol ? `Sol ${sol} check-in done. Submitting again replaces it.` : `Sol ${sol} check-in is due.`}{' '}
          <span className="text-muted">{guide?.routine.when}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          {NUMBER_FIELDS.map(({ key, fields }) => {
            const gi = g(key);
            return (
              <div key={key}>
                <div className="mb-1.5 flex items-center gap-1.5 text-sm text-soft">
                  <span>{gi?.label ?? key}</span>
                  <span className="font-mono text-xs text-muted">{gi?.unit}</span>
                  <InfoTip g={gi} />
                </div>
                <div className={`grid gap-2 ${fields.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {fields.map(({ f, placeholder, step }) => (
                    <input key={f} type="number" inputMode="decimal" step={step} placeholder={placeholder}
                      min={limits?.[f].min} max={limits?.[f].max} value={form[f]}
                      onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                      aria-label={f}
                      className="field font-mono" />
                  ))}
                </div>
              </div>
            );
          })}
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-sm text-soft">
              <span>{g('mood')?.label ?? 'Mood'}</span><InfoTip g={g('mood')} />
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {MOODS.map((m) => (
                <button type="button" key={m.v} onClick={() => setForm({ ...form, mood_1_5: m.v })} title={m.label}
                  aria-pressed={form.mood_1_5 === m.v}
                  className={`rounded-xl border py-2 text-lg transition ${form.mood_1_5 === m.v
                    ? 'border-accent bg-accent/15 ring-1 ring-accent/50' : 'border-white/10 bg-black/30 hover:border-white/25'}`}>
                  <span>{m.emoji}</span>
                  <span className="block text-[10px] text-muted">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} rows={2}
            placeholder="Notes (optional): symptoms, events, how you feel" aria-label="Notes"
            className="field" />

          <div className="flex gap-2">
            <button type="button" onClick={loadDemo} className="btn-ghost flex-1">Load demo values</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              <Send className="h-4 w-4" />{submitting ? 'Checking…' : 'Submit check-in'}
            </button>
          </div>
          {error && (
            <div role="alert" className="rounded-xl border border-act/40 bg-act/10 px-3 py-2 text-sm text-fg">{error}</div>
          )}
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            {guide?.disclaimer ?? 'Decision-support prototype, not a medical device.'}
          </p>
        </form>

        {/* Results */}
        <div className="space-y-4">
          {result && overallColor && overallTone ? (
            <>
              <div className={`well reveal p-5 ${overallTone.border} ${overallColor === 'red' ? 'glow-act' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`flex items-center gap-2 font-display text-xl font-bold tracking-display ${overallTone.text}`}>
                    {result.overall.contact_flight_surgeon ? <PhoneCall className="h-5 w-5" />
                      : result.overall.status === 'WATCH' ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    <span>{result.overall.contact_flight_surgeon ? 'CONTACT FLIGHT SURGEON' : result.overall.headline}</span>
                  </span>
                  <ColorPill color={overallColor} text={result.overall.status} />
                </div>
                {result.overall.contact_flight_surgeon && (
                  <p className="mt-1 text-base text-fg">{result.overall.headline}</p>
                )}
                <p className="mt-2 text-sm text-soft">{result.overall.what_to_do}</p>
                {result.overall.reasons.length > 0 && (
                  <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-muted">
                    {result.overall.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                )}
                <p className="mt-3 font-mono text-[11px] text-muted">{result.next_checkin}</p>
              </div>

              {result.nutrition_link?.active && (
                <div className="flex items-start gap-2.5 rounded-xl border border-nominal/25 bg-nominal/[0.06] px-4 py-3 text-sm">
                  <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-nominal" />
                  <span className="text-fg">
                    {result.nutrition_link.message}
                    <span className="block font-mono text-[11px] text-muted">{result.nutrition_link.source}, Sol {result.nutrition_link.scenario_sol}</span>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {result.indicators.map((r) => <ResultCard key={r.key} r={r} history={entries} />)}
              </div>
              {result.baseline_history.synthetic_note && (
                <p className="font-mono text-[11px] text-muted">{result.baseline_history.synthetic_note}</p>
              )}
            </>
          ) : (
            <>
              <div className="well space-y-2 p-5 text-sm text-soft">
                <span className="eyebrow block !text-accent">How it works</span>
                <p><span className="font-mono text-accent">01</span> Measure on waking, in this order: sleep, mood, temperature, pulse, blood pressure, blood sugar. Tap (i) for instructions.</p>
                <p><span className="font-mono text-accent">02</span> Each value is compared with a published adult reference range (colour) and with <i>your own</i> normal from earlier check-ins.</p>
                <p><span className="font-mono text-accent">03</span> You get a plain answer: what it means, what to do, and whether to contact the flight surgeon.</p>
              </div>
              {entries.length > 0 && guide && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {guide.indicators.map((gi) => (
                    <div key={gi.key} className="well p-3">
                      <span className="text-sm font-semibold text-fg">{gi.label}</span>
                      <MiniHistoryChart entries={entries} indicator={gi.key} thresholds={gi.thresholds} unit={gi.unit} />
                    </div>
                  ))}
                </div>
              )}
              {entries.length > 0 && (
                <p className="text-xs text-muted">Dots are coloured by that day's status; the green band is the reference range.</p>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

