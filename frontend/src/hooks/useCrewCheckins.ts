import { useCallback, useEffect, useState } from 'react';
import { fetchCheckins } from '../api';
import type { CheckinHistoryEntry, CheckinIndicatorKey, CheckinOverallStatus } from '../types';

/**
 * Astronaut App seats 1-4. Seat k checks in as Inspiration4 subject C00k (links the demo to the real
 * NASA blood data). Configuration shared with apps/astronaut/src/config.ts, not data.
 */
export const CREW_SEATS = ['C001', 'C002', 'C003', 'C004'] as const;

const POLL_MS = 15_000; // new check-ins from the Astronaut App appear without a reload

export interface SeatState {
  seat: number;               // 1..4
  astronautId: string;        // C001..C004
  pseudonym: string | null;   // anonymized code from the device; the name never reaches the server
  latest: CheckinHistoryEntry | null;
}

const RANK: Record<CheckinOverallStatus, number> = { NOMINAL: 1, WATCH: 2, ACT: 3 };

function latestOf(entries: CheckinHistoryEntry[]): CheckinHistoryEntry | null {
  return entries.reduce<CheckinHistoryEntry | null>((best, e) => {
    if (!best) return e;
    if (e.sol !== best.sol) return e.sol > best.sol ? e : best;
    return (e.recorded_at ?? '') > (best.recorded_at ?? '') ? e : best;
  }, null);
}

/** Latest Astronaut App check-in per seat, plus crew-level numbers for the stat tiles and the navbar pill. */
export function useCrewCheckins() {
  const [seats, setSeats] = useState<SeatState[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const histories = await Promise.all(CREW_SEATS.map((id) => fetchCheckins(id)));
      setSeats(histories.map((h, i) => {
        const latest = latestOf(h.checkins);
        return { seat: i + 1, astronautId: CREW_SEATS[i], pseudonym: h.pseudonym ?? latest?.pseudonym ?? null, latest };
      }));
      setError(null);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const withData = (seats ?? []).filter((s) => s.latest);
  const worst = withData.reduce<CheckinOverallStatus | null>(
    (w, s) => (!w || RANK[s.latest!.overall_status] > RANK[w] ? s.latest!.overall_status : w), null);
  const currentSol = withData.length ? Math.max(...withData.map((s) => s.latest!.sol)) : null;
  const allGood = withData.filter((s) => s.latest!.overall_status === 'NOMINAL').length;
  const needAttention = withData.length - allGood;

  return { seats, error, reload: load, worst, currentSol, allGood, needAttention };
}

export type CrewCheckinsState = ReturnType<typeof useCrewCheckins>;

const INDICATOR_WORD: Record<CheckinIndicatorKey, string> = {
  heart_rate: 'Heart rate',
  blood_pressure: 'Blood pressure',
  blood_glucose: 'Blood sugar',
  body_temperature: 'Body temperature',
  sleep: 'Sleep',
  mood: 'Mood',
};

const joinWords = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const word = (k: string) => INDICATOR_WORD[k as CheckinIndicatorKey] ?? k.replace(/_/g, ' ');

/** One plain sentence explaining a stored check-in's status, built only from its colours and baseline flags. */
export function checkinReason(e: CheckinHistoryEntry): string {
  const keys = Object.keys(e.colors ?? {});
  const reds = keys.filter((k) => e.colors[k as CheckinIndicatorKey] === 'red').map(word);
  const ambers = keys.filter((k) => e.colors[k as CheckinIndicatorKey] === 'amber').map(word);
  const flags = (e.baseline_flags ?? []).map(word);
  if (reds.length) return `${joinWords(reds)} outside the safe range — call the flight doctor today.`;
  if (ambers.length) return `${joinWords(ambers)} slightly off — check again tomorrow.`;
  if (flags.length) return `${joinWords(flags)} different from their usual — keep an eye on it.`;
  return `All ${keys.length} readings in the normal range.`;
}
