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
      <div className="flex items-center justify-center min-h-[27.7778rem]">
        <div className="text-center font-mono text-muted">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Acquiring Sol-450 Habitat Telemetry Stream...
        </div>
      </div>
    );
  }

  const securityColor = (telemetry?.food_security_index_pct ?? 0) > 75 
    ? 'text-nominal border-nominal/30 bg-nominal/10'
    : (telemetry?.food_security_index_pct ?? 0) > 45 
    ? 'text-watch border-watch/30 bg-watch/10'
    : 'text-act border-act/30 bg-act/10';

  return (
    <div className="space-y-6">
      {/* Sol Controller Bar */}
      <div className="card rounded-xl p-5 border border-white/10 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-accent tracking-wider uppercase">Mission Timeline Scrubber</span>
              <span className="text-xs text-muted">• Sol-450 Target Milestone</span>
            </div>
            <h2 className="display text-3xl text-fg sm:text-4xl mt-1">
              MARS SOL {missionSol} <span className="text-sm font-normal text-muted">({(missionSol * 1.0275).toFixed(0)} Earth Days)</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-soft">Crew Size:</span>
              <select
                value={crewSize}
                onChange={(e) => setCrewSize(Number(e.target.value))}
                className="bg-black/30 border border-white/10 rounded-md px-2.5 py-1 text-sm font-mono text-fg focus:outline-none focus:border-accent"
              >
                <option value={2}>2 Crew</option>
                <option value={4}>4 Crew (Nominal)</option>
                <option value={6}>6 Crew (Expanded)</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setMissionSol(100)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${missionSol === 100 ? 'bg-accent text-fg' : 'bg-black/30 text-soft hover:bg-white/[0.06]'}`}
              >
                Sol 100
              </button>
              <button
                onClick={() => setMissionSol(300)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${missionSol === 300 ? 'bg-accent text-fg' : 'bg-black/30 text-soft hover:bg-white/[0.06]'}`}
              >
                Sol 300
              </button>
              <button
                onClick={() => setMissionSol(450)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${missionSol === 450 ? 'bg-accent text-fg font-bold ring-2 ring-accent' : 'bg-black/30 text-soft hover:bg-white/[0.06]'}`}
              >
                Sol 450 (Target)
              </button>
              <button
                onClick={() => setMissionSol(600)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${missionSol === 600 ? 'bg-accent text-fg' : 'bg-black/30 text-soft hover:bg-white/[0.06]'}`}
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
            className="w-full accent-accent cursor-pointer"
          />
          <div className="flex justify-between text-[0.6111rem] font-mono text-muted mt-1">
            <span>Sol 0 (Mars Landing)</span>
            <span>Sol 250 (Mid-Mission)</span>
            <span className="text-accent font-bold">Sol 450 (Target Milestone)</span>
            <span>Sol 600 (Ascent Preparation)</span>
            <span>Sol 800 (Extended Transit)</span>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Food Security Gauge */}
        <div className="card rounded-xl p-5 border border-white/10 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-muted">Food Security Index</p>
              <h3 className="text-3xl font-mono font-bold text-fg mt-1">
                {telemetry?.food_security_index_pct}%
              </h3>
            </div>
            <div className={`p-2 rounded-lg border ${securityColor}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-white/[0.06] h-2 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (telemetry?.food_security_index_pct ?? 0) > 70 ? 'bg-nominal' : (telemetry?.food_security_index_pct ?? 0) > 40 ? 'bg-watch' : 'bg-act'
              }`}
              style={{ width: `${telemetry?.food_security_index_pct ?? 0}%` }}
            ></div>
          </div>
          <p className="text-[0.6111rem] font-mono text-muted mt-2">
            Composite: Calories + Thiamine + Vit-C + Sensory
          </p>
        </div>

        {/* Days of Rations Left */}
        <div className="card rounded-xl p-5 border border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-muted">Rations Remaining</p>
              <h3 className="text-3xl font-mono font-bold text-fg mt-1">
                {telemetry?.days_of_rations_remaining} <span className="text-sm font-normal text-muted">Sols</span>
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-accent/10 border border-accent/30 text-accent">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[0.6111rem] font-mono text-muted mt-3">
            Inventory Mass: <strong className="text-fg">{telemetry?.remaining_food_mass_kg} kg</strong>
          </p>
          <p className="text-[0.6111rem] font-mono text-nominal mt-0.5">
            Burn Rate: {(crewSize * 1.5).toFixed(1)} kg / Sol
          </p>
        </div>

        {/* Bio-regenerative Crop Harvest */}
        <div className="card rounded-xl p-5 border border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-muted">Fresh Crop Biomass</p>
              <h3 className="text-3xl font-mono font-bold text-nominal mt-1">
                {telemetry?.daily_crop_harvest_biomass_g} <span className="text-sm font-normal text-muted">g/Sol</span>
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-nominal/10 border border-nominal/30 text-nominal">
              <Leaf className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[0.6111rem] font-mono text-muted mt-3">
            Active Chambers: <strong className="text-fg">{telemetry?.total_active_crops} BLSS Modules</strong>
          </p>
          <p className="text-[0.6111rem] font-mono text-muted mt-0.5">
            Microgreens, Spirulina, Dwarf Potato, Tomato
          </p>
        </div>

        {/* Life Support Chilling Load */}
        <div className="card rounded-xl p-5 border border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase text-muted">Thermal Chilling Power</p>
              <h3 className="text-3xl font-mono font-bold text-fg mt-1">
                {telemetry?.habitat_cooling_power_kw} <span className="text-sm font-normal text-muted">kW</span>
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-series-1/10 border border-series-1/30 text-fg">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[0.6111rem] font-mono text-muted mt-3">
            Nominal Cold Storage: <strong className="text-fg">4.0°C Active Peltier</strong>
          </p>
          <p className="text-[0.6111rem] font-mono text-fg mt-0.5">
            Greenhouse Lighting: ~2.16 kW
          </p>
        </div>
      </div>

      {/* Grid: Habitat Advisories + Quick Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Advisories & Status */}
        <div className="card rounded-xl p-5 border border-white/10 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-accent" />
              <h3 className="font-mono font-bold text-fg text-sm">HABITAT HEALTH & ACTIVE ADVISORIES</h3>
            </div>
            <span className="text-xs font-mono text-nominal bg-nominal/10 border border-nominal/30 px-2 py-0.5 rounded">
              SYNTHETIC SCENARIO
            </span>
          </div>

          <div className="space-y-3 mt-4">
            {telemetry?.active_alerts.map((alert, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-lg border flex items-start space-x-3 ${
                  alert.level === 'WARNING'
                    ? 'bg-watch/10 border-watch/30 text-watch'
                    : 'bg-white/[0.06] border-white/10 text-soft'
                }`}
              >
                {alert.level === 'WARNING' ? (
                  <AlertTriangle className="w-5 h-5 text-watch flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-nominal flex-shrink-0 mt-0.5" />
                )}
                <div className="text-xs font-mono">
                  <p className="font-semibold text-fg">{alert.message}</p>
                  <p className="text-muted text-[0.6111rem] mt-0.5">
                    {alert.level === 'WARNING'
                      ? 'Recommendation: Reallocate power to storage chiller or increase Spirulina diet ration.'
                      : 'Photobioreactor and aeroponic transpiration loops operate within nominal parameters.'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 p-4 rounded-lg bg-black/30 border border-white/10 flex items-center justify-between">
            <div className="text-xs font-mono">
              <span className="text-accent font-bold block">SCIENTIFIC PREDICTION PRINCIPLE</span>
              <span className="text-muted">
                Nutrient breakdown is simulated via 1st-order Arrhenius kinetics ($k = A e^{'{'}-E_a / RT{'}'}$); kinetic constants in this view are illustrative; see Data Lab for the comparison with published retention data.
              </span>
            </div>
            <button
              onClick={() => onNavigate('prediction')}
              className="ml-4 px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-fg text-xs font-mono font-medium flex items-center space-x-1 flex-shrink-0"
            >
              <span>Inspect Kinetics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Decision Launchers */}
        <div className="space-y-4">
          <div className="card rounded-xl p-5 border border-white/10">
            <div className="flex items-center space-x-2 text-accent mb-2">
              <Zap className="w-4 h-4" />
              <h4 className="font-mono font-bold text-sm text-fg">SciPy Diet Optimizer</h4>
            </div>
            <p className="text-xs text-muted font-mono mb-4">
              Solve the linear programming equation for today's crew ration minimizing payload stowage mass and refrigeration energy.
            </p>
            <button
              onClick={() => onNavigate('optimization')}
              className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-fg font-mono text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-accent/20"
            >
              <span>Solve Today's Diet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="card rounded-xl p-5 border border-white/10">
            <div className="flex items-center space-x-2 text-fg mb-2">
              <Thermometer className="w-4 h-4" />
              <h4 className="font-mono font-bold text-sm text-fg">Thermal Failure Stress Test</h4>
            </div>
            <p className="text-xs text-muted font-mono mb-4">
              Simulate cooling loop breakdown at Sol 150 or 450, heating rations to 32°C. View degradation trajectories and drop-dead Sols.
            </p>
            <button
              onClick={() => onNavigate('simulator')}
              className="w-full py-2.5 rounded-lg bg-black/30 hover:bg-white/[0.06] border border-series-1/40 text-fg font-mono text-xs font-bold transition flex items-center justify-center space-x-2"
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
