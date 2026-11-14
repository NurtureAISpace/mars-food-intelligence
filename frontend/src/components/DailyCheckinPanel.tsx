/// <reference types="vite/client" />
import React, { useEffect, useState } from 'react';
import { fetchCheckinGuide, fetchCheckins, submitCheckin } from '../api';

// Offline-first Astronaut App (apps/astronaut). Override with VITE_ASTRONAUT_APP_URL at build time.
const ASTRONAUT_APP_URL: string = import.meta.env.VITE_ASTRONAUT_APP_URL ?? 'http://localhost:3001';
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
  ClipboardCheck, Info, Flame, PhoneCall, Sprout, Sparkles, Send, CheckCircle2, AlertTriangle, Rocket, BellRing,
} from 'lucide-react';

// Same palette as the Crew Health status pills (emerald / amber / red)
const COLOR_STYLE: Record<CheckinColor, { text: string; bg: string; border: string; dot: string; hex: string; label: string }> = {
  green: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400', hex: '#34d399', label: 'GREEN' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', dot: 'bg-amber-400', hex: '#fbbf24', label: 'AMBER' },
  red: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', dot: 'bg-red-500', hex: '#f87171', label: 'RED' },
};
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

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
const ColorPill: React.FC<{ color: CheckinColor; text?: string }> = ({ color, text }) => {
  const s = COLOR_STYLE[color];
  return (
    <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${s.bg} ${s.border} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${color === 'red' ? 'animate-pulse' : ''}`} />
      <span>{text ?? s.label}</span>
    </span>
  );
};

/** (i) icon with a hover / keyboard-focus "How to measure" popover. */
const InfoTip: React.FC<{ g?: CheckinGuideIndicator }> = ({ g }) => {
  if (!g) return null;
  return (
    <span className="relative group inline-flex" tabIndex={0} aria-label={`How to measure ${g.label}`}>
      <Info className="w-3.5 h-3.5 text-cyan-400 cursor-help" />
      <span className="pointer-events-none absolute -left-2 top-5 z-30 hidden group-hover:block group-focus:block w-64 p-2.5 rounded-lg bg-mars-dark border border-mars-border shadow-xl text-[10px] leading-relaxed text-slate-300 font-mono normal-case">
        <span className="block text-cyan-400 font-bold mb-1">HOW TO MEASURE</span>
        {g.how_to_measure}
        <span className="block text-slate-500 mt-1.5">{g.range_text}</span>
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

/** Mini SVG history chart (same visual language as the Crew Health charts): values per Sol, dots coloured by status. */
const MiniHistoryChart: React.FC<{
  entries: CheckinHistoryEntry[];
  indicator: CheckinIndicatorKey;
  thresholds: CheckinThreshold[];
}> = ({ entries, indicator, thresholds }) => {
  const W = 260, H = 84, L = 30, R = 8, T = 8, B = 16;
  const fields = FIELDS_OF[indicator];
  const pts = entries.slice(-30);
  if (pts.length === 0) {
    return <div className="h-[84px] flex items-center justify-center text-[10px] text-slate-500 font-mono">No history yet</div>;
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
  const lineColors = ['#f59e0b', '#06b6d4'];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {bands.map(([b0, b1], i) => (
        <rect key={i} x={L} width={W - L - R}
          y={sy(b1 ?? hi)} height={Math.max(1, sy(b0 ?? lo) - sy(b1 ?? hi))} fill="#10b981" opacity={0.08} />
      ))}
      {[lo + pad, hi - pad].map((v) => (
        <g key={v}>
          <line x1={L} y1={sy(v)} x2={W - R} y2={sy(v)} stroke="#1f2e4d" strokeDasharray="3 3" />
          <text x={L - 4} y={sy(v) + 3} textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">
            {Math.abs(v) >= 20 ? v.toFixed(0) : v.toFixed(1)}
          </text>
        </g>
      ))}
      <text x={L} y={H - 3} fill="#64748b" fontSize="8" fontFamily="monospace">Sol {s0}</text>
      {s1 !== s0 && <text x={W - R} y={H - 3} textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">Sol {s1}</text>}
      {fields.map((f, fi) => (
        <g key={f}>
          {pts.length > 1 && (
            <path fill="none" stroke={lineColors[fi]} strokeWidth="1.5" opacity={0.7} strokeLinejoin="round"
              d={pts.map((e, i) => `${i ? 'L' : 'M'} ${sx(e.sol).toFixed(1)} ${sy(e[f] as number).toFixed(1)}`).join(' ')} />
          )}
          {pts.map((e) => (
            <circle key={`${f}-${e.sol}`} cx={sx(e.sol)} cy={sy(e[f] as number)} r="2.8"
              fill={COLOR_STYLE[e.colors?.[indicator] ?? 'green'].hex} stroke="#080c14" strokeWidth="1" />
          ))}
        </g>
      ))}
    </svg>
  );
};

const ResultCard: React.FC<{ r: CheckinIndicatorResult; history: CheckinHistoryEntry[] }> = ({ r, history }) => {
  const s = COLOR_STYLE[r.status_color];
  const esc = r.guidance.escalate_to_flight_surgeon;
  const assumed = r.reference.thresholds.some((t) => t.status === 'assumed');
  return (
    <div className={`p-4 rounded-xl border font-mono text-xs space-y-2.5 ${s.bg} ${s.border}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-slate-400 text-[10px] uppercase block">{r.label}</span>
          <span className={`text-lg font-bold ${s.text}`}>{r.display_value}</span>
        </div>
        <ColorPill color={r.status_color} />
      </div>
      <p className="text-slate-200 leading-relaxed">{r.meaning}</p>
      <div className="p-2 rounded-lg bg-mars-dark/70 border border-mars-border">
        <span className="text-orange-400 font-bold text-[10px] uppercase block">What to do</span>
        <span className="text-slate-200">{r.guidance.what_to_do}</span>
      </div>
      {esc.required && (
        <div className="flex items-start space-x-2 text-[11px] text-red-300">
          <PhoneCall className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{esc.reason}</span>
        </div>
      )}
      <div className={`flex items-start space-x-2 text-[10px] ${r.personal_baseline.flag ? 'text-amber-300' : 'text-slate-400'}`}>
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{r.personal_baseline.message}</span>
      </div>
      <MiniHistoryChart entries={history} indicator={r.key} thresholds={r.reference.thresholds} />
      <div className="text-[10px] text-slate-500 leading-relaxed">
        <span className="flex items-start space-x-1.5">
          <Rocket className="w-3 h-3 mt-0.5 shrink-0 text-cyan-400" /><span>{r.guidance.why_it_matters_in_space}</span>
        </span>
        <span className="block mt-1">
          {r.reference.range_text} · Source: {r.reference.sources.filter((x) => x.id !== 'MODEL_ASSUMPTION').map((x) => x.id).join(', ') || '—'}
          {assumed && <span className="text-amber-500/80"> · some cut-offs assumed</span>}
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export const DailyCheckinPanel: React.FC = () => {
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
  const entries = history?.checkins ?? [];

  return (
    <div className="glass-panel rounded-xl p-5 border border-mars-border space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-mars-border pb-3 font-mono">
        <div>
          <h3 className="font-bold text-white text-sm uppercase flex items-center space-x-2">
            <ClipboardCheck className="w-4 h-4 text-orange-400" /><span>Daily Check-in</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Measure, enter, and get a colour-coded answer: green = fine, amber = look after yourself, red = contact the flight surgeon.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={astronaut} onChange={(e) => setAstronaut(e.target.value)}
            className="bg-mars-dark border border-mars-border rounded px-2 py-1 text-white">
            {CREW.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center space-x-1.5 text-slate-300">
            <span>Sol</span>
            <input type="number" min={0} max={1000} value={sol} onChange={(e) => setSol(Math.max(0, Number(e.target.value)))}
              className="w-20 bg-mars-dark border border-mars-border rounded px-2 py-1 text-orange-400 font-bold" />
          </label>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded border border-orange-500/40 bg-orange-500/10 text-orange-300 font-bold">
            <Flame className="w-3.5 h-3.5" />
            <span>Check-in streak: {streakN} sol{streakN === 1 ? '' : 's'}</span>
          </span>
          <a href={ASTRONAUT_APP_URL} target="_blank" rel="noopener noreferrer"
            className="px-2.5 py-1 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-bold hover:bg-cyan-500/20">
            Open Astronaut App ↗
          </a>
        </div>
      </div>

      {/* Routine reminder */}
      <div className={`flex items-start space-x-2 p-2.5 rounded-lg border text-[11px] font-mono ${doneThisSol
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'}`}>
        {doneThisSol ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <BellRing className="w-4 h-4 shrink-0" />}
        <span>
          {doneThisSol ? `Sol ${sol} check-in done. Submitting again replaces it.` : `Sol ${sol} check-in is due.`}{' '}
          <span className="text-slate-400">{guide?.routine.when}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <form onSubmit={submit} className="space-y-3 font-mono text-xs">
          {NUMBER_FIELDS.map(({ key, fields }) => {
            const gi = g(key);
            return (
              <div key={key}>
                <div className="flex items-center space-x-1.5 mb-1 text-slate-300">
                  <span>{gi?.label ?? key}</span>
                  <span className="text-slate-500">({gi?.unit})</span>
                  <InfoTip g={gi} />
                </div>
                <div className={`grid gap-2 ${fields.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {fields.map(({ f, placeholder, step }) => (
                    <input key={f} type="number" inputMode="decimal" step={step} placeholder={placeholder}
                      min={limits?.[f].min} max={limits?.[f].max} value={form[f]}
                      onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                      aria-label={f}
                      className="w-full bg-mars-dark border border-mars-border rounded px-2.5 py-1.5 text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none" />
                  ))}
                </div>
              </div>
            );
          })}

          <div>
            <div className="flex items-center space-x-1.5 mb-1 text-slate-300">
              <span>{g('mood')?.label ?? 'Mood'}</span><InfoTip g={g('mood')} />
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {MOODS.map((m) => (
                <button type="button" key={m.v} onClick={() => setForm({ ...form, mood_1_5: m.v })} title={m.label}
                  aria-pressed={form.mood_1_5 === m.v}
                  className={`py-1.5 rounded border text-lg transition-all ${form.mood_1_5 === m.v
                    ? 'border-orange-500 bg-orange-500/20 ring-1 ring-orange-500/60' : 'border-mars-border bg-mars-dark hover:border-orange-400/60'}`}>
                  <span>{m.emoji}</span>
                  <span className="block text-[9px] text-slate-400">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} rows={2}
            placeholder="Notes (optional): symptoms, events, how you feel"
            className="w-full bg-mars-dark border border-mars-border rounded px-2.5 py-1.5 text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none" />

          <div className="flex gap-2">
            <button type="button" onClick={loadDemo}
              className="flex-1 px-3 py-2 rounded border border-mars-border bg-mars-dark text-slate-300 hover:text-white hover:border-orange-400/60">
              Load demo values
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded bg-orange-500 text-white font-bold shadow-md shadow-orange-500/25 hover:bg-orange-600 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" /><span>{submitting ? 'Checking…' : 'Submit check-in'}</span>
            </button>
          </div>
          {error && (
            <div className="p-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-[11px]">{error}</div>
          )}
          <p className="text-[10px] text-slate-500">{guide?.disclaimer ?? 'Decision-support prototype, not a medical device.'}</p>
        </form>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {result && overallColor ? (
            <>
              <div className={`p-4 rounded-xl border font-mono ${COLOR_STYLE[overallColor].bg} ${COLOR_STYLE[overallColor].border}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex items-center space-x-2 font-bold text-sm ${COLOR_STYLE[overallColor].text}`}>
                    {result.overall.contact_flight_surgeon ? <PhoneCall className="w-5 h-5" />
                      : result.overall.status === 'WATCH' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    <span>{result.overall.contact_flight_surgeon ? 'CONTACT FLIGHT SURGEON' : result.overall.headline}</span>
                  </span>
                  <ColorPill color={overallColor} text={result.overall.status} />
                </div>
                {result.overall.contact_flight_surgeon && (
                  <p className="text-sm text-white mt-1">{result.overall.headline}</p>
                )}
                <p className="text-xs text-slate-200 mt-1.5">{result.overall.what_to_do}</p>
                {result.overall.reasons.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[11px] text-slate-300 list-disc list-inside">
                    {result.overall.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                )}
                <p className="text-[10px] text-slate-500 mt-2">{result.next_checkin}</p>
              </div>

              {result.nutrition_link?.active && (
                <div className="flex items-start space-x-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-mono text-emerald-300">
                  <Sprout className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {result.nutrition_link.message}
                    <span className="block text-[10px] text-slate-500">{result.nutrition_link.source}, Sol {result.nutrition_link.scenario_sol}</span>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {result.indicators.map((r) => <ResultCard key={r.key} r={r} history={entries} />)}
              </div>
              {result.baseline_history.synthetic_note && (
                <p className="text-[10px] font-mono text-slate-500">{result.baseline_history.synthetic_note}</p>
              )}
            </>
          ) : (
            <>
              <div className="p-4 rounded-xl border border-mars-border bg-mars-dark/60 font-mono text-xs text-slate-300 space-y-1.5">
                <span className="text-orange-400 font-bold uppercase text-[11px] block">How it works</span>
                <p>1. Measure on waking, in this order: sleep, mood, temperature, pulse, blood pressure, blood sugar. Tap (i) for instructions.</p>
                <p>2. Each value is compared with a published adult reference range (colour) and with <i>your own</i> normal from earlier check-ins.</p>
                <p>3. You get a plain answer: what it means, what to do, and whether to contact the flight surgeon.</p>
              </div>
              {entries.length > 0 && guide && (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {guide.indicators.map((gi) => (
                    <div key={gi.key} className="bg-mars-dark/90 rounded-lg p-2.5 border border-mars-border">
                      <span className="text-[10px] font-mono font-bold text-white uppercase">{gi.label}</span>
                      <MiniHistoryChart entries={entries} indicator={gi.key} thresholds={gi.thresholds} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
