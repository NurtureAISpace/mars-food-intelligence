import { useMemo, useState } from 'react';
import type { Field, Guide, GuideIndicator, NumberField } from '../types';
import { roundTo, stepperSeed } from '../provisional';
import { clampSol, parseSol, stepSol } from '../sol';

export type FormValues = Record<Field, number> & { sol: number; notes: string | null };

const MOODS = [
  { v: 1, emoji: '😞', label: 'Very low' },
  { v: 2, emoji: '🙁', label: 'Low' },
  { v: 3, emoji: '😐', label: 'Okay' },
  { v: 4, emoji: '🙂', label: 'Good' },
  { v: 5, emoji: '😄', label: 'Great' },
];

const STEP: Record<NumberField, number> = {
  heart_rate_bpm: 1, systolic_mmHg: 1, diastolic_mmHg: 1, blood_glucose_mg_dl: 1, body_temp_c: 0.1, sleep_hours: 0.5,
};
const SUB_LABEL: Partial<Record<NumberField, string>> = {
  systolic_mmHg: 'Systolic (upper)',
  diastolic_mmHg: 'Diastolic (lower)',
};

type Raw = Record<NumberField, string>;
const EMPTY: Raw = {
  heart_rate_bpm: '', systolic_mmHg: '', diastolic_mmHg: '', blood_glucose_mg_dl: '', body_temp_c: '', sleep_hours: '',
};

function Stepper({ field, label, value, guide, last, onChange }: {
  field: NumberField; label?: string; value: string; guide: Guide; last?: number; onChange: (v: string) => void;
}) {
  const step = STEP[field];
  const lim = guide.input_limits[field];
  const bump = (dir: 1 | -1) => {
    const cur = Number(value);
    // empty field: start from your last value, else the centre of the guide's green band
    const base = value.trim() === '' || Number.isNaN(cur) ? (last ?? stepperSeed(guide, field, step)) : cur + dir * step;
    const clamped = lim ? Math.min(lim.max, Math.max(lim.min, base)) : base;
    onChange(String(roundTo(clamped, step)));
  };
  return (
    <div>
      {label && <div className="text-base text-slate-300 mb-1">{label}</div>}
      <div className="flex items-stretch gap-2">
        <button type="button" onClick={() => bump(-1)} aria-label={`decrease ${field}`}
          className="w-16 min-h-16 rounded-xl bg-slate-950/60 border border-slate-600 text-3xl text-white active:bg-white/10">−</button>
        <input value={value} onChange={(e) => onChange(e.target.value.replace(',', '.'))} inputMode="decimal"
          aria-label={label ?? field} placeholder={last !== undefined ? `last ${last}` : '—'}
          className="flex-1 min-w-0 min-h-16 rounded-xl bg-slate-950/60 border border-slate-600 text-center text-3xl font-mono text-white placeholder:text-slate-500 placeholder:text-lg focus:border-indigo-400 focus:outline-none" />
        <button type="button" onClick={() => bump(1)} aria-label={`increase ${field}`}
          className="w-16 min-h-16 rounded-xl bg-slate-950/60 border border-slate-600 text-3xl text-white active:bg-white/10">+</button>
      </div>
    </div>
  );
}

function IndicatorCard({ ind, children }: { ind: GuideIndicator; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl text-white font-semibold">{ind.label} <span className="text-slate-400 font-normal text-lg">({ind.unit})</span></div>
          <div className="text-base text-slate-300">{ind.range_text}</div>
        </div>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="shrink-0 min-h-11 px-4 rounded-xl border border-slate-400/50 text-base text-slate-200 active:bg-white/10">How?</button>
      </div>
      {open && <p className="text-base leading-relaxed text-slate-200 bg-slate-950/50 rounded-xl p-3">{ind.how_to_measure}</p>}
      {children}
    </div>
  );
}

export function CheckinForm({ guide, guideFetchedAt, defaultSol, takenSols, last, onSubmit }: {
  guide: Guide;
  guideFetchedAt: string | null;
  defaultSol: number;
  takenSols: Set<number>;
  last?: Partial<Record<Field, number>>;
  onSubmit: (v: FormValues) => Promise<void>;
}) {
  const [raw, setRaw] = useState<Raw>(EMPTY);
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [solText, setSolText] = useState<string>(String(clampSol(defaultSol)));
  const solParsed = parseSol(solText);
  const sol = solParsed.ok ? solParsed.sol : NaN;
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Order as in the guide's routine (measure on waking: sleep, mood, temperature, pulse, BP, sugar)
  // (routine.order names either the indicator key, e.g. "blood_pressure", or its field, e.g. "sleep_hours")
  const ordered = useMemo(() => {
    const order = guide.routine.order;
    const pos = (i: GuideIndicator) => {
      const hits = [i.key, ...i.fields].map((k) => order.indexOf(k)).filter((n) => n >= 0);
      return hits.length ? Math.min(...hits) : order.length;
    };
    return [...guide.indicators].sort((a, b) => pos(a) - pos(b));
  }, [guide]);
  const label = (f: Field) => guide.indicators.find((i) => i.fields.includes(f))?.label ?? f;

  const validate = (): FormValues | null => {
    const errs: string[] = [];
    const out: Partial<FormValues> = {};
    for (const f of Object.keys(EMPTY) as NumberField[]) {
      const s = raw[f].trim();
      const v = Number(s);
      const lim = guide.input_limits[f];
      if (s === '' || Number.isNaN(v)) errs.push(`${SUB_LABEL[f] ?? label(f)}: enter a number.`);
      else if (lim && (v < lim.min || v > lim.max)) errs.push(`${SUB_LABEL[f] ?? label(f)}: must be ${lim.min}–${lim.max}.`);
      else out[f] = v;
    }
    if (out.systolic_mmHg !== undefined && out.diastolic_mmHg !== undefined && out.diastolic_mmHg >= out.systolic_mmHg) {
      errs.push('Blood pressure: the lower number must be below the upper number.');
    }
    if (mood === null) errs.push('Mood: pick one.');
    if (!solParsed.ok) errs.push(solParsed.error);
    setErrors(errs);
    if (errs.length) return null;
    return { ...(out as Record<NumberField, number>), mood_1_5: mood as number, sol, notes: notes.trim() || null };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (!v) return;
    setBusy(true);
    try {
      await onSubmit(v);
    } catch (err) {
      setErrors([`Could not save on this device: ${(err as Error).message}`]);
    } finally {
      setBusy(false);
    }
  };

  const set = (f: NumberField) => (v: string) => setRaw((r) => ({ ...r, [f]: v }));

  return (
    <form onSubmit={submit} className="px-4 py-6 space-y-4" noValidate>
      <div className="glass p-5 space-y-4">
        <div>
          <h1 className="text-3xl font-light text-white">Daily check-in</h1>
          {takenSols.has(sol)
            ? <p className="text-lg text-amber-300 mt-1">You already have a check-in for this Sol; the server keeps the latest.</p>
            : <p className="text-lg text-slate-300 mt-1">{guide.routine.when}</p>}
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="sol" className="text-xl font-semibold text-white">Sol</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSolText(stepSol(solText, -1, clampSol(defaultSol)))} aria-label="previous Sol"
              className="w-14 min-h-14 rounded-xl bg-slate-950/60 border border-slate-600 text-2xl text-white active:bg-white/10">−</button>
            <input id="sol" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={4}
              value={solText} onChange={(e) => setSolText(e.target.value)}
              aria-invalid={!solParsed.ok} aria-describedby={solParsed.ok ? undefined : 'sol-error'}
              className={`w-24 min-h-14 rounded-xl bg-slate-950/60 border text-center text-3xl font-mono text-white focus:outline-none ${
                solParsed.ok ? 'border-slate-600 focus:border-indigo-400' : 'border-red-400'}`} />
            <button type="button" onClick={() => setSolText(stepSol(solText, 1, clampSol(defaultSol)))} aria-label="next Sol"
              className="w-14 min-h-14 rounded-xl bg-slate-950/60 border border-slate-600 text-2xl text-white active:bg-white/10">+</button>
          </div>
        </div>
        {!solParsed.ok && <p id="sol-error" className="text-base text-red-300 text-right">{solParsed.error}</p>}
      </div>

      {ordered.map((ind) => (
        <IndicatorCard key={ind.key} ind={ind}>
          {ind.key === 'mood' || ind.fields.includes('mood_1_5') ? (
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Mood">
              {MOODS.map((m) => (
                <button type="button" key={m.v} onClick={() => setMood(m.v)} role="radio" aria-checked={mood === m.v}
                  title={m.label}
                  className={`min-h-20 rounded-xl border flex flex-col items-center justify-center ${
                    mood === m.v ? 'border-indigo-400 bg-indigo-500/25 shadow-[0_0_18px_rgba(99,102,241,0.45)]' : 'border-slate-600 bg-slate-950/60'}`}>
                  <span className="text-3xl leading-none">{m.emoji}</span>
                  <span className="text-sm text-slate-200 mt-1.5">{m.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(ind.fields as NumberField[]).map((f) => (
                <Stepper key={f} field={f} label={SUB_LABEL[f]} value={raw[f]} guide={guide} last={last?.[f]} onChange={set(f)} />
              ))}
            </div>
          )}
        </IndicatorCard>
      ))}

      <div className="glass p-5">
        <label htmlFor="notes" className="text-xl text-white font-semibold">Notes <span className="text-slate-400 font-normal text-lg">(optional)</span></label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 500))} rows={2}
          className="mt-2 w-full rounded-xl bg-slate-950/60 border border-slate-600 p-3 text-lg text-white focus:border-indigo-400 focus:outline-none" />
      </div>

      {errors.length > 0 && (
        <ul className="rounded-2xl border border-red-500/50 bg-red-500/15 p-4 text-lg text-red-100 space-y-1" role="alert">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <button type="submit" disabled={busy || !solParsed.ok}
        className="btn-primary w-full">
        {busy ? 'Saving…' : 'Submit check-in'}
      </button>
      <p className="text-base text-slate-300 text-center">
        Saved on this device first, then sent when online. Ranges from the server guide
        {guideFetchedAt ? `, cached ${new Date(guideFetchedAt).toLocaleString()}` : ''}.
      </p>
    </form>
  );
}
