import { useCallback, useEffect, useState } from 'react';
import { fetchCheckins } from '../api';
import type { CheckinColor, CheckinHistoryEntry, CheckinIndicatorKey, CheckinOverallStatus } from '../types';

/**
 * Crew cards C001-C004: the Inspiration4 subject ids, filled by the seeded demo check-ins. Reserved: the
 * Astronaut App never sends them (apps/astronaut/src/config.ts); live check-ins arrive as guests.
 */
export const CREW_SEATS = ['C001', 'C002', 'C003', 'C004'] as const;

/** Guest ids: every Astronaut App user (a judge checks in from their own phone; apps/astronaut/src/config.ts). */
export const GUEST_IDS = ['GUEST-1', 'GUEST-2', 'GUEST-3', 'GUEST-4'] as const;

const POLL_MS = 15_000; // new check-ins from the Astronaut App appear without a reload

export interface SeatState {
  seat: number;               // 1..4 (guests: 1..4 of GUEST-k)
  astronautId: string;        // C001..C004 or GUEST-1..4
  guest?: boolean;
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

/** Latest Astronaut App check-in per seat, plus crew-level numbers for the stat tiles. */
export function useCrewCheckins() {
  const [seats, setSeats] = useState<SeatState[] | null>(null);
  const [guests, setGuests] = useState<SeatState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const histories = await Promise.all(CREW_SEATS.map((id) => fetchCheckins(id)));
      setSeats(histories.map((h, i) => {
        const latest = latestOf(h.checkins);
        return { seat: i + 1, astronautId: CREW_SEATS[i], pseudonym: h.pseudonym ?? latest?.pseudonym ?? null, latest };
      }));
      setError(null);
      // Guests: only those with a check-in, newest first. A failed guest fetch never hides the crew seats.
      const gh = await Promise.all(GUEST_IDS.map((id) => fetchCheckins(id).catch(() => null)));
      setGuests(gh
        .map((h, i) => {
          const latest = h ? latestOf(h.checkins) : null;
          return { seat: i + 1, astronautId: GUEST_IDS[i], guest: true, pseudonym: h?.pseudonym ?? latest?.pseudonym ?? null, latest };
        })
        .filter((g) => g.latest)
        .sort((a, b) => (b.latest!.recorded_at ?? '').localeCompare(a.latest!.recorded_at ?? '')));
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

  return { seats, guests, error, reload: load, worst, currentSol, allGood, needAttention };
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
  if (reds.length) return `${joinWords(reds)} outside the reference range — may need attention; check with the flight surgeon today.`;
  if (ambers.length) return `${joinWords(ambers)} slightly off — measure again at the next check-in.`;
  if (flags.length) return `${joinWords(flags)} different from their usual — keep an eye on it.`;
  return `All ${keys.length} readings in the reference range.`;
}

/** Seeded demo entries (backend/scripts/seed_demo_checkins.py) vs real Astronaut App check-ins. */
export const isDemoCheckin = (e: CheckinHistoryEntry) =>
  e.notes === 'demo seed' || (e.client_id ?? '').startsWith('demo-seed');

/** The 6 latest readings of a check-in as label / value / colour rows (values straight from the API record). */
export function checkinReadings(e: CheckinHistoryEntry): Array<{ key: CheckinIndicatorKey; label: string; value: string; color: CheckinColor | undefined }> {
  const c = e.colors ?? ({} as CheckinHistoryEntry['colors']);
  return [
    { key: 'heart_rate', label: 'Heart rate', value: `${e.heart_rate_bpm} bpm`, color: c.heart_rate },
    { key: 'blood_pressure', label: 'Blood pressure', value: `${e.systolic_mmHg}/${e.diastolic_mmHg} mmHg`, color: c.blood_pressure },
    { key: 'blood_glucose', label: 'Blood sugar', value: `${e.blood_glucose_mg_dl} mg/dL`, color: c.blood_glucose },
    { key: 'body_temperature', label: 'Temperature', value: `${e.body_temp_c} °C`, color: c.body_temperature },
    { key: 'sleep', label: 'Sleep', value: `${e.sleep_hours} h`, color: c.sleep },
    { key: 'mood', label: 'Mood', value: `${e.mood_1_5} / 5`, color: c.mood },
  ];
}

export const indicatorWord = word;
export const joinIndicatorWords = joinWords;
