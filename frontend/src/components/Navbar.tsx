import React, { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, Compass, Cpu, Database, Droplets, Menu, X } from 'lucide-react';
import type { CrewStatus } from '../types';
import { STATUS_TONE, TONE } from '../ui/tokens';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  crewStatus: CrewStatus | null; // worst status for the Crew Health scenario/Sol
  crewSol: number;
}

type Tab = { id: string; label: string; icon?: React.ComponentType<{ className?: string }> };

// Primary navigation (challenge story first). Everything else stays reachable under "More".
export const PRIMARY_TABS: Tab[] = [
  { id: 'crewhealth', label: 'Crew Health' },
  { id: 'realdata', label: 'Real NASA Data' },
  { id: 'prediction', label: 'Food & Vitamins' },
];

export const MORE_TABS: Tab[] = [
  { id: 'dashboard', label: 'Mission Dashboard', icon: Activity },
  { id: 'datalab', label: 'Data Laboratory', icon: Database },
  { id: 'optimization', label: 'SciPy Optimizer', icon: Cpu },
  { id: 'simulator', label: 'Mission Simulator', icon: Compass },
  { id: 'lifesupport', label: 'Life Support Sim', icon: Droplets },
];

/** Closes a popover on outside click / Escape. */
function useDismiss(open: boolean, setOpen: (v: boolean) => void, ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen, ref]);
}

const Wordmark: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="group flex items-center gap-2.5" aria-label="NurtureAISpace — go to Crew Health">
    <span className="relative grid h-7 w-7 place-items-center" aria-hidden>
      <span className="planet planet-mars h-4 w-4" />
      <span className="absolute inset-0 rounded-full border border-white/25" style={{ transform: 'rotate(-20deg) scaleY(0.38)' }} />
    </span>
    <span className="font-display text-[15px] font-bold tracking-[0.04em] text-fg">
      NURTURE<span className="text-accent">AI</span>SPACE
    </span>
  </button>
);

const CrewStatusPill: React.FC<{ status: CrewStatus | null; sol: number; compact?: boolean; onClick: () => void }> = ({
  status, sol, compact, onClick,
}) => {
  const tone = status ? TONE[STATUS_TONE[status]] : TONE.neutral;
  const isAct = status === 'ACT';
  return (
    <button
      onClick={onClick}
      title={`Worst crew status at Sol ${sol} for the selected Crew Health scenario`}
      className={`inline-flex items-center gap-2 rounded-full border bg-black/40 backdrop-blur-md font-mono text-[11px] uppercase tracking-[0.16em] transition hover:bg-white/[0.06] ${
        tone.border
      } ${compact ? 'px-2.5 py-1.5' : 'px-3.5 py-2'} ${isAct ? 'glow-act' : ''}`}
    >
      <span className={`h-2 w-2 rounded-full ${tone.dot} ${isAct ? 'animate-pulse' : ''}`} />
      {!compact && <span className="text-muted">Crew status ·</span>}
      <span className={`font-semibold ${tone.text}`}>{status ?? '…'}</span>
      {!compact && <span className="border-l border-white/15 pl-2 text-muted">Sol {sol}</span>}
    </button>
  );
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, crewStatus, crewSol }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  useDismiss(moreOpen, setMoreOpen, moreRef);
  useDismiss(mobileOpen, setMobileOpen, mobileRef);
  const activeMore = MORE_TABS.find((t) => t.id === activeTab);

  const go = (id: string) => { setActiveTab(id); setMoreOpen(false); setMobileOpen(false); window.scrollTo({ top: 0 }); };

  const pillItem = (isActive: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
      isActive ? 'bg-accent text-white shadow-[0_0_20px_-4px_rgba(255,107,44,0.7)]' : 'text-soft hover:text-fg hover:bg-white/[0.06]'
    }`;

  return (
    <header ref={mobileRef} className="sticky top-0 z-50 bg-gradient-to-b from-ink via-ink/85 to-transparent px-4 pb-4 pt-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between gap-4">
        <Wordmark onClick={() => go('crewhealth')} />

        {/* Desktop: floating glass pill, centered */}
        <nav aria-label="Primary" className="absolute left-1/2 hidden -translate-x-1/2 xl:block">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl">
            {PRIMARY_TABS.map((t) => (
              <button key={t.id} onClick={() => go(t.id)} className={pillItem(activeTab === t.id)} aria-current={activeTab === t.id ? 'page' : undefined}>
                {t.label}
              </button>
            ))}
            <div className="relative" ref={moreRef}>
              <button onClick={() => setMoreOpen((o) => !o)} aria-haspopup="menu" aria-expanded={moreOpen}
                className={`${pillItem(Boolean(activeMore))} inline-flex items-center gap-1`}>
                {activeMore ? `More · ${activeMore.label}` : 'More'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div role="menu" className="card reveal absolute right-0 mt-3 w-60 !rounded-xl bg-ink/90 p-1.5">
                  {MORE_TABS.map((t) => {
                    const Icon = t.icon!;
                    const isActive = activeTab === t.id;
                    return (
                      <button key={t.id} role="menuitem" onClick={() => go(t.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                          isActive ? 'bg-accent/15 text-accent' : 'text-soft hover:bg-white/[0.06] hover:text-fg'
                        }`}>
                        <Icon className="h-4 w-4" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <CrewStatusPill status={crewStatus} sol={crewSol} onClick={() => go('crewhealth')} />
          </span>
          <span className="sm:hidden">
            <CrewStatusPill status={crewStatus} sol={crewSol} compact onClick={() => go('crewhealth')} />
          </span>
          <button
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-fg backdrop-blur-md xl:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} aria-controls="mobile-nav"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet menu */}
      {mobileOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="card reveal mx-auto mt-2 max-w-[1440px] bg-ink/90 p-2 xl:hidden">
          {PRIMARY_TABS.map((t, i) => (
            <button key={t.id} onClick={() => go(t.id)} aria-current={activeTab === t.id ? 'page' : undefined}
              className={`flex w-full items-baseline gap-3 rounded-xl px-4 py-3 text-left transition ${
                activeTab === t.id ? 'bg-accent/15 text-fg' : 'text-soft hover:bg-white/[0.05]'
              }`}>
              <span className="font-mono text-[11px] text-accent">0{i + 1}</span>
              <span className="display text-xl">{t.label}</span>
            </button>
          ))}
          <div className="mt-2 border-t border-line px-4 pb-1 pt-3"><span className="eyebrow">More</span></div>
          <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {MORE_TABS.map((t) => {
              const Icon = t.icon!;
              return (
                <button key={t.id} onClick={() => go(t.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-left text-sm transition ${
                    activeTab === t.id ? 'bg-accent/15 text-accent' : 'text-soft hover:bg-white/[0.05]'
                  }`}>
                  <Icon className="h-4 w-4" />{t.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
};
