export function Header({ online, pending, syncing, syncMsg, astronaut, onSync, onChangeCrew }: {
  online: boolean;
  pending: number;
  syncing: boolean;
  syncMsg: string | null;
  astronaut: string | null;
  onSync: () => void;
  onChangeCrew: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 bg-mars-dark/95 backdrop-blur border-b border-mars-border px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/icon.svg" alt="" className="w-8 h-8 rounded-lg" />
          {astronaut ? (
            <button onClick={onChangeCrew} aria-label="Change crew member"
              className="min-h-11 px-3 rounded-lg border border-mars-border text-white font-mono font-bold truncate active:bg-white/5">
              {astronaut} <span className="text-slate-400 font-normal text-xs">change</span>
            </button>
          ) : (
            <span className="text-white font-bold">Astronaut</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${online ? 'text-emerald-300' : 'text-slate-400'}`}
            role="status">
            <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
          <button onClick={onSync} disabled={syncing}
            className="min-h-11 px-3 rounded-lg bg-mars-accent text-white text-sm font-semibold disabled:opacity-60 active:brightness-110">
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={pending ? 'text-sky-300 font-semibold' : 'text-slate-400'}>
          {pending} pending
        </span>
        {syncMsg && <span className="text-slate-400 truncate ml-2">{syncMsg}</span>}
      </div>
    </header>
  );
}
