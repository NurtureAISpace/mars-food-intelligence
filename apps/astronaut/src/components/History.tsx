import type { LocalCheckin, ServerCheckin, ServerHistory } from '../types';
import { LocalEntryCard, StatusPill, SyncBadge, formatTime, valuesLine } from './ui';

const LIMIT = 30;

type Row =
  | { kind: 'local'; sol: number; t: string; e: LocalCheckin; replaced: boolean }
  | { kind: 'server'; sol: number; t: string; s: ServerCheckin };

/** Local entries (with sync state) plus server entries not made on this device (e.g. from the main dashboard). */
export function mergeHistory(local: LocalCheckin[], server: ServerCheckin[]): Row[] {
  const localIds = new Set(local.map((e) => e.client_id));
  const serverBySol = new Map(server.map((s) => [s.sol, s]));
  const rows: Row[] = [
    ...local.map((e): Row => {
      const onServer = serverBySol.get(e.payload.sol);
      const replaced = e.sync === 'synced' && !!onServer && onServer.client_id !== e.client_id;
      return { kind: 'local', sol: e.payload.sol, t: e.payload.measured_at, e, replaced };
    }),
    ...server
      .filter((s) => !s.client_id || !localIds.has(s.client_id))
      .map((s): Row => ({ kind: 'server', sol: s.sol, t: s.measured_at ?? s.recorded_at, s })),
  ];
  return rows.sort((a, b) => b.sol - a.sol || (a.t < b.t ? 1 : a.t > b.t ? -1 : 0));
}

export function History({ local, server, serverFetchedAt, online, onDiscard }: {
  local: LocalCheckin[];
  server: ServerHistory | null;
  serverFetchedAt: string | null;
  online: boolean;
  onDiscard: (id: string) => void;
}) {
  const rows = mergeHistory(local, server?.checkins ?? []).slice(0, LIMIT);
  return (
    <section className="px-4 py-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-white">History</h2>
        <span className="text-xs text-slate-500">
          {serverFetchedAt ? `server data ${online ? 'as of' : 'cached'} ${formatTime(serverFetchedAt)}` : 'no server data yet'}
        </span>
      </div>
      {server && <p className="text-xs text-slate-400">Streak: {server.streak.current_sols} Sol(s) · {server.count} on the server</p>}
      {rows.length === 0 && <p className="text-slate-400 text-sm">No check-ins yet.</p>}
      {rows.map((r) =>
        r.kind === 'local' ? (
          <LocalEntryCard key={r.e.client_id} e={r.e} replaced={r.replaced} onDiscard={onDiscard} />
        ) : (
          <div key={`s-${r.s.sol}-${r.s.recorded_at}`} className="rounded-xl border border-mars-border bg-mars-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-white font-semibold">Sol {r.s.sol}</div>
                <div className="text-xs text-slate-400">Recorded {formatTime(r.t)} · from server</div>
              </div>
              <SyncBadge state="synced" />
            </div>
            <div className="text-xs text-slate-400 font-mono">{valuesLine(r.s)}</div>
            <StatusPill status={r.s.overall_status} />
          </div>
        ),
      )}
    </section>
  );
}
