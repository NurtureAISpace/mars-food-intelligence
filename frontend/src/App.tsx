import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { DataLabView } from './components/DataLabView';
import { PredictionView } from './components/PredictionView';
import { OptimizationView } from './components/OptimizationView';
import { SimulatorView } from './components/SimulatorView';
import { CrewHealthView } from './components/CrewHealthView';
import { LifeSupportView } from './components/LifeSupportView';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [missionSol, setMissionSol] = useState<number>(450);

  return (
    <div className="min-h-screen bg-mars-dark flex flex-col selection:bg-orange-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} missionSol={missionSol} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigate={(tab) => setActiveTab(tab)}
            missionSol={missionSol}
            setMissionSol={setMissionSol}
          />
        )}
        {activeTab === 'datalab' && <DataLabView />}
        {activeTab === 'prediction' && <PredictionView />}
        {activeTab === 'optimization' && <OptimizationView />}
        {activeTab === 'simulator' && <SimulatorView />}
        {activeTab === 'crewhealth' && <CrewHealthView />}
        {activeTab === 'lifesupport' && <LifeSupportView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-mars-border bg-mars-dark/80 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-4">
          <div>
            <span className="text-white font-bold">NURTUREAISPACE</span> • Sol-450 Deep Space Engine
            <span className="block text-[11px] text-slate-400 mt-0.5">
              Autonomous Space Nutrition & Bio-Regenerative Life Support System (N-BLSS)
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-400">● Backend: FastAPI + SciPy</span>
            <span className="text-cyan-400">● Arrhenius First-Order Kinetics</span>
            <span className="text-orange-400">● Prototype · synthetic scenario data</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
