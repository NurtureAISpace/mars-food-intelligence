import type { Color, LocalCheckin, Provisional, ServerStatus, SyncState } from '../types';
import { PROVISIONAL_LABEL } from '../provisional';

export const COLOR_CLS: Record<Color, { text: string; bg: string; border: string; dot: string }> = {
  green: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', dot: 'bg-emerald-400' },
  amber: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/40', dot: 'bg-amber-400' },
  red: { text: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/40', dot: 'bg-red-500' },
};
export const STATUS_COLOR: Record<ServerStatus, Color> = { NOMINAL: 'green', WATCH: 'amber', ACT: 'red' };
const COLOR_WORD: Record<Color, string> = { green: 'Green', amber: 'Amber', red: 'Red' };
/** Plain words for people; backend values stay NOMINAL / WATCH / ACT. */
export const STATUS_WORD: Record<ServerStatus, string> = { NOMINAL: 'All good', WATCH: 'Take care', ACT: 'Call doctor' };
const STATUS_ICON: Record<ServerStatus, string> = { NOMINAL: '✓', WATCH: '!', ACT: '✚' };

export function formatTime(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export function SyncBadge({ state }: { state: SyncState }) {
  const cls = {
    pending: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    synced: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    failed: 'bg-red-500/15 text-red-300 border-red-500/50',
  }[state];
  const label = { pending: 'Pending', synced: 'Synced', failed: 'Failed' }[state];
  return <span className={`px-2 py-0.5 rounded-full border text-sm font-semibold ${cls}`}>{label}</span>;
}

/** Final status from the server (personal baseline included). */
export function StatusPill({ status }: { status: ServerStatus }) {
  const c = COLOR_CLS[STATUS_COLOR[status]];
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-base font-semibold ${c.bg} ${c.border} ${c.text}`}>
      <span className={`grid place-items-center w-5 h-5 rounded-full text-sm text-slate-950 ${c.dot}`} aria-hidden>{STATUS_ICON[status]}</span>
      {STATUS_WORD[status]}
    </span>
  );
}

/** On-device range check. Always shown with its label; never styled or worded as the final status. */
export function ProvisionalBlock({ p, compact = false }: { p: Provisional; compact?: boolean }) {
  const c = COLOR_CLS[p.overall];
  return (
    <div className="rounded-lg border border-dashed border-slate-500/60 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${c.dot} opacity-80`} />
        <span className={`text-sm font-semibold ${c.text}`}>{COLOR_WORD[p.overall]} (provisional)</span>
      </div>
      <p className="text-sm text-slate-300 italic">{PROVISIONAL_LABEL}</p>
      {!compact && (
        <ul className="grid grid-cols-2 gap-1 text-sm text-slate-300">
          {p.indicators.map((i) => (
            <li key={i.key} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${COLOR_CLS[i.color].dot} opacity-80`} />
              {i.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function valuesLine(p: {
  heart_rate_bpm: number; systolic_mmHg: number; diastolic_mmHg: number; blood_glucose_mg_dl: number;
  body_temp_c: number; sleep_hours: number; mood_1_5: number;
}): string {
  return `HR ${p.heart_rate_bpm} · BP ${p.systolic_mmHg}/${p.diastolic_mmHg} · Glu ${p.blood_glucose_mg_dl} · ` +
    `${p.body_temp_c} °C · Sleep ${p.sleep_hours} h · Mood ${p.mood_1_5}/5`;
}

/** One local check-in (history row and "last submission" card). */
export function LocalEntryCard({ e, onDiscard, replaced }: {
  e: LocalCheckin; onDiscard?: (id: string) => void; replaced?: boolean;
}) {
  return (
    <div className="rounded-xl border border-mars-border bg-mars-card/55 backdrop-blur-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-white font-semibold">Sol {e.payload.sol}</div>
          <div className="text-sm text-slate-400">Measured {formatTime(e.payload.measured_at)}</div>
        </div>
        <SyncBadge state={e.sync} />
      </div>
      <div className="text-sm text-slate-400 font-mono">{valuesLine(e.payload)}</div>

      {e.sync === 'synced' && e.server && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={e.server.status} />
            <span className="text-sm text-slate-400">server status</span>
          </div>
          {e.server.headline && <p className="text-sm text-slate-200">{e.server.headline}</p>}
          {e.server.contact_flight_surgeon && (
            <p className="text-sm text-red-300 font-semibold">Contact the flight surgeon today.</p>
          )}
          {replaced && (
            <p className="text-sm text-amber-300">
              The server now holds a later check-in for this Sol (it keeps one per Sol), so this one was replaced.
            </p>
          )}
        </div>
      )}

      {e.sync !== 'synced' && e.provisional && <ProvisionalBlock p={e.provisional} compact={e.sync === 'failed'} />}

      {e.sync === 'pending' && e.last_error && (
        <p className="text-sm text-sky-300">
          Not sent yet ({e.last_error}). {e.next_attempt_at ? `Next automatic try after ${new Date(e.next_attempt_at).toLocaleTimeString()}.` : ''}
        </p>
      )}
      {e.sync === 'failed' && (
        <div className="space-y-2">
          <p className="text-sm text-red-300">Rejected by the server: {e.last_error}</p>
          {onDiscard && (
            <button onClick={() => onDiscard(e.client_id)}
              className="min-h-11 px-4 rounded-lg border border-red-500/50 text-red-200 text-sm active:bg-red-500/20">
              Discard this entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
