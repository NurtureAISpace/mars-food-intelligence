import React, { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

type Tab = { id: string; label: string };

// The only 3 screens in navigation. The older "More" screens (Dashboard, Data Lab, Optimizer, Simulator,
// Life Support) keep their code and routes in App.tsx but are intentionally not linked anywhere.
export const PRIMARY_TABS: Tab[] = [
  { id: 'crewhealth', label: 'Crew' },
  { id: 'realdata', label: 'NASA Evidence' },
  { id: 'prediction', label: 'Food & Vitamins' },
];

const Wordmark: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="flex items-center gap-2.5" aria-label="NurtureAISpace — go to Crew">
    <span className="h-3 w-3 rounded-full bg-indigo-400 shadow-[0_0_14px_rgba(129,140,248,0.9)]" aria-hidden />
    <span className="text-[1.1111rem] font-bold tracking-wide text-white">
      NURTURE<span className="text-indigo-300">AI</span>SPACE
    </span>
  </button>
);

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
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
    `min-h-[2.8889rem] rounded-xl px-6 text-[1rem] font-semibold transition whitespace-nowrap ${
      active ? 'bg-indigo-600 text-white shadow-[0_0_24px_-6px_rgba(99,102,241,0.8)]' : 'text-slate-200 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <header ref={ref} className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/60 px-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex h-[4rem] max-w-7xl items-center justify-between gap-4">
        <Wordmark onClick={() => go('crewhealth')} />

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {PRIMARY_TABS.map((t) => (
            <button key={t.id} onClick={() => go(t.id)} className={item(activeTab === t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
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
        <nav id="mobile-nav" aria-label="Mobile" className="mx-auto max-w-7xl space-y-1 pb-4 lg:hidden">
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
