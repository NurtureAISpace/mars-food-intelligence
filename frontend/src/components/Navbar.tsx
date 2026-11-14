import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Cpu, Database, Activity, TrendingUp, Compass, HeartPulse, Droplets, Satellite, ChevronDown, MoreHorizontal } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  missionSol: number;
}

type Tab = { id: string; label: string; icon: React.ComponentType<{ className?: string }> };

// Primary navigation (challenge story first). Everything else stays reachable under "More".
export const PRIMARY_TABS: Tab[] = [
  { id: 'crewhealth', label: 'Crew Health', icon: HeartPulse },
  { id: 'realdata', label: 'Real NASA Data', icon: Satellite },
  { id: 'prediction', label: 'Food & Vitamins', icon: TrendingUp },
];

export const MORE_TABS: Tab[] = [
  { id: 'dashboard', label: 'Mission Dashboard', icon: Activity },
  { id: 'datalab', label: 'Data Laboratory', icon: Database },
  { id: 'optimization', label: 'SciPy Optimizer', icon: Cpu },
  { id: 'simulator', label: 'Mission Simulator', icon: Compass },
  { id: 'lifesupport', label: 'Life Support Sim', icon: Droplets },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, missionSol }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const activeMore = MORE_TABS.find((t) => t.id === activeTab);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const tabClass = (isActive: boolean) =>
    `flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs font-medium font-mono transition-all ${
      isActive
        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
        : 'text-slate-300 hover:bg-mars-card hover:text-white'
    }`;

  return (
    <header className="border-b border-mars-border bg-mars-dark/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 border border-orange-400/40">
              <span className="font-mono font-bold text-white text-lg">M45</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-white text-lg font-mono">NURTURE<span className="text-orange-400">AI</span><span className="text-cyan-400 font-semibold">SPACE</span></span>
                <span className="bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase">
                  Sol-450 MVP
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous Space Nutrition & Bio-Life Support System (N-BLSS)</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            {PRIMARY_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={tabClass(activeTab === tab.id)}>
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                className={tabClass(Boolean(activeMore))}
              >
                <MoreHorizontal className="w-4 h-4" />
                <span>{activeMore ? `More · ${activeMore.label}` : 'More'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-56 rounded-lg border border-mars-border bg-mars-dark shadow-xl py-1 z-50">
                  {MORE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        role="menuitem"
                        onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }}
                        className={`w-full flex items-center space-x-2 px-3.5 py-2 text-xs font-mono text-left transition-all ${
                          isActive ? 'text-orange-400 bg-orange-500/10' : 'text-slate-300 hover:bg-mars-card hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Telemetry Indicator */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>PROTOTYPE</span>
            </div>
            <div className="hidden sm:block text-right font-mono text-xs text-slate-400 border-l border-mars-border pl-3">
              <span className="text-orange-400 font-bold">SOL {missionSol}</span>
              <span className="text-[10px] text-slate-500 block">MARS SURFACE</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
