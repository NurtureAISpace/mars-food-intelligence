// Guest assignment and the one-time migration of old "seat" profiles (seats 1-4 = C001-C004) to guests.
import { GUEST_SEAT_BASE, GUEST_SLOTS, guestCrewId, isGuestSeat, isReservedCrewId, seatToCrewId } from './config';
import type { LocalCheckin, Profile, ServerHistory } from './types';

/**
 * The first GUEST-k with no check-in yet, else the one whose latest check-in is oldest.
 * `latest[k-1]` = latest check-in time of GUEST-k (ISO string) or null.
 */
export function chooseGuestSlot(latest: Array<string | null>): number {
  const slots = GUEST_SLOTS.map((k, i) => ({ k, t: latest[i] ?? null }));
  const free = slots.find((s) => s.t === null);
  if (free) return free.k;
  return slots.reduce((a, b) => (b.t! < a.t! ? b : a)).k;
}

/** Guest seat (100 + k) for a new profile. Offline (history unreachable) -> GUEST-1. */
export async function pickGuestSeat(fetchHistory: (id: string) => Promise<ServerHistory>): Promise<number> {
  try {
    const latest = await Promise.all(GUEST_SLOTS.map(async (k) => {
      const h = await fetchHistory(guestCrewId(k));
      const times = h.checkins.map((c) => c.recorded_at ?? c.measured_at ?? '').filter(Boolean).sort();
      return times.length ? times[times.length - 1] : null;
    }));
    return GUEST_SEAT_BASE + chooseGuestSlot(latest);
  } catch {
    return GUEST_SEAT_BASE + 1;
  }
}

/** Old profile with a crew seat (1-4) -> same name and code on a guest seat. Guest profiles are returned as they are. */
export async function migrateProfile(p: Profile, pickSeat: () => Promise<number>): Promise<{ profile: Profile; changed: boolean }> {
  if (isGuestSeat(p.seat)) return { profile: p, changed: false };
  return { profile: { ...p, seat: await pickSeat() }, changed: true };
}

/** Unsent check-ins stored under a reserved crew id (C00x) are moved to the profile's guest id before any sync. */
export function migratePending(entries: LocalCheckin[], profile: Profile): LocalCheckin[] {
  const id = seatToCrewId(profile.seat);
  return entries
    .filter((e) => e.sync === 'pending' && (isReservedCrewId(e.astronaut_id) || isReservedCrewId(e.payload.astronaut_id)))
    .map((e) => ({ ...e, astronaut_id: id, payload: { ...e.payload, astronaut_id: id } }));
}
