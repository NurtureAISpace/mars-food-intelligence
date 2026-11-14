// Sync queue: sends locally stored check-ins to POST /api/v1/health/checkin, oldest first.
// Pure logic with injected storage/network so it can be unit-tested without IndexedDB or a server.
//
// Rules
//  - 2xx                       -> Synced, keep the server status (record.overall_status)
//  - 4xx (not 408/429)         -> Failed, keep the server's message; continue with the next entry
//  - network error, 5xx, 408, 429 -> stay Pending, attempts+1, exponential backoff; STOP the run so that later
//    entries are never sent before earlier ones (Sol order matters for the server's personal baseline)
//  - Retries are safe: every payload carries the same client_id, the server deduplicates on it.
import type { CheckinPayload, LocalCheckin, ServerOutcome, ServerStatus } from './types';

export type PostResult =
  | { kind: 'ok'; body: unknown }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'network'; message: string };

export interface SyncDeps {
  listPending(): Promise<LocalCheckin[]>;
  save(entry: LocalCheckin): Promise<void>;
  post(payload: CheckinPayload): Promise<PostResult>;
  now(): number;
}

export interface SyncReport {
  attempted: number;
  synced: number;
  failed: number;
  retrying: number;
  /** pending entries not tried in this run (waiting for backoff, or behind an entry that has to retry) */
  waiting: number;
}

export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/** 5 s, 10 s, 20 s, ... capped at 5 min. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);
}

export function isPermanentHttpError(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

const byCreated = (a: LocalCheckin, b: LocalCheckin) =>
  a.created_at === b.created_at ? a.client_id.localeCompare(b.client_id) : a.created_at < b.created_at ? -1 : 1;

/** Extracts what the history needs from the POST /checkin response. */
export function outcomeFromResponse(body: unknown): ServerOutcome {
  const b = (body ?? {}) as Record<string, any>;
  const record = (b.record ?? {}) as Record<string, any>;
  const status = (record.overall_status ?? b.overall?.status) as ServerStatus;
  if (!status) throw new Error('Server response has no status');
  // A duplicate response re-evaluates the stored values; only reuse its headline when it agrees with the record.
  const sameStatus = b.overall?.status === status;
  return {
    status,
    recorded_at: String(record.recorded_at ?? b.recorded_at ?? ''),
    duplicate: Boolean(b.duplicate),
    colors: record.colors ?? {},
    headline: sameStatus ? (b.overall?.headline ?? null) : null,
    contact_flight_surgeon: status === 'ACT',
    baseline_flags: record.baseline_flags ?? [],
  };
}

export async function runSync(deps: SyncDeps, opts: { force?: boolean } = {}): Promise<SyncReport> {
  const queue = (await deps.listPending()).filter((e) => e.sync === 'pending').sort(byCreated);
  const report: SyncReport = { attempted: 0, synced: 0, failed: 0, retrying: 0, waiting: 0 };

  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];
    if (!opts.force && entry.next_attempt_at !== null && entry.next_attempt_at > deps.now()) {
      report.waiting = queue.length - i;
      break;
    }
    report.attempted++;
    const res = await deps.post(entry.payload);

    if (res.kind === 'ok') {
      let server: ServerOutcome;
      try {
        server = outcomeFromResponse(res.body);
      } catch (e) {
        await retryLater(deps, entry, `Unexpected server response: ${(e as Error).message}`);
        report.retrying++;
        report.waiting = queue.length - i - 1;
        break;
      }
      await deps.save({ ...entry, sync: 'synced', server, last_error: null, next_attempt_at: null,
                        attempts: entry.attempts + 1 });
      report.synced++;
    } else if (res.kind === 'http' && isPermanentHttpError(res.status)) {
      await deps.save({ ...entry, sync: 'failed', last_error: `HTTP ${res.status}: ${res.message}`,
                        next_attempt_at: null, attempts: entry.attempts + 1 });
      report.failed++;
    } else {
      const msg = res.kind === 'http' ? `HTTP ${res.status}: ${res.message}` : res.message;
      await retryLater(deps, entry, msg);
      report.retrying++;
      report.waiting = queue.length - i - 1;
      break;
    }
  }
  return report;
}

async function retryLater(deps: SyncDeps, entry: LocalCheckin, message: string) {
  const attempts = entry.attempts + 1;
  await deps.save({ ...entry, sync: 'pending', attempts, last_error: message,
                    next_attempt_at: deps.now() + backoffMs(attempts) });
}

/** Single-flight wrapper: overlapping triggers (online event + timer + button) share one run. */
export function createSyncer(deps: SyncDeps, onSettled?: (r: SyncReport | null, err?: unknown) => void) {
  let running: Promise<SyncReport> | null = null;
  let again: { force: boolean } | null = null;
  const sync = (opts: { force?: boolean } = {}): Promise<SyncReport> => {
    if (running) {
      // a trigger during a run gets one follow-up run (forced if any of the waiting triggers was forced)
      again = { force: Boolean(opts.force) || Boolean(again?.force) };
      return running;
    }
    running = runSync(deps, opts);
    running.then((r) => onSettled?.(r), (e) => onSettled?.(null, e)).finally(() => {
      running = null;
      if (again) {
        const next = again;
        again = null;
        void sync(next);
      }
    });
    return running;
  };
  return { sync, isRunning: () => running !== null };
}
