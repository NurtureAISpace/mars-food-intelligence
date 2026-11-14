// Calls to the existing backend (proxied: /api -> http://127.0.0.1:8001, see vite.config.ts).
import type { CheckinPayload, Guide, ServerHistory } from './types';
import type { PostResult } from './sync';

const API = '/api/v1/health';
const TIMEOUT_MS = 15_000;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

export const fetchGuide = () => getJson<Guide>('/checkin/guide');

export const fetchHistory = (astronautId: string) =>
  getJson<ServerHistory>(`/checkins?astronaut_id=${encodeURIComponent(astronautId)}`);

/** Crew IDs of the simulated mission, from the Crew Health snapshot. */
export async function fetchCrewIds(): Promise<string[]> {
  const d = await getJson<{ crew: Array<{ astronaut_id: string }> }>('/crew');
  return d.crew.map((c) => c.astronaut_id);
}

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
  let res: Response;
  try {
    res = await fetch(`${API}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
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
