import { describe, expect, it } from 'vitest';
import { backoffMs, createSyncer, isPermanentHttpError, outcomeFromResponse, runSync, type PostResult, type SyncDeps } from './sync';
import type { CheckinPayload, LocalCheckin } from './types';

function entry(id: string, created_at: string, over: Partial<LocalCheckin> = {}): LocalCheckin {
  const payload: CheckinPayload = {
    astronaut_id: 'MS-03', sol: 1, heart_rate_bpm: 64, systolic_mmHg: 112, diastolic_mmHg: 72,
    blood_glucose_mg_dl: 88, body_temp_c: 36.7, sleep_hours: 7.5, mood_1_5: 4, client_id: id, measured_at: created_at,
  };
  return {
    client_id: id, astronaut_id: 'MS-03', created_at, payload, sync: 'pending', attempts: 0,
    next_attempt_at: null, last_error: null, provisional: null, server: null, ...over,
  };
}

const okBody = (status = 'NOMINAL', duplicate = false) => ({
  recorded_at: '2026-11-14T08:00:00+00:00', duplicate,
  overall: { status, headline: 'All good. See you next Sol.' },
  record: { overall_status: status, recorded_at: '2026-11-14T08:00:00+00:00', colors: { heart_rate: 'green' }, baseline_flags: [] },
});

/** In-memory store + scripted server responses per client_id. */
function harness(entries: LocalCheckin[], responses: Record<string, PostResult[]>, now = 1_000_000) {
  const store = new Map(entries.map((e) => [e.client_id, e]));
  const posted: string[] = [];
  const deps: SyncDeps = {
    listPending: async () => [...store.values()].filter((e) => e.sync === 'pending'),
    save: async (e) => void store.set(e.client_id, e),
    post: async (p) => {
      posted.push(p.client_id);
      const queue = responses[p.client_id] ?? [];
      return queue.length > 1 ? queue.shift()! : queue[0] ?? { kind: 'network', message: 'no script' };
    },
    now: () => now,
  };
  return { deps, store, posted };
}

describe('runSync', () => {
  it('posts pending entries oldest first and marks them synced with the server status', async () => {
    const h = harness(
      [entry('b', '2026-11-14T08:00:00Z'), entry('a', '2026-11-14T07:00:00Z')],
      { a: [{ kind: 'ok', body: okBody('WATCH') }], b: [{ kind: 'ok', body: okBody('NOMINAL') }] },
    );
    const r = await runSync(h.deps);
    expect(h.posted).toEqual(['a', 'b']);
    expect(r).toMatchObject({ attempted: 2, synced: 2, failed: 0, retrying: 0 });
    expect(h.store.get('a')!.sync).toBe('synced');
    expect(h.store.get('a')!.server!.status).toBe('WATCH');
    expect(h.store.get('b')!.server!.status).toBe('NOMINAL');
  });

  it('network error keeps Pending with backoff and stops so later entries are not sent out of order', async () => {
    const h = harness(
      [entry('a', '2026-11-14T07:00:00Z'), entry('b', '2026-11-14T08:00:00Z')],
      { a: [{ kind: 'network', message: 'Offline' }], b: [{ kind: 'ok', body: okBody() }] },
    );
    const r = await runSync(h.deps);
    expect(h.posted).toEqual(['a']);
    expect(r).toMatchObject({ retrying: 1, waiting: 1 });
    const a = h.store.get('a')!;
    expect(a.sync).toBe('pending');
    expect(a.attempts).toBe(1);
    expect(a.next_attempt_at).toBe(1_000_000 + backoffMs(1));
    expect(a.last_error).toBe('Offline');
  });

  it('5xx, 408 and 429 are retried; other 4xx become Failed with the message, and the queue continues', async () => {
    for (const status of [500, 502, 408, 429]) {
      const h = harness([entry('a', '1')], { a: [{ kind: 'http', status, message: 'x' }] });
      await runSync(h.deps);
      expect(h.store.get('a')!.sync).toBe('pending');
    }
    const h = harness(
      [entry('a', '1'), entry('b', '2')],
      { a: [{ kind: 'http', status: 422, message: 'sol: must be <= 1000' }], b: [{ kind: 'ok', body: okBody() }] },
    );
    const r = await runSync(h.deps);
    expect(h.store.get('a')!.sync).toBe('failed');
    expect(h.store.get('a')!.last_error).toBe('HTTP 422: sol: must be <= 1000');
    expect(h.store.get('b')!.sync).toBe('synced');
    expect(r).toMatchObject({ failed: 1, synced: 1 });
  });

  it('respects backoff unless forced', async () => {
    const waiting = entry('a', '1', { attempts: 2, next_attempt_at: 2_000_000 });
    const h = harness([waiting], { a: [{ kind: 'ok', body: okBody() }] });
    expect(await runSync(h.deps)).toMatchObject({ attempted: 0, waiting: 1 });
    expect(h.posted).toEqual([]);
    await runSync(h.deps, { force: true });
    expect(h.posted).toEqual(['a']);
    expect(h.store.get('a')!.sync).toBe('synced');
  });

  it('a retry sends the same client_id, and a server duplicate response counts as synced', async () => {
    const h = harness([entry('a', '1')], {
      a: [{ kind: 'network', message: 'timeout' }, { kind: 'ok', body: okBody('ACT', true) }],
    });
    await runSync(h.deps);
    await runSync(h.deps, { force: true });
    expect(h.posted).toEqual(['a', 'a']);
    const a = h.store.get('a')!;
    expect(a.sync).toBe('synced');
    expect(a.server).toMatchObject({ status: 'ACT', duplicate: true, contact_flight_surgeon: true });
  });

  it('ignores entries that are not pending', async () => {
    const h = harness([entry('a', '1', { sync: 'synced' }), entry('b', '2', { sync: 'failed' })], {});
    expect((await runSync(h.deps)).attempted).toBe(0);
  });
});

describe('helpers', () => {
  it('backoff doubles and is capped', () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([5_000, 10_000, 20_000]);
    expect(backoffMs(30)).toBe(5 * 60_000);
  });

  it('classifies permanent HTTP errors', () => {
    expect([400, 404, 409, 422].every(isPermanentHttpError)).toBe(true);
    expect([408, 429, 500, 503].some(isPermanentHttpError)).toBe(false);
  });

  it('uses the stored record status, not a re-evaluated one, for duplicates', () => {
    const body = { ...okBody('WATCH', true), overall: { status: 'NOMINAL', headline: 'All good.' } };
    const o = outcomeFromResponse(body);
    expect(o.status).toBe('WATCH');
    expect(o.headline).toBeNull();
  });

  it('createSyncer runs one sync at a time', async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const deps: SyncDeps = {
      listPending: async () => { calls++; await gate; return []; },
      save: async () => {}, post: async () => ({ kind: 'network', message: '' }), now: () => 0,
    };
    const s = createSyncer(deps);
    const p1 = s.sync();
    const p2 = s.sync();
    expect(p1).toBe(p2);
    release();
    await p1;
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(2); // the overlapping trigger gets exactly one follow-up run
  });
});
