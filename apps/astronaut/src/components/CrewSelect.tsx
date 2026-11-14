import { useState } from 'react';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/; // same as the backend astronaut_id pattern

export function CrewSelect({ crew, current, online, crewFetchedAt, onPick, onCancel }: {
  crew: string[];
  current: string | null;
  online: boolean;
  crewFetchedAt: string | null;
  onPick: (id: string) => void;
  onCancel?: () => void;
}) {
  const [custom, setCustom] = useState('');
  const customOk = ID_PATTERN.test(custom.trim());

  return (
    <section className="px-4 py-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Who is checking in?</h1>
        <p className="text-sm text-slate-400 mt-1">Your choice is remembered on this device.</p>
      </div>

      {crew.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {crew.map((id) => (
            <button key={id} onClick={() => onPick(id)} aria-pressed={id === current}
              className={`min-h-20 rounded-xl border text-lg font-mono font-bold active:scale-[0.98] transition ${
                id === current ? 'border-mars-accent bg-mars-accent/15 text-white' : 'border-mars-border bg-mars-card text-slate-100'}`}>
              {id}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-amber-300 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          {online ? 'Could not load the crew list from the server.' : 'Crew list not downloaded yet: connect once, or enter your ID below.'}
        </p>
      )}
      {crewFetchedAt && (
        <p className="text-xs text-slate-500">Crew list from the server, cached {new Date(crewFetchedAt).toLocaleString()}.</p>
      )}

      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (customOk) onPick(custom.trim()); }}>
        <label className="block text-sm text-slate-300" htmlFor="custom-id">Other crew ID</label>
        <div className="flex gap-2">
          <input id="custom-id" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. CDR-01"
            autoCapitalize="characters" autoComplete="off"
            className="flex-1 min-h-12 rounded-lg bg-mars-card border border-mars-border px-3 text-white font-mono" />
          <button type="submit" disabled={!customOk}
            className="min-h-12 px-4 rounded-lg bg-mars-accent text-white font-semibold disabled:opacity-40">Use</button>
        </div>
        {custom && !customOk && <p className="text-xs text-red-300">Letters, digits, - and _ only (max 32).</p>}
      </form>

      {onCancel && current && (
        <button onClick={onCancel} className="w-full min-h-12 rounded-lg border border-mars-border text-slate-300">
          Back to {current}
        </button>
      )}
    </section>
  );
}
