// App constants.

/**
 * Salt mixed into the name before hashing (see pseudonym.ts). Changing it changes every crew code.
 * It is public (shipped in the app), so the code is a pseudonym, not a secret: it hides the name from the
 * server and the dashboard, but someone who already knows a name and this salt can recompute the code.
 */
export const APP_SALT = 'nurtureai-space-pseudonym-v1';

/**
 * Every user of this app is a guest: GUEST-1 … GUEST-4 (stored in the profile as seat 100 + k).
 * The crew ids C001–C004 are reserved for the NASA Inspiration4 data and the seeded demo check-ins on the
 * dashboard; this app never sends them (checked again in checkin.ts and sync.ts).
 */
export const GUEST_SLOTS = [1, 2, 3, 4] as const;
export const GUEST_SEAT_BASE = 100;
export const isGuestSeat = (seat: number) => seat > GUEST_SEAT_BASE && seat <= GUEST_SEAT_BASE + GUEST_SLOTS.length;
export const guestCrewId = (k: number) => `GUEST-${k}`;

/** C001–C004 style ids: never sent by this app. */
export const isReservedCrewId = (id: string) => /^C\d{3}$/i.test(id.trim());

/** Crew id for a stored guest seat. Throws for anything else (old seat profiles are migrated on start, see guest.ts). */
export function seatToCrewId(seat: number): string {
  if (!isGuestSeat(seat)) throw new Error(`Not a guest seat: ${seat}`);
  return guestCrewId(seat - GUEST_SEAT_BASE);
}
