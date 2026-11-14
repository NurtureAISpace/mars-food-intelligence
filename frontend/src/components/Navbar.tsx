import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Menu, Stethoscope, X } from 'lucide-react';
import type { CheckinOverallStatus } from '../types';
import { StatusKey, statusText, statusWord } from '../ui/glass';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  crewStatus: CheckinOverallStatus | null; // worst status of the latest Astronaut App check-ins
  crewSol: number | null;
}

type Tab = { id: string; label: string };

// The only 3 screens in navigation. The older "More" screens (Dashboard, Data Lab, Optimizer, Simulator,
// Life Support) keep their code and routes in App.tsx but are intentionally not linked anywhere.
export const PRIMARY_TABS: Tab[] = [
  { id: 'crewhealth', label: 'Crew' },
  { id: 'realdata', label: 'Real NASA Data' },
  { id: 'prediction', label: 'Food & Vitamins' },
];

const PILL_ICON: Record<StatusKey, React.ComponentType<{ className?: string }>> = {
  NOMINAL: CheckCircle2, WATCH: AlertTriangle, ACT: Stethoscope, CALIBRATING: HelpCircle, NONE: HelpCircle,
};

const Wordmark: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="flex items-center gap-2.5" aria-label="NurtureAISpace — go to Crew">
    <span className="h-3 w-3 rounded-full bg-indigo-400 shadow-[0_0_14px_rgba(129,140,248,0.9)]" aria-hidden />
    <span className="text-lg font-bold tracking-wide text-white">
      NURTURE<span className="text-indigo-300">AI</span>SPACE
    </span>
  </button>
);

const CrewStatusPill: React.FC<{ status: CheckinOverallStatus | null; sol: number | null; onClick: () => void }> = ({ status, sol, onClick }) => {
  const key: StatusKey = status ?? 'NONE';
  const I = PILL_ICON[key];
  return (
    <button onClick={onClick} title="Worst status of the latest crew check-ins"
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-slate-950/50 px-4 text-sm font-semibold uppercase tracking-wider text-slate-200 backdrop-blur-md hover:bg-white/10">
      <span>Crew</span>
      <span className="text-slate-500" aria-hidden>·</span>
      <span className={`inline-flex items-center gap-1.5 normal-case tracking-normal ${statusText(key)}`}>
        <I className="h-4 w-4" />{status ? statusWord(key) : 'No check-ins yet'}
      </span>
      {sol !== null && (<><span className="text-slate-500" aria-hidden>·</span><span>Sol {sol}</span></>)}
    </button>
  );
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, crewStatus, crewSol }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMobileOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [mobileOpen]);

  const go = (id: string) => { setActiveTab(id); setMobileOpen(false); window.scrollTo({ top: 0 }); };

  const item = (active: boolean) =>
    `min-h-[48px] rounded-xl px-5 text-lg font-semibold transition whitespace-nowrap ${
      active ? 'bg-indigo-600 text-white shadow-[0_0_24px_-6px_rgba(99,102,241,0.8)]' : 'text-slate-200 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <header ref={ref} className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/60 px-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4">
        <Wordmark onClick={() => go('crewhealth')} />

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {PRIMARY_TABS.map((t) => (
            <button key={t.id} onClick={() => go(t.id)} className={item(activeTab === t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <CrewStatusPill status={crewStatus} sol={crewSol} onClick={() => go('crewhealth')} />
          </span>
          <button
            className="grid h-12 w-12 place-items-center rounded-xl border border-white/15 text-white lg:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} aria-controls="mobile-nav"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="mx-auto max-w-6xl space-y-1 pb-4 lg:hidden">
          <div className="pb-2 sm:hidden">
            <CrewStatusPill status={crewStatus} sol={crewSol} onClick={() => go('crewhealth')} />
          </div>
          {PRIMARY_TABS.map((t) => (
            <button key={t.id} onClick={() => go(t.id)} aria-current={activeTab === t.id ? 'page' : undefined}
              className={`${item(activeTab === t.id)} w-full text-left`}>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
};
