// What the sync banner at the top of the app says. Sending itself is automatic (submit, app start, `online` event,
// retry timer); there is no manual "Sync now".

export type SyncView =
  | { kind: 'ok' }
  | { kind: 'waiting'; n: number }
  | { kind: 'error'; text: string };

const plural = (n: number) => `${n} check-in${n === 1 ? '' : 's'}`;

/** failed = rejected by the server; lastError = the last run could not reach the server (kept while it retries). */
export function syncView(o: { pending: number; failed: number; online: boolean; lastError: string | null }): SyncView {
  if (o.failed > 0) return { kind: 'error', text: `${plural(o.failed)} could not be sent — see History.` };
  if (o.pending > 0 && o.online && o.lastError) {
    return { kind: 'error', text: `Could not reach the server — ${plural(o.pending)} will retry automatically.` };
  }
  if (o.pending > 0) return { kind: 'waiting', n: o.pending };
  return { kind: 'ok' };
}

export function bannerText(v: SyncView): string {
  if (v.kind === 'ok') return 'All check-ins sent';
  if (v.kind === 'waiting') return `${plural(v.n)} waiting — they send automatically when you're back online`;
  return v.text;
}
