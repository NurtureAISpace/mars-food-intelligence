// Builds the locally stored check-in (and the payload later sent by the sync queue) from the device profile.
// Only the seat's crew id and the anonymized code go into the payload. The profile's `name` is never copied.
import { seatToCrewId } from './config';
import type { Field, LocalCheckin, Profile, Provisional } from './types';

export interface NewCheckin {
  sol: number;
  notes: string | null;
  values: Record<Field, number>;
  client_id: string;
  created_at: string;
  provisional: Provisional | null;
}

export function makeLocalCheckin(profile: Profile, c: NewCheckin): LocalCheckin {
  const astronaut_id = seatToCrewId(profile.seat);
  return {
    client_id: c.client_id,
    astronaut_id,
    created_at: c.created_at,
    payload: {
      astronaut_id,
      sol: c.sol,
      ...c.values,
      notes: c.notes,
      client_id: c.client_id,
      measured_at: c.created_at,
      pseudonym: profile.pseudonym,
    },
    sync: 'pending',
    attempts: 0,
    next_attempt_at: null,
    last_error: null,
    provisional: c.provisional,
    server: null,
  };
}
