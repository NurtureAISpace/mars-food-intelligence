import React from 'react';
import { ShieldCheck, Cpu, Database, Activity, TrendingUp, Compass } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  missionSol: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, missionSol }) => {
  const tabs = [
    { id: 'dashboard', label: 'Mission Dashboard', icon: Activity },
    { id: 'datalab', label: 'Data Laboratory', icon: Database },
    { id: 'prediction', label: 'Prediction & Kinetics', icon: TrendingUp },
    { id: 'optimization', label: 'SciPy Optimizer', icon: Cpu },
    { id: 'simulator', label: 'Mission Simulator', icon: Compass },
  ];

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
                <span className="font-bold tracking-tight text-white text-lg font-mono">NURTURE<span className="text-orange-400">AI</span></span>
                <span className="bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase">
                  Sol-450 MVP
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous Space Nutrition & Bio-Life Support System (N-BLSS)</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs font-medium font-mono transition-all ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                      : 'text-slate-300 hover:bg-mars-card hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Telemetry Indicator */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>NASA STD-3001 OK</span>
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
