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

export const seatToCrewId = (seat: number): string => `C${String(seat).padStart(3, '0')}`;
