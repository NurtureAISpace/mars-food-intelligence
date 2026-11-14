import { describe, expect, it } from 'vitest';
import { makeLocalCheckin } from './checkin';
import { firstName, isFullName, normalizeName, pseudonymFor, PSEUDONYM_PATTERN, sha256Fallback, sha256Hex } from './pseudonym';
import type { Profile } from './types';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

describe('pseudonym', () => {
  it('normalizes: trim, lowercase, collapse spaces', () => {
    expect(normalizeName('  Ada   LOVELACE \t')).toBe('ada lovelace');
  });

  it('matches SHA-256("ada lovelace:<salt>") computed independently (Python hashlib)', async () => {
    expect(await pseudonymFor('Ada Lovelace')).toBe('CREW-F594D6');
  });

  it('is stable across spelling of spaces/case and fits the backend pattern', async () => {
    const a = await pseudonymFor('Ada Lovelace');
    expect(await pseudonymFor('  ada   lovelace ')).toBe(a);
    expect(a).toMatch(PSEUDONYM_PATTERN);
    expect(await pseudonymFor('Grace Hopper')).not.toBe(a);
  });

  it('plain-JS fallback equals WebCrypto (for http on a phone, where crypto.subtle is missing)', async () => {
    for (const s of ['', 'abc', 'ada lovelace:nurtureai-space-pseudonym-v1', 'x'.repeat(55), 'y'.repeat(64), 'z'.repeat(200)]) {
      expect(hex(sha256Fallback(new TextEncoder().encode(s)))).toBe(await sha256Hex(s));
    }
    expect(hex(sha256Fallback(new TextEncoder().encode('abc'))))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('full name needs first + last; greeting uses the first name', () => {
    expect(isFullName('Ada')).toBe(false);
    expect(isFullName(' Ada  Lovelace ')).toBe(true);
    expect(firstName('  Ada Lovelace')).toBe('Ada');
  });
});

describe('check-in payload', () => {
  it('carries seat crew id + pseudonym and never the name', async () => {
    const profile: Profile = { name: 'Ada Lovelace', seat: 3, pseudonym: await pseudonymFor('Ada Lovelace'), created_at: '2026-11-14T06:00:00Z' };
    const e = makeLocalCheckin(profile, {
      sol: 12, notes: null, client_id: '3f2b8c1e-6a4d-4e2f-9b1a-0c7d5e8f9a10', created_at: '2026-11-14T06:30:00Z', provisional: null,
      values: { heart_rate_bpm: 64, systolic_mmHg: 112, diastolic_mmHg: 72, blood_glucose_mg_dl: 88, body_temp_c: 36.7, sleep_hours: 7.5, mood_1_5: 4 },
    });
    expect(e.payload.astronaut_id).toBe('C003');
    expect(e.payload.pseudonym).toBe('CREW-F594D6');
    const sent = JSON.stringify(e.payload).toLowerCase();
    expect(sent).not.toContain('ada');
    expect(sent).not.toContain('lovelace');
    expect(Object.keys(e.payload)).not.toContain('name');
  });
});
