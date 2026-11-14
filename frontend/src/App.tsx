import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { DataLabView } from './components/DataLabView';
import { PredictionView } from './components/PredictionView';
import { OptimizationView } from './components/OptimizationView';
import { SimulatorView } from './components/SimulatorView';
import { CrewHealthView } from './components/CrewHealthView';
import { LifeSupportView } from './components/LifeSupportView';
import { RealDataView } from './components/RealDataView';
import { useCrewHealth } from './hooks/useCrewHealth';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('crewhealth');
  const [missionSol, setMissionSol] = useState<number>(450); // Mission Dashboard (More) only
  const crew = useCrewHealth(); // Crew Health scenario/Sol — shared with the navbar status pill

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Vertical hairlines at the page edges (editorial grid) */}
      <div aria-hidden className="pointer-events-none fixed inset-y-0 left-1/2 z-0 hidden w-full max-w-[1440px] -translate-x-1/2 border-x border-line sm:block" />

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        crewStatus={crew.snapshot?.crew_status ?? null}
        crewSol={crew.snapshot?.sol ?? crew.dSol}
      />

      <main key={activeTab} className="relative z-10 mx-auto w-full max-w-[1440px] flex-1 px-4 pb-16 sm:px-6 lg:px-10">
        {activeTab === 'crewhealth' && <CrewHealthView crew={crew} />}
        {activeTab === 'realdata' && <RealDataView />}
        {activeTab === 'prediction' && <PredictionView />}
        {activeTab === 'dashboard' && (
          <DashboardView onNavigate={(tab) => setActiveTab(tab)} missionSol={missionSol} setMissionSol={setMissionSol} />
        )}
        {activeTab === 'datalab' && <DataLabView />}
        {activeTab === 'optimization' && <OptimizationView />}
        {activeTab === 'simulator' && <SimulatorView />}
        {activeTab === 'lifesupport' && <LifeSupportView />}
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto] lg:px-10">
          <div>
            <span className="font-display text-sm font-bold tracking-[0.04em] text-fg">
              NURTURE<span className="text-accent">AI</span>SPACE
            </span>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Autonomous space nutrition &amp; crew health engine.{' '}
              <span className="text-soft">Decision-support prototype, not a medical device.</span>
            </p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <li>FastAPI + SciPy</li>
            <li>Arrhenius kinetics</li>
            <li>Simulated scenarios + NASA OSDR</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

export default App;
