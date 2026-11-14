import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { DataLabView } from './components/DataLabView';
import { PredictionView } from './components/PredictionView';
import { OptimizationView } from './components/OptimizationView';
import { SimulatorView } from './components/SimulatorView';
import { CrewHealthView } from './components/CrewHealthView';

export function App() {
  // Demo-First Navigation: Crew Health is the primary Challenge Hero Screen
  const [activeTab, setActiveTab] = useState<string>('crewhealth');
  const [missionSol, setMissionSol] = useState<number>(192);

  return (
    <div className="min-h-screen deep-space-bg text-slate-100 flex flex-col selection:bg-orange-500 selection:text-white relative">
      {/* Top Atmospheric Gradient Lighting (Inspired by Image 2 NOVA & Image 3 Mars Orbit) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-orange-500/10 via-cyan-500/5 to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Top Floating Glass Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} missionSol={missionSol} />

      {/* Main Mission Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'crewhealth' && (
          <CrewHealthView
            missionSol={missionSol}
            setMissionSol={setMissionSol}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigate={(tab) => setActiveTab(tab)}
            missionSol={missionSol}
            setMissionSol={setMissionSol}
          />
        )}
        {activeTab === 'prediction' && <PredictionView />}
        {activeTab === 'optimization' && <OptimizationView />}
        {activeTab === 'simulator' && <SimulatorView />}
        {activeTab === 'datalab' && <DataLabView />}
      </main>

      {/* Honest Scientific Footer (No unverified claims) */}
      <footer className="border-t border-white/10 bg-mars-void/90 py-6 mt-12 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-400 gap-4">
          <div>
            <span className="text-white font-bold tracking-wider">NURTUREAISPACE</span> • Sol-450 Deep Space Mission Architecture
            <span className="block text-[11px] text-slate-400 mt-0.5 font-sans">
              Autonomous Space Nutrition & Bio-Regenerative Life Support System • Decision-Support Prototype
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px]">
            <span className="text-emerald-400">● FastAPI + SciPy Engine</span>
            <span className="text-cyan-400">● 1st-Order Arrhenius Kinetics</span>
            <span className="text-orange-400">● NASA-STD-3001 Target Standard</span>
            <span className="text-slate-400">● NASA OSDR Inspiration4 Benchmark</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
