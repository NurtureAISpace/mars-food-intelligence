import { firstName } from '../pseudonym';
import type { Profile } from '../types';
import { seatLabel } from '../config';

export function Header({ online, pending, syncing, syncMsg, profile, onSync, onChangeProfile }: {
  online: boolean;
  pending: number;
  syncing: boolean;
  syncMsg: string | null;
  profile: Profile | null;
  onSync: () => void;
  onChangeProfile: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 bg-slate-950/60 backdrop-blur-md border-b border-white/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/icon.svg" alt="" className="w-9 h-9 rounded-lg" />
          {profile ? (
            <button onClick={onChangeProfile} aria-label="Change name or seat" className="min-h-11 text-left min-w-0">
              {/* The name is shown only here, on this device. */}
              <span className="block text-lg font-semibold text-white truncate">Hi, {firstName(profile.name)}</span>
              <span className="block text-sm text-slate-300 font-mono truncate" title="Name stays on this device">
                {profile.pseudonym} · {seatLabel(profile.seat)} <span className="font-sans text-indigo-300">change</span>
              </span>
            </button>
          ) : (
            <span className="text-lg font-semibold text-white">Astronaut</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1.5 text-sm font-semibold ${online ? 'text-emerald-300' : 'text-slate-300'}`}
            role="status">
            <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
          <button onClick={onSync} disabled={syncing}
            className="min-h-11 px-4 rounded-xl bg-indigo-600 text-white text-base font-semibold disabled:opacity-60 active:brightness-110">
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className={pending ? 'text-sky-300 font-semibold' : 'text-slate-300'}>
          {pending} pending
        </span>
        {syncMsg && <span className="text-slate-300 truncate ml-2">{syncMsg}</span>}
      </div>
    </header>
  );
}
