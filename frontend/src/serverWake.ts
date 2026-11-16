// Hosted backend (VITE_API_BASE, free Render instance) sleeps after ~15 min idle; the first request wakes it, which
// takes ~30-60 s. wakeFetch: while the server is not known to be awake, retry network errors and 502/503/504 every
// 3 s for up to 60 s, and raise the "Waking up the server…" flag when a call takes longer than 3 s.
// Used only in live mode (src/api.ts); without VITE_API_BASE nothing here runs. Same file in apps/astronaut/src/.
import { useSyncExternalStore } from 'react';

const SLOW_MS = 3_000;
const MAX_WAIT_MS = 60_000;
const RETRY_MS = 3_000;
const AWAKE_FOR_MS = 10 * 60_000; // after this long without a reply, assume the server may be asleep again
const RETRY_STATUS = new Set([502, 503, 504]);

let lastOk = 0;
let inFlight = 0;
let waking = false;
const listeners = new Set<() => void>();

function setWaking(v: boolean) {
  if (waking === v) return;
  waking = v;
  listeners.forEach((f) => f());
}

const isAwake = () => Date.now() - lastOk < AWAKE_FOR_MS;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with cold-start handling. `init` may be a factory (fresh AbortSignal per attempt). */
export async function wakeFetch(url: string, init?: RequestInit | (() => RequestInit)): Promise<Response> {
  const opts = () => (typeof init === 'function' ? init() : init);
  if (isAwake()) {
    const res = await fetch(url, opts());
    if (res.status < 500) lastOk = Date.now();
    return res;
  }
  const deadline = Date.now() + MAX_WAIT_MS;
  inFlight += 1;
  const slow = setTimeout(() => { if (!isAwake()) setWaking(true); }, SLOW_MS);
  try {
    for (;;) {
      try {
        const res = await fetch(url, opts());
        if (!RETRY_STATUS.has(res.status) || Date.now() + RETRY_MS > deadline) {
          if (res.status < 500) lastOk = Date.now();
          return res;
        }
      } catch (e) {
        if ((typeof navigator !== 'undefined' && navigator.onLine === false) || Date.now() + RETRY_MS > deadline) throw e;
      }
      await sleep(RETRY_MS);
    }
  } finally {
    clearTimeout(slow);
    inFlight -= 1;
    if (isAwake() || inFlight === 0) setWaking(false);
  }
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => { listeners.delete(f); };
};

/** true while a request is waiting for the sleeping server (show "Waking up the server…"). */
export const useServerWaking = () => useSyncExternalStore(subscribe, () => waking);
