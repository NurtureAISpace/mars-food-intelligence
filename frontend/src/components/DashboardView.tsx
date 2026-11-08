import React, { useEffect, useState } from 'react';
import { fetchDashboardTelemetry } from '../api';
import { DashboardTelemetry } from '../types';
import { AlertTriangle, CheckCircle2, Leaf, Thermometer, ShieldAlert, Zap, Clock, ArrowRight } from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  missionSol: number;
  setMissionSol: (sol: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, missionSol, setMissionSol }) => {
  const [telemetry, setTelemetry] = useState<DashboardTelemetry | null>(null);
  const [crewSize, setCrewSize] = useState<number>(4);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    fetchDashboardTelemetry(missionSol, crewSize)
      .then((data) => {
        setTelemetry(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [missionSol, crewSize]);

  if (loading && !telemetry) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center font-mono text-slate-400">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Acquiring Sol-450 Habitat Telemetry Stream...
        </div>
      </div>
    );
  }

  const securityColor = (telemetry?.food_security_index_pct ?? 0) > 75 
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : (telemetry?.food_security_index_pct ?? 0) > 45 
    ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
    : 'text-red-400 border-red-500/30 bg-red-500/10';

  return (
    <div className="space-y-6">
      {/* Sol Controller Bar */}
      <div className="glass-panel rounded-xl p-5 border border-mars-border shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-orange-400 tracking-wider uppercase">Mission Timeline Scrubber</span>
              <span className="text-xs text-slate-400">• Sol-450 Target Milestone</span>
            </div>
            <h2 className="text-2xl font-bold font-mono text-white mt-1">
              MARS SOL {missionSol} <span className="text-sm font-normal text-slate-400">({(missionSol * 1.0275).toFixed(0)} Earth Days)</span>
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-300">Crew Size:</span>
              <select
                value={crewSize}
                onChange={(e) => setCrewSize(Number(e.target.value))}
                className="bg-mars-dark border border-mars-border rounded-md px-2.5 py-1 text-sm font-mono text-white focus:outline-none focus:border-orange-500"
              >
                <option value={2}>2 Crew</option>
                <option value={4}>4 Crew (Nominal)</option>
                <option value={6}>6 Crew (Expanded)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setMissionSol(100)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${missionSol === 100 ? 'bg-orange-500 text-white' : 'bg-mars-dark text-slate-300 hover:bg-slate-800'}`}
              >
                Sol 100
              </button>
              <button
                onClick={() => setMissionSol(300)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${missionSol === 300 ? 'bg-orange-500 text-white' : 'bg-mars-dark text-slate-300 hover:bg-slate-800'}`}
              >
                Sol 300
              </button>
              <button
                onClick={() => setMissionSol(450)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${missionSol === 450 ? 'bg-orange-500 text-white font-bold ring-2 ring-orange-400' : 'bg-mars-dark text-slate-300 hover:bg-slate-800'}`}
              >
                Sol 450 (Target)
              </button>
              <button
                onClick={() => setMissionSol(600)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${missionSol === 600 ? 'bg-orange-500 text-white' : 'bg-mars-dark text-slate-300 hover:bg-slate-800'}`}
              >
                Sol 600
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <input
            type="range"
            min="0"
            max="800"
            step="10"
            value={missionSol}
            onChange={(e) => setMissionSol(Number(e.target.value))}
            className="w-full accent-orange-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1">
            <span>Sol 0 (Mars Landing)</span>
            <span>Sol 250 (Mid-Mission)</span>
            <span className="text-orange-400 font-bold">Sol 450 (Target Milestone)</span>
            <span>Sol 600 (Ascent Preparation)</span>
            <span>Sol 800 (Extended Transit)</span>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Food Security Gauge */}
        <div className="glass-panel rounded-xl p-5 border border-mars-border relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400">Food Security Index</p>
              <h3 className="text-3xl font-mono font-bold text-white mt-1">
                {telemetry?.food_security_index_pct}%
              </h3>
            </div>
            <div className={`p-2 rounded-lg border ${securityColor}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (telemetry?.food_security_index_pct ?? 0) > 70 ? 'bg-emerald-500' : (telemetry?.food_security_index_pct ?? 0) > 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${telemetry?.food_security_index_pct ?? 0}%` }}
            ></div>
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">
            Composite: Calories + Thiamine + Vit-C + Sensory
          </p>
        </div>

        {/* Days of Rations Left */}
        <div className="glass-panel rounded-xl p-5 border border-mars-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400">Rations Remaining</p>
              <h3 className="text-3xl font-mono font-bold text-white mt-1">
                {telemetry?.days_of_rations_remaining} <span className="text-sm font-normal text-slate-400">Sols</span>
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-3">
            Inventory Mass: <strong className="text-white">{telemetry?.remaining_food_mass_kg} kg</strong>
          </p>
          <p className="text-[11px] font-mono text-emerald-400 mt-0.5">
            Burn Rate: {(crewSize * 1.5).toFixed(1)} kg / Sol
          </p>
        </div>

        {/* Bio-regenerative Crop Harvest */}
        <div className="glass-panel rounded-xl p-5 border border-mars-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400">Fresh Crop Biomass</p>
              <h3 className="text-3xl font-mono font-bold text-emerald-400 mt-1">
                {telemetry?.daily_crop_harvest_biomass_g} <span className="text-sm font-normal text-slate-400">g/Sol</span>
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Leaf className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-3">
            Active Chambers: <strong className="text-white">{telemetry?.total_active_crops} BLSS Modules</strong>
          </p>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            Microgreens, Spirulina, Dwarf Potato, Tomato
          </p>
        </div>

        {/* Life Support Chilling Load */}
        <div className="glass-panel rounded-xl p-5 border border-mars-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400">Thermal Chilling Power</p>
              <h3 className="text-3xl font-mono font-bold text-cyan-400 mt-1">
                {telemetry?.habitat_cooling_power_kw} <span className="text-sm font-normal text-slate-400">kW</span>
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-3">
            Nominal Cold Storage: <strong className="text-white">4.0°C Active Peltier</strong>
          </p>
          <p className="text-[11px] font-mono text-cyan-400 mt-0.5">
            Greenhouse Lighting: ~2.16 kW
          </p>
        </div>
      </div>

      {/* Grid: Habitat Advisories + Quick Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Advisories & Status */}
        <div className="glass-panel rounded-xl p-5 border border-mars-border lg:col-span-2">
          <div className="flex items-center justify-between border-b border-mars-border pb-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-orange-400" />
              <h3 className="font-mono font-bold text-white text-sm">HABITAT HEALTH & ACTIVE ADVISORIES</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
              NASA-STD-3001 VERIFIED
            </span>
          </div>

          <div className="space-y-3 mt-4">
            {telemetry?.active_alerts.map((alert, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-lg border flex items-start space-x-3 ${
                  alert.level === 'WARNING'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                }`}
              >
                {alert.level === 'WARNING' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-xs font-mono">
                  <p className="font-semibold text-white">{alert.message}</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {alert.level === 'WARNING'
                      ? 'Recommendation: Reallocate power to storage chiller or increase Spirulina diet ration.'
                      : 'Photobioreactor and aeroponic transpiration loops operate within nominal parameters.'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 p-4 rounded-lg bg-mars-dark/80 border border-mars-border flex items-center justify-between">
            <div className="text-xs font-mono">
              <span className="text-orange-400 font-bold block">SCIENTIFIC PREDICTION PRINCIPLE</span>
              <span className="text-slate-400">
                Nutrient breakdown is simulated via 1st-order Arrhenius kinetics ($k = A e^{'{'}-E_a / RT{'}'}$) calibrated against NASA Johnson Space Center empirical food datasets.
              </span>
            </div>
            <button
              onClick={() => onNavigate('prediction')}
              className="ml-4 px-3 py-1.5 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-mono font-medium flex items-center space-x-1 flex-shrink-0"
            >
              <span>Inspect Kinetics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Decision Launchers */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-5 border border-mars-border">
            <div className="flex items-center space-x-2 text-orange-400 mb-2">
              <Zap className="w-4 h-4" />
              <h4 className="font-mono font-bold text-sm text-white">SciPy Diet Optimizer</h4>
            </div>
            <p className="text-xs text-slate-400 font-mono mb-4">
              Solve the linear programming equation for today's crew ration minimizing payload stowage mass and refrigeration energy.
            </p>
            <button
              onClick={() => onNavigate('optimization')}
              className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-mono text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/20"
            >
              <span>Solve Today's Diet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="glass-panel rounded-xl p-5 border border-mars-border">
            <div className="flex items-center space-x-2 text-cyan-400 mb-2">
              <Thermometer className="w-4 h-4" />
              <h4 className="font-mono font-bold text-sm text-white">Thermal Failure Stress Test</h4>
            </div>
            <p className="text-xs text-slate-400 font-mono mb-4">
              Simulate cooling loop breakdown at Sol 150 or 450, heating rations to 32°C. View degradation trajectories and drop-dead Sols.
            </p>
            <button
              onClick={() => onNavigate('simulator')}
              className="w-full py-2.5 rounded-lg bg-mars-dark hover:bg-slate-800 border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold transition flex items-center justify-center space-x-2"
            >
              <span>Launch Mission Simulator</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
