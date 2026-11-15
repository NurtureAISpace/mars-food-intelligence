import { firstName } from '../pseudonym';
import type { Profile } from '../types';
import { bannerText, type SyncView } from '../syncView';
import { STATIC_DEMO } from '../api';

const BANNER = {
  ok: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200',
  waiting: 'border-amber-400/50 bg-amber-500/15 text-amber-100',
  error: 'border-red-400/60 bg-red-500/15 text-red-100',
};
const ICON = { ok: '✓', waiting: '⏳', error: '!' };

/** Sync status, always at the top: green / amber / red. */
export function SyncBanner({ view }: { view: SyncView }) {
  if (STATIC_DEMO) {
    return (
      <div role="status" data-testid="sync-banner"
        className="mt-3 flex items-start gap-2.5 rounded-xl border border-sky-400/50 bg-sky-500/15 px-4 py-2.5 text-lg font-semibold leading-snug text-sky-100">
        <span aria-hidden className="shrink-0">i</span>
        <span>Online demo: check-ins stay on this device (no server)</span>
      </div>
    );
  }
  const text = bannerText(view);
  return (
    <div role="status" aria-live="polite" data-testid="sync-banner"
      className={`mt-3 flex items-start gap-2.5 rounded-xl border px-4 py-2.5 text-lg font-semibold leading-snug ${BANNER[view.kind]}`}>
      <span aria-hidden className="shrink-0">{ICON[view.kind]}</span>
      <span>{text}</span>
    </div>
  );
}

export function Header({ profile, sync, onChangeProfile }: {
  profile: Profile | null;
  sync: SyncView | null;
  onChangeProfile: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 bg-slate-950/60 backdrop-blur-md border-b border-white/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="flex items-center gap-3 min-w-0">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="NurtureAI Space logo" className="w-9 h-9 object-contain shrink-0" />
        {profile ? (
          <div className="min-w-0">
            {/* The name is shown only here, on this device. */}
            <div className="text-xl font-semibold text-white truncate">
              Hi, {firstName(profile.name)} <span className="text-slate-400 font-normal">·</span>{' '}
              <span className="font-mono text-lg text-slate-200" title="Only this code is sent">{profile.pseudonym}</span>
            </div>
            <button onClick={onChangeProfile} className="min-h-8 text-base text-indigo-300 underline underline-offset-4">
              Change name
            </button>
          </div>
        ) : (
          <span className="text-xl font-semibold text-white">Astronaut</span>
        )}
      </div>
      {(sync || STATIC_DEMO) && <SyncBanner view={sync ?? { kind: 'ok' }} />}
    </header>
  );
}
