// Onboarding: Name -> Code. The name is turned into an anonymized crew code on this device and stored only here
// (IndexedDB). Everyone is a guest: the app picks GUEST-1…4 itself (guest.ts). The backend and the dashboard only
// ever see the guest id and the code; C001–C004 are reserved for NASA/demo data and never used here.
import { useEffect, useState } from 'react';
import { isGuestSeat } from '../config';
import { fetchHistory } from '../api';
import { pickGuestSeat } from '../guest';
import { isFullName, pseudonymFor } from '../pseudonym';
import type { Profile } from '../types';

const Check = () => (
  <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden><path d="M5 10.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const Lock = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 text-indigo-300" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M8 11V7a4 4 0 018 0v4" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/** Dots joined by a thin line; a dot turns green with a check when its step is done. */
function Steps({ done, labels }: { done: boolean[]; labels: string[] }) {
  return (
    <ol className="flex items-start" aria-label="Progress">
      {labels.map((l, i) => (
        <li key={l} className="flex-1 flex flex-col items-center relative">
          {i > 0 && <span aria-hidden className={`absolute top-4 right-1/2 w-full h-px ${done[i - 1] ? 'bg-emerald-400/60' : 'bg-slate-600'}`} />}
          <span className={`relative z-10 grid place-items-center w-8 h-8 rounded-full border-2 ${
            done[i] ? 'bg-emerald-400 border-emerald-400 text-slate-950' : 'border-slate-500 bg-slate-900 text-slate-400'}`}>
            {done[i] ? <Check /> : <span className="text-sm font-bold">{i + 1}</span>}
          </span>
          <span className={`mt-1.5 text-base ${done[i] ? 'text-emerald-300' : 'text-slate-300'}`}>{l}</span>
          <span className="sr-only">{done[i] ? 'done' : 'to do'}</span>
        </li>
      ))}
    </ol>
  );
}

export function Onboarding({ current, onSave, onCancel }: {
  current: Profile | null;
  onSave: (p: Profile) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(current?.name ?? '');
  const [code, setCode] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameOk = isFullName(name);

  useEffect(() => {
    let cancelled = false;
    if (!nameOk) { setCode(null); return; }
    pseudonymFor(name).then((c) => { if (!cancelled) setCode(c); });
    return () => { cancelled = true; };
  }, [name, nameOk]);

  const ready = nameOk && code !== null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!ready) return;
    setBusy(true);
    try {
      // Changing the name keeps this phone's guest seat; a new profile gets the first free guest seat.
      const seat = current && isGuestSeat(current.seat) ? current.seat : await pickGuestSeat(fetchHistory);
      await onSave({ name: name.trim().replace(/\s+/g, ' '), seat, pseudonym: code!, created_at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="px-4 py-6 space-y-5 min-w-0" noValidate>
      <div className="glass p-5 space-y-5">
        <div>
          <h1 className="text-3xl font-light text-white">Welcome aboard</h1>
          <p className="text-lg text-slate-300 mt-1">Your name stays on this phone.</p>
        </div>
        <Steps labels={['Name', 'Code']} done={[nameOk, ready]} />
      </div>

      <div className="glass p-5 space-y-2">
        <label htmlFor="full-name" className="block text-xl font-semibold text-white">Your full name</label>
        <input id="full-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)}
          placeholder="First and last name" autoComplete="name" autoCapitalize="words"
          className="w-full min-h-14 rounded-xl bg-slate-950/60 border border-slate-600 px-4 text-xl text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none" />
        {touched && !nameOk && <p className="text-base text-amber-300">Please enter your first and last name.</p>}
      </div>

      {code && (
        <div className="glass p-5 space-y-1">
          <div className="text-base text-slate-300">Your anonymized code</div>
          <div className="flex items-center gap-2 text-3xl font-mono font-bold text-white"><Lock />{code}</div>
          <p className="text-base text-slate-300">Only this code is sent. Your name never leaves this phone.</p>
        </div>
      )}

      <button type="submit" disabled={busy || (touched && !ready)} className="btn-primary w-full">
        {busy ? 'Saving…' : 'Start'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="btn-secondary w-full">Back</button>
      )}
    </form>
  );
}
