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
import { useCrewCheckins } from './hooks/useCrewCheckins';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('crewhealth');
  const [missionSol, setMissionSol] = useState<number>(450); // hidden Mission Dashboard only
  const crew = useCrewCheckins(); // latest Astronaut App check-ins — shared with the navbar status pill
  const goHome = () => { setActiveTab('crewhealth'); window.scrollTo({ top: 0 }); };

  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        crewStatus={crew.worst}
        crewSol={crew.currentSol}
      />

      <main key={activeTab} className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {/* The 3 screens in navigation */}
        {activeTab === 'crewhealth' && <CrewHealthView crew={crew} onNavigate={setActiveTab} />}
        {activeTab === 'realdata' && <RealDataView onBack={goHome} />}
        {activeTab === 'prediction' && <PredictionView onBack={goHome} />}

        {/* Hidden "More" screens: code and routes kept, not linked from the navigation. */}
        {activeTab === 'dashboard' && (
          <DashboardView onNavigate={(tab) => setActiveTab(tab)} missionSol={missionSol} setMissionSol={setMissionSol} />
        )}
        {activeTab === 'datalab' && <DataLabView />}
        {activeTab === 'optimization' && <OptimizationView />}
        {activeTab === 'simulator' && <SimulatorView />}
        {activeTab === 'lifesupport' && <LifeSupportView />}
      </main>

      <footer className="relative z-10 px-4 pb-8 text-center text-base text-slate-300">
        NurtureAISpace · decision-support prototype, not a medical device.
      </footer>
    </div>
  );
}

export default App;
