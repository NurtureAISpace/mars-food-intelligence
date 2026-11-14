import React, { useEffect, useState } from 'react';
import { fetchDashboardTelemetry } from '../api';
import { DashboardTelemetry } from '../types';
import { AlertTriangle, CheckCircle2, Leaf, Thermometer, ShieldAlert, Zap, Clock, ArrowRight, HeartPulse } from 'lucide-react';

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
      <div className="flex items-center justify-center min-h-[450px]">
        <div className="text-center font-mono text-slate-300">
          <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Acquiring Sol-450 Habitat Telemetry Stream...
        </div>
      </div>
    );
  }

  const securityColor = (telemetry?.food_security_index_pct ?? 0) > 75 
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15'
    : (telemetry?.food_security_index_pct ?? 0) > 45 
    ? 'text-amber-400 border-amber-500/40 bg-amber-500/15'
    : 'text-red-400 border-red-500/40 bg-red-500/20';

  return (
    <div className="space-y-6">
      {/* Hero Banner Directing to Crew Health */}
      <div className="nova-panel-orange rounded-2xl p-4 sm:p-5 border border-orange-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-white">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
            <HeartPulse className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-bold font-sans text-sm sm:text-base">NASA Space Apps Challenge 2026 Core Solution: Crew Health</h3>
            <p className="text-xs text-slate-300 font-sans mt-0.5">
              Follow food degradation kinetics all the way into the astronaut's body. Early warning alerts fire before crossing the risk threshold.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('crewhealth')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-mono text-xs font-bold hover:shadow-lg hover:shadow-orange-500/30 transition flex items-center space-x-2 shrink-0"
        >
          <span>Open Crew Health</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Sol Controller Bar */}
      <div className="nova-panel rounded-2xl p-5 sm:p-6 border border-white/10 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-orange-400 tracking-wider uppercase">Mission Timeline Scrubber</span>
              <span className="text-xs text-slate-400">• Sol-450 Target Horizon</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
              MARS SOL {missionSol} <span className="text-sm font-normal text-slate-400">({(missionSol * 1.0275).toFixed(0)} Earth Days)</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-300">Crew Size:</span>
              <select
                value={crewSize}
                onChange={(e) => setCrewSize(Number(e.target.value))}
                className="bg-mars-void border border-white/15 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
              >
                <option value={2}>2 Crew</option>
                <option value={4}>4 Crew (Nominal)</option>
                <option value={6}>6 Crew (Expanded)</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              {[100, 192, 300, 450, 600].map((s) => (
                <button
                  key={s}
                  onClick={() => setMissionSol(s)}
                  className={`px-2.5 py-1.5 text-xs font-mono rounded-lg transition-all ${
                    missionSol === s
                      ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/30'
                      : 'bg-mars-void border border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  Sol {s}
                </button>
              ))}
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
            className="w-full accent-orange-500 cursor-pointer h-2 bg-mars-void rounded-lg"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
            <span>Sol 0 (Mars Landing)</span>
            <span>Sol 192 (ACT Alert Early Warning)</span>
            <span className="text-orange-400 font-bold">Sol 450 (Target Milestone)</span>
            <span>Sol 600 (Ascent Preparation)</span>
            <span>Sol 800 (Extended Transit)</span>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Food Security Gauge */}
        <div className="nova-panel rounded-2xl p-5 border border-white/10 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400 font-semibold">Food Security Index</p>
              <h3 className="text-3xl font-mono font-bold text-white mt-1">
                {telemetry?.food_security_index_pct}%
              </h3>
            </div>
            <div className={`p-2.5 rounded-xl border ${securityColor}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-mars-void h-2.5 rounded-full mt-3 overflow-hidden border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (telemetry?.food_security_index_pct ?? 0) > 70
                  ? 'bg-emerald-500'
                  : (telemetry?.food_security_index_pct ?? 0) > 40
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${telemetry?.food_security_index_pct ?? 0}%` }}
            />
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">
            Composite: Calories + Thiamine + Vit-C + Sensory
          </p>
        </div>

        {/* Days of Rations Left */}
        <div className="nova-panel rounded-2xl p-5 border border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400 font-semibold">Rations Remaining</p>
              <h3 className="text-3xl font-mono font-bold text-white mt-1">
                {telemetry?.days_of_rations_remaining} <span className="text-sm font-normal text-slate-400">Sols</span>
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] font-mono text-slate-300 mt-3">
            Inventory Mass: <strong className="text-white">{telemetry?.remaining_food_mass_kg} kg</strong>
          </p>
          <p className="text-[11px] font-mono text-emerald-400 mt-0.5 font-bold">
            Burn Rate: {(crewSize * 1.5).toFixed(1)} kg / Sol
          </p>
        </div>

        {/* Bio-regenerative Crop Harvest */}
        <div className="nova-panel rounded-2xl p-5 border border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400 font-semibold">Fresh Crop Biomass</p>
              <h3 className="text-3xl font-mono font-bold text-emerald-400 mt-1">
                {telemetry?.daily_crop_harvest_biomass_g} <span className="text-sm font-normal text-slate-400">g/Sol</span>
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Leaf className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] font-mono text-slate-300 mt-3">
            Active Chambers: <strong className="text-white">{telemetry?.total_active_crops} BLSS Modules</strong>
          </p>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            Microgreens, Spirulina, Dwarf Potato, Tomato
          </p>
        </div>

        {/* Thermal Chilling Power */}
        <div className="nova-panel rounded-2xl p-5 border border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400 font-semibold">Thermal Chilling Power</p>
              <h3 className="text-3xl font-mono font-bold text-cyan-400 mt-1">
                {telemetry?.habitat_cooling_power_kw} <span className="text-sm font-normal text-slate-400">kW</span>
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] font-mono text-slate-300 mt-3">
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
        <div className="nova-panel rounded-2xl p-5 sm:p-6 border border-white/10 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-orange-400" />
              <h3 className="font-mono font-bold text-white text-sm">HABITAT LIFE SUPPORT & ACTIVE ADVISORIES</h3>
            </div>
            {/* Honest compliance label */}
            <span className="text-xs font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
              SYNTHETIC SCENARIO
            </span>
          </div>

          <div className="space-y-3 mt-4">
            {telemetry?.active_alerts.map((alert, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
                  alert.level === 'WARNING'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                    : 'bg-mars-void/80 border-white/10 text-slate-300'
                }`}
              >
                {alert.level === 'WARNING' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-xs font-mono">
                  <p className="font-semibold text-white">{alert.message}</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    {alert.level === 'WARNING'
                      ? 'Recommendation: Reallocate power to storage chiller or increase Spirulina diet ration.'
                      : 'Photobioreactor and aeroponic transpiration loops operate within nominal parameters.'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 p-4 rounded-xl bg-mars-void/90 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-mono">
              <span className="text-orange-400 font-bold block uppercase tracking-wider">Scientific Prediction Principle</span>
              <span className="text-slate-300 text-[11px] block mt-0.5">
                Nutrient breakdown is simulated via 1st-order Arrhenius kinetics ($k = A e^{'{'}-E_a / RT{'}'}$); kinetic constants in this view are illustrative; see Data Lab for the comparison with published retention data.
              </span>
            </div>
            <button
              onClick={() => onNavigate('prediction')}
              className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-mono font-bold flex items-center space-x-1.5 shrink-0 shadow-md shadow-orange-500/20"
            >
              <span>Inspect Kinetics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Launchers */}
        <div className="space-y-4">
          <div className="nova-panel rounded-2xl p-5 border border-white/10">
            <div className="flex items-center space-x-2 text-orange-400 mb-2">
              <Zap className="w-4 h-4" />
              <h4 className="font-mono font-bold text-sm text-white">SciPy Diet Optimizer</h4>
            </div>
            <p className="text-xs text-slate-300 font-mono mb-4 leading-relaxed">
              Solve the linear programming equation for today's crew ration minimizing payload stowage mass and refrigeration energy.
            </p>
            <button
              onClick={() => onNavigate('optimization')}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-mono text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/25"
            >
              <span>Solve Today's Diet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="nova-panel rounded-2xl p-5 border border-white/10">
            <div className="flex items-center space-x-2 text-cyan-400 mb-2">
              <Thermometer className="w-4 h-4" />
              <h4 className="font-mono font-bold text-sm text-white">Thermal Failure Stress Test</h4>
            </div>
            <p className="text-xs text-slate-300 font-mono mb-4 leading-relaxed">
              Simulate cooling loop breakdown at Sol 150, heating rations to 31.5°C. View degradation trajectories and drop-dead Sols.
            </p>
            <button
              onClick={() => onNavigate('simulator')}
              className="w-full py-2.5 rounded-xl bg-mars-void hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold transition flex items-center justify-center space-x-2"
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
