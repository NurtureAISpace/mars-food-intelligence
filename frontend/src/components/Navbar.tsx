import React from 'react';
import { HeartPulse, Activity, TrendingUp, Cpu, Compass, Database, Droplets } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  missionSol: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, missionSol }) => {
  const tabs = [
    { id: 'crewhealth', label: 'Crew Health', icon: HeartPulse, isHero: true },
    { id: 'dashboard', label: 'Habitat Telemetry', icon: Activity, isHero: false },
    { id: 'prediction', label: 'Arrhenius Kinetics', icon: TrendingUp, isHero: false },
    { id: 'optimization', label: 'SciPy Optimizer', icon: Cpu, isHero: false },
    { id: 'simulator', label: 'Mission Simulator', icon: Compass, isHero: false },
    { id: 'lifesupport', label: 'Life Support Sim', icon: Droplets, isHero: false },
    { id: 'datalab', label: 'Data Lab & JSC', icon: Database, isHero: false },
  ];

  return (
    <header className="border-b border-white/10 bg-mars-dark/90 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/25 border border-orange-400/50 relative overflow-hidden">
              <span className="font-mono font-bold text-white text-base sm:text-lg tracking-tight">M45</span>
              <div className="absolute inset-0 bg-white/10 opacity-30 pointer-events-none" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-white text-base sm:text-lg font-mono">
                  NURTURE<span className="text-orange-400">AI</span><span className="text-cyan-400 font-semibold">SPACE</span>
                </span>
                <span className="bg-orange-500/15 text-orange-300 border border-orange-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase hidden sm:inline-block">
                  Sol-450 MVP
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans hidden sm:block">
                Autonomous Space Nutrition & Bio-Life Support System (N-BLSS)
              </p>
            </div>
          </div>

          {/* NOVA Glass Pill Navigation Bar (Always visible & horizontally scrollable on mobile/projector) */}
          <nav className="flex items-center overflow-x-auto no-scrollbar py-1 px-1.5 rounded-full bg-mars-card/90 border border-white/10 shadow-inner max-w-full">
            <div className="flex items-center space-x-1 shrink-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs font-mono font-medium transition-all shrink-0 ${
                      isActive
                        ? tab.isHero
                          ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 ring-1 ring-orange-300/50 font-bold'
                          : 'bg-white/15 text-white shadow-md ring-1 ring-white/20 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-white' : tab.isHero ? 'text-orange-400' : 'text-slate-400'}`} />
                    <span className="whitespace-nowrap">{tab.label}</span>
                    {tab.isHero && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full uppercase tracking-wider font-bold ${
                        isActive ? 'bg-black/30 text-orange-200' : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      }`}>
                        Hero
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Telemetry Status Indicator (Honest prototype claim) */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Decision Support</span>
            </div>
            <div className="text-right font-mono text-xs border-l border-white/10 pl-2.5 sm:pl-3">
              <span className="text-orange-400 font-bold block sm:inline">SOL {missionSol}</span>
              <span className="text-[10px] text-slate-400 block">MARS ORBIT</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
