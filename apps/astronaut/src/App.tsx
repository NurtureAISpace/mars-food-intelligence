import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchGuide, fetchHistory, postCheckin } from './api';
import { cache, countPending, deleteCheckin, listCheckins, listPending, saveCheckin } from './db';
import { provisionalCheck } from './provisional';
import { createSyncer, type SyncReport } from './sync';
import type { Field, Guide, LocalCheckin, Profile, ServerHistory } from './types';
import { uuid4 } from './uuid';
import { Header } from './components/Header';
import { Onboarding } from './components/Onboarding';
import { makeLocalCheckin } from './checkin';
import { seatToCrewId } from './config';
import { CheckinForm, type FormValues } from './components/CheckinForm';
import { History } from './components/History';
import { LocalEntryCard } from './components/ui';

// Same demo default as the main dashboard's Daily Check-in, used only when there is no history at all.
const DEFAULT_SOL = 250;
const RETRY_TICK_MS = 10_000;

function describe(r: SyncReport): string {
  const parts: string[] = [];
  if (r.synced) parts.push(`${r.synced} synced`);
  if (r.failed) parts.push(`${r.failed} failed`);
  if (r.retrying) parts.push('will retry');
  if (r.waiting) parts.push(`${r.waiting} waiting`);
  return parts.length ? `Last sync: ${parts.join(', ')}` : 'Nothing to sync';
}

export default function App() {
  const [online, setOnline] = useState(navigator.onLine);
  const [loaded, setLoaded] = useState(false);
  const [guide, setGuide] = useState<{ value: Guide; fetched_at: string } | null>(null);
  // Device profile (name stays here). The seat's crew id is what the backend sees, plus the anonymized code.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const astronaut = profile ? seatToCrewId(profile.seat) : null;
  const [entries, setEntries] = useState<LocalCheckin[]>([]);
  const [server, setServer] = useState<{ value: ServerHistory; fetched_at: string } | null>(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'checkin' | 'history'>('checkin');
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const astronautRef = useRef<string | null>(null);
  astronautRef.current = astronaut;

  const refreshLocal = useCallback(async () => {
    setPending(await countPending());
    const id = astronautRef.current;
    setEntries(id ? await listCheckins(id) : []);
  }, []);

  const refreshServerHistory = useCallback(async () => {
    const id = astronautRef.current;
    if (!id || !navigator.onLine) return;
    try {
      const h = await fetchHistory(id);
      await cache.putHistory(id, h);
      if (astronautRef.current === id) setServer({ value: h, fetched_at: new Date().toISOString() });
    } catch {
      /* keep the cached copy */
    }
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const g = await fetchGuide();
      await cache.putGuide(g);
      setGuide({ value: g, fetched_at: new Date().toISOString() });
    } catch {
      /* offline or backend down: keep the cached guide */
    }
  }, []);

  const syncer = useMemo(
    () =>
      createSyncer(
        { listPending, save: saveCheckin, post: postCheckin, now: Date.now },
        (r, err) => {
          setSyncMsg(r ? describe(r) : `Sync error: ${(err as Error)?.message ?? err}`);
          void refreshLocal();
          if (r?.synced) void refreshServerHistory();
        },
      ),
    [refreshLocal, refreshServerHistory],
  );

  const doSync = useCallback(
    async (force = false) => {
      setSyncing(true);
      try {
        await syncer.sync({ force });
      } catch {
        /* reported through onSettled */
      } finally {
        setSyncing(false);
      }
    },
    [syncer],
  );

  // Start: cached data first (works offline), then refresh from the server and flush the queue.
  useEffect(() => {
    (async () => {
      const [g, p] = await Promise.all([cache.getGuide(), cache.getProfile()]);
      if (g) setGuide(g);
      if (p) setProfile(p);
      setPending(await countPending());
      setLoaded(true);
      await refreshFromServer();
      if (navigator.onLine) await doSync();
    })();
  }, [refreshFromServer, doSync]);

  // online / offline events
  useEffect(() => {
    const on = () => {
      setOnline(true);
      void refreshFromServer();
      void doSync().then(refreshServerHistory);
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refreshFromServer, doSync, refreshServerHistory]);

  // automatic retries once a backoff has passed (runSync skips entries whose time has not come)
  useEffect(() => {
    const t = setInterval(() => {
      if (navigator.onLine && pending > 0 && !syncer.isRunning()) void syncer.sync();
    }, RETRY_TICK_MS);
    return () => clearInterval(t);
  }, [pending, syncer]);

  // crew member changed: cached server history, then fresh
  useEffect(() => {
    setServer(null);
    setEntries([]);
    if (!astronaut) return;
    (async () => {
      const h = await cache.getHistory(astronaut);
      if (h && astronautRef.current === astronaut) setServer(h);
      await refreshLocal();
      await refreshServerHistory();
    })();
  }, [astronaut, refreshLocal, refreshServerHistory]);

  const saveProfile = async (p: Profile) => {
    await cache.putProfile(p); // IndexedDB on this device only
    setProfile(p);
    setEditingProfile(false);
    setLastSubmitted(null);
    setFormKey((k) => k + 1);
    setTab('checkin');
  };

  const submit = async (v: FormValues) => {
    if (!profile || !guide) return;
    const { sol, notes, ...values } = v;
    // Payload = seat crew id + anonymized code; the profile's name is never copied into it (see checkin.ts).
    const entry: LocalCheckin = makeLocalCheckin(profile, {
      sol,
      notes,
      values: values as Record<Field, number>,
      client_id: uuid4(),
      created_at: new Date().toISOString(),
      provisional: provisionalCheck(guide.value, values as Record<Field, number>),
    });
    const client_id = entry.client_id;
    await saveCheckin(entry); // IndexedDB first, always
    await refreshLocal(); // before remounting the form, so the suggested Sol moves on to the next one
    setLastSubmitted(client_id);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0 });
    if (navigator.onLine) void doSync();
  };

  const discard = async (id: string) => {
    if (!window.confirm('Discard this rejected check-in from this device?')) return;
    await deleteCheckin(id);
    if (lastSubmitted === id) setLastSubmitted(null);
    await refreshLocal();
  };

  // Sol suggestion and "last value" hints from local + server history
  const serverEntries = server?.value.checkins ?? [];
  const sols = [...entries.map((e) => e.payload.sol), ...serverEntries.map((s) => s.sol)];
  const defaultSol = sols.length ? Math.max(...sols) + 1 : DEFAULT_SOL;
  const lastValues = useMemo(() => {
    const all = [
      ...entries.map((e) => ({ sol: e.payload.sol, t: e.created_at, v: e.payload })),
      ...serverEntries.map((s) => ({ sol: s.sol, t: s.recorded_at, v: s })),
    ].sort((a, b) => b.sol - a.sol || (a.t < b.t ? 1 : -1));
    return all[0]?.v as Partial<Record<Field, number>> | undefined;
  }, [entries, serverEntries]);
  const justSubmitted = entries.find((e) => e.client_id === lastSubmitted);

  if (!loaded) {
    return <div className="min-h-screen grid place-items-center text-lg text-slate-300">Loading…</div>;
  }

  return (
    <div className="min-h-screen text-slate-100 max-w-xl mx-auto flex flex-col">
      <Header online={online} pending={pending} syncing={syncing} syncMsg={syncMsg} profile={profile}
        onSync={() => void doSync(true).then(refreshServerHistory)} onChangeProfile={() => setEditingProfile(true)} />

      <main className="flex-1 pb-24">
        {!profile || editingProfile ? (
          <Onboarding current={profile} onSave={saveProfile}
            onCancel={profile ? () => setEditingProfile(false) : undefined} />
        ) : tab === 'checkin' ? (
          <>
            {justSubmitted && (
              <div className="px-4 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl text-white font-semibold">Saved</h2>
                  <button onClick={() => setLastSubmitted(null)} className="min-h-11 px-3 text-base text-slate-300">Hide</button>
                </div>
                <LocalEntryCard e={justSubmitted} onDiscard={discard} />
              </div>
            )}
            {guide ? (
              <CheckinForm key={`${astronaut}-${formKey}`} guide={guide.value} guideFetchedAt={guide.fetched_at}
                defaultSol={defaultSol} takenSols={new Set(sols)} last={lastValues} onSubmit={submit} />
            ) : (
              <p className="m-4 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-base">
                The check-in guide (indicators and ranges) has not been downloaded yet. Connect to the backend once;
                after that the form works fully offline.
              </p>
            )}
          </>
        ) : (
          <History local={entries} server={server?.value ?? null} serverFetchedAt={server?.fetched_at ?? null}
            online={online} onDiscard={discard} />
        )}
        {guide && <p className="px-4 pb-4 text-sm text-slate-400 text-center">{guide.value.disclaimer}</p>}
      </main>

      {profile && !editingProfile && (
        <nav className="fixed bottom-0 inset-x-0 bg-slate-950/70 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-xl mx-auto grid grid-cols-2">
            {(['checkin', 'history'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined}
                className={`min-h-16 text-lg font-semibold ${tab === t ? 'text-white border-t-2 border-indigo-400' : 'text-slate-300'}`}>
                {t === 'checkin' ? 'Check-in' : 'History'}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
