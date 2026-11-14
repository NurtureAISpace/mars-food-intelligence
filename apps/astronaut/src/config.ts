// App constants.

/**
 * Salt mixed into the name before hashing (see pseudonym.ts). Changing it changes every crew code.
 * It is public (shipped in the app), so the code is a pseudonym, not a secret: it hides the name from the
 * server and the dashboard, but someone who already knows a name and this salt can recompute the code.
 */
export const APP_SALT = 'nurtureai-space-pseudonym-v1';

/**
 * Crew seats. Seat k checks in as Inspiration4 subject C00k, which links the demo to the real NASA blood data
 * (GET /api/v1/real-data/i4). Same seats as frontend/src/hooks/useCrewCheckins.ts.
 */
export const SEATS = [1, 2, 3, 4] as const;
export type Seat = (typeof SEATS)[number];

/**
 * Guest seats for live demos (a judge checks in from their own phone). Stored as seat 100 + k and sent as
 * GUEST-k (k = 1..4), so the 4 crew seats are never touched.
 */
export const GUEST_SLOTS = [1, 2, 3, 4] as const;
export const GUEST_SEAT_BASE = 100;
export const isGuestSeat = (seat: number) => seat > GUEST_SEAT_BASE;
export const guestCrewId = (k: number) => `GUEST-${k}`;

export const seatToCrewId = (seat: number): string =>
  isGuestSeat(seat) ? guestCrewId(seat - GUEST_SEAT_BASE) : `C${String(seat).padStart(3, '0')}`;

/** "Seat 2" or "Guest 1". */
export const seatLabel = (seat: number): string =>
  isGuestSeat(seat) ? `Guest ${seat - GUEST_SEAT_BASE}` : `Seat ${seat}`;
