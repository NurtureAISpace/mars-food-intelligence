// IndexedDB (via `idb`): every check-in is written here first; the guide and server history are cached here so the
// app works fully offline after one online start. The profile (name, guest seat, crew code) lives here too: the name
// never leaves this device.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Guide, LocalCheckin, Profile, ServerHistory } from './types';

interface CachedValue<T> {
  value: T;
  fetched_at: string;
}

interface AstronautDB extends DBSchema {
  checkins: {
    key: string; // client_id
    value: LocalCheckin;
    indexes: { by_astronaut: string; by_sync: string };
  };
  kv: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<AstronautDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<AstronautDB>('nurtureai-astronaut', 1, {
      upgrade(d) {
        const s = d.createObjectStore('checkins', { keyPath: 'client_id' });
        s.createIndex('by_astronaut', 'astronaut_id');
        s.createIndex('by_sync', 'sync');
        d.createObjectStore('kv');
      },
    });
  }
  return dbPromise;
}

// --- check-ins -------------------------------------------------------------
export async function saveCheckin(entry: LocalCheckin): Promise<void> {
  await (await db()).put('checkins', entry);
}

export async function listPending(): Promise<LocalCheckin[]> {
  return (await db()).getAllFromIndex('checkins', 'by_sync', 'pending');
}

export async function listCheckins(astronautId: string): Promise<LocalCheckin[]> {
  return (await db()).getAllFromIndex('checkins', 'by_astronaut', astronautId);
}

export async function countPending(): Promise<number> {
  return (await db()).countFromIndex('checkins', 'by_sync', 'pending');
}

export async function countFailed(): Promise<number> {
  return (await db()).countFromIndex('checkins', 'by_sync', 'failed');
}

export async function deleteCheckin(clientId: string): Promise<void> {
  await (await db()).delete('checkins', clientId);
}

// --- cached server data ------------------------------------------------------
async function getCached<T>(key: string): Promise<CachedValue<T> | undefined> {
  return (await (await db()).get('kv', key)) as CachedValue<T> | undefined;
}

async function putCached<T>(key: string, value: T): Promise<void> {
  await (await db()).put('kv', { value, fetched_at: new Date().toISOString() } satisfies CachedValue<T>, key);
}

export const cache = {
  getGuide: () => getCached<Guide>('guide'),
  putGuide: (g: Guide) => putCached('guide', g),
  getHistory: (id: string) => getCached<ServerHistory>(`history:${id}`),
  putHistory: (id: string, h: ServerHistory) => putCached(`history:${id}`, h),
  getProfile: async () => (await getCached<Profile>('profile'))?.value ?? null,
  putProfile: (p: Profile) => putCached('profile', p),
};
