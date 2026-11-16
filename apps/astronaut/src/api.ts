// Calls to the existing backend (proxied: /api -> http://127.0.0.1:8001, see vite.config.ts), or to the hosted
// backend when VITE_API_BASE is set (scripts/build_site.ps1 -ApiBase).
import type { CheckinPayload, Guide, ServerHistory } from './types';
import type { PostResult } from './sync';
import { wakeFetch } from './serverWake';

/** Live hosted backend (VITE_API_BASE=https://….onrender.com): calls go to `${VITE_API_BASE}/api/...`, with cold-start
 *  retries and the "Waking up the server…" banner (src/serverWake.ts). Not set: relative /api as before. */
const API_ORIGIN = (import.meta.env.VITE_API_BASE ?? '').trim().replace(/\/+$/, '');
export const LIVE_API = API_ORIGIN !== '';
const API = `${API_ORIGIN}/api/v1/health`;
const TIMEOUT_MS = 15_000;

/** Static demo build (VITE_STATIC_DEMO=1, GitHub Pages /app/ without a backend): no server. The guide comes from
 *  public/snapshot/ (scripts/export_snapshot.py); check-ins are saved on this device only and never POSTed.
 *  Ignored when VITE_API_BASE is set. */
export const STATIC_DEMO = !LIVE_API && import.meta.env.VITE_STATIC_DEMO === '1';

/** Plain fetch locally; cold-start aware against the hosted backend. Fresh timeout signal per attempt. */
const call = (url: string, init: () => RequestInit) => (LIVE_API ? wakeFetch(url, init) : fetch(url, init()));

/** '/api/v1/health/checkin/guide' -> 'health_checkin_guide.json' (same rule as scripts/export_snapshot.py). */
export const snapshotKey = (url: string) => url.replace(/^\/api\/v1\//, '').replace(/[^A-Za-z0-9._-]+/g, '_') + '.json';

async function getJson<T>(path: string): Promise<T> {
  if (STATIC_DEMO) {
    const snap = `${import.meta.env.BASE_URL}snapshot/${snapshotKey(`/api/v1/health${path}`)}`;
    const res = await fetch(snap, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return res.json() as Promise<T>;
  }
  const res = await call(`${API}${path}`, () => ({ signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' }));
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

export const fetchGuide = () => getJson<Guide>('/checkin/guide');

export const fetchHistory = (astronautId: string) =>
  getJson<ServerHistory>(`/checkins?astronaut_id=${encodeURIComponent(astronautId)}`);

/** FastAPI error body -> one readable line. */
export function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const where = (d.loc ?? []).filter((x) => x !== 'body').join('.');
        return where ? `${where}: ${d.msg}` : String(d.msg);
      })
      .join('; ');
  }
  return fallback;
}

export async function postCheckin(payload: CheckinPayload): Promise<PostResult> {
  if (STATIC_DEMO) return { kind: 'network', message: 'Online demo: no server, the check-in stays on this device' };
  let res: Response;
  try {
    // Retrying a POST is safe: client_id makes it idempotent on the server.
    res = await call(`${API}/checkin`, () => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }));
  } catch (e) {
    return { kind: 'network', message: navigator.onLine ? `Network error: ${(e as Error).message}` : 'Offline' };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body (e.g. proxy error page) */
  }
  if (res.ok) return { kind: 'ok', body };
  return { kind: 'http', status: res.status, message: errorMessage(body, res.statusText || 'request failed') };
}
