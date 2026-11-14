import { describe, expect, it } from 'vitest';
import { isReservedCrewId, seatToCrewId } from './config';
import { chooseGuestSlot, migratePending, migrateProfile, pickGuestSeat } from './guest';
import { bannerText, syncView } from './syncView';
import type { LocalCheckin, Profile, ServerHistory } from './types';

const profile = (seat: number): Profile => ({ name: 'Ada Lovelace', seat, pseudonym: 'CREW-F594D6', created_at: '2026-11-14T06:00:00Z' });

function local(id: string, astronaut_id: string, sync: LocalCheckin['sync'] = 'pending'): LocalCheckin {
  return {
    client_id: id, astronaut_id, created_at: '2026-11-14T07:00:00Z', sync, attempts: 0, next_attempt_at: null,
    last_error: null, provisional: null, server: null,
    payload: {
      astronaut_id, sol: 1, heart_rate_bpm: 64, systolic_mmHg: 112, diastolic_mmHg: 72, blood_glucose_mg_dl: 88,
      body_temp_c: 36.7, sleep_hours: 7.5, mood_1_5: 4, client_id: id, measured_at: '2026-11-14T07:00:00Z',
    },
  };
}

const history = (times: string[]): ServerHistory => ({
  astronaut_id: 'x', count: times.length, streak: { current_sols: 0, last_sol: null, total_checkins: times.length },
  checkins: times.map((t) => ({ recorded_at: t } as ServerHistory['checkins'][number])),
});

describe('guest seats', () => {
  it('only guest seats map to an id; C00x is reserved', () => {
    expect(seatToCrewId(101)).toBe('GUEST-1');
    expect(seatToCrewId(104)).toBe('GUEST-4');
    for (const s of [1, 2, 3, 4, 100, 105]) expect(() => seatToCrewId(s)).toThrow();
    expect(isReservedCrewId('C001')).toBe(true);
    expect(isReservedCrewId('GUEST-1')).toBe(false);
  });

  it('picks the first free guest slot, else the one with the oldest latest check-in', () => {
    expect(chooseGuestSlot([null, null, null, null])).toBe(1);
    expect(chooseGuestSlot(['2026-11-14T08:00Z', null, null, null])).toBe(2);
    expect(chooseGuestSlot(['2026-11-14T08:00Z', '2026-11-14T06:00Z', '2026-11-14T09:00Z', '2026-11-14T07:00Z'])).toBe(2);
  });

  it('pickGuestSeat reads each guest history; offline falls back to GUEST-1', async () => {
    const byId: Record<string, string[]> = { 'GUEST-1': ['2026-11-14T08:00Z'], 'GUEST-2': [], 'GUEST-3': [], 'GUEST-4': [] };
    expect(await pickGuestSeat(async (id) => history(byId[id]))).toBe(102);
    expect(await pickGuestSeat(async () => { throw new Error('offline'); })).toBe(101);
  });
});

describe('migration of old seat profiles', () => {
  it('moves a crew-seat profile to a guest seat and keeps name and code', async () => {
    const m = await migrateProfile(profile(2), async () => 103);
    expect(m.changed).toBe(true);
    expect(m.profile).toMatchObject({ seat: 103, name: 'Ada Lovelace', pseudonym: 'CREW-F594D6' });
    expect(seatToCrewId(m.profile.seat)).toBe('GUEST-3');
  });

  it('leaves guest profiles alone', async () => {
    const m = await migrateProfile(profile(101), async () => { throw new Error('must not pick'); });
    expect(m).toEqual({ profile: profile(101), changed: false });
  });

  it('moves unsent C00x check-ins to the guest id; synced or guest entries stay', () => {
    const out = migratePending(
      [local('a', 'C002'), local('b', 'C002', 'synced'), local('c', 'GUEST-3')],
      profile(103),
    );
    expect(out.map((e) => e.client_id)).toEqual(['a']);
    expect(out[0].astronaut_id).toBe('GUEST-3');
    expect(out[0].payload.astronaut_id).toBe('GUEST-3');
  });
});

describe('sync banner', () => {
  it('green / amber / red', () => {
    expect(bannerText(syncView({ pending: 0, failed: 0, online: true, lastError: null }))).toBe('All check-ins sent');
    expect(bannerText(syncView({ pending: 2, failed: 0, online: false, lastError: 'Offline' })))
      .toBe("2 check-ins waiting — they send automatically when you're back online");
    expect(syncView({ pending: 1, failed: 0, online: true, lastError: 'retrying' }).kind).toBe('error');
    expect(syncView({ pending: 0, failed: 1, online: true, lastError: null }).kind).toBe('error');
  });
});
