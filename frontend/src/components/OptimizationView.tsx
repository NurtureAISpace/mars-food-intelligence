import React, { useState } from 'react';
import { optimizeDailyDiet } from '../api';
import { OptimizationResponse } from '../types';
import { Cpu, CheckCircle2, AlertCircle, Sparkles, Scale, Zap, Droplets, Utensils } from 'lucide-react';

export const OptimizationView: React.FC = () => {
  const [crewSize, setCrewSize] = useState<number>(4);
  const [missionSol, setMissionSol] = useState<number>(450);
  const [objectiveMode, setObjectiveMode] = useState<string>('BALANCED_HEALTH');
  const [maxBiomass, setMaxBiomass] = useState<number>(1200);
  const [maxWater, setMaxWater] = useState<number>(8.0);
  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = () => {
    setLoading(true);
    setError(null);
    optimizeDailyDiet({
      crew_size: crewSize,
      mission_sol: missionSol,
      storage_temperature_c: 4.0,
      objective_mode: objectiveMode,
      max_biomass_available_g: maxBiomass,
      max_rehydration_water_l: maxWater,
    })
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Optimization solver failed');
        setLoading(false);
      });
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div>
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-bold font-mono text-white">SCIPY DIET & PAYLOAD OPTIMIZATION ENGINE</h2>
        </div>
        <p className="text-xs text-slate-300 font-mono mt-1">
          Solves multi-objective linear programming ($\min c^T x$ subject to $A x \ge b$) to fulfill NASA-STD-3001 reference nutritional constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Constraints & Objective Setup */}
        <div className="nova-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-5">
          <h3 className="font-mono font-bold text-white text-sm border-b border-white/10 pb-3 uppercase">
            Optimizer Bounds & Objective
          </h3>

          {/* Objective Mode */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">Optimization Objective:</label>
            <div className="space-y-2">
              {[
                { id: 'BALANCED_HEALTH', label: 'Balanced Health & Mass', desc: 'Pareto-optimal trade-off' },
                { id: 'MINIMIZE_MASS', label: 'Minimize Payload Mass', desc: 'Stowage conservation priority' },
                { id: 'MINIMIZE_ENERGY', label: 'Minimize Chilling Power', desc: 'Subsystem power saving' },
                { id: 'MAXIMIZE_MICRONUTRIENTS', label: 'Maximize Micronutrients', desc: 'Thiamine & Vit-C surge' },
              ].map((obj) => (
                <div
                  key={obj.id}
                  onClick={() => setObjectiveMode(obj.id)}
                  className={`p-3 rounded-xl border cursor-pointer font-mono text-xs transition-all ${
                    objectiveMode === obj.id
                      ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/10 border-orange-500 text-white ring-1 ring-orange-500/50 shadow-md shadow-orange-500/10'
                      : 'bg-mars-void border-white/10 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="font-bold block text-white">{obj.label}</span>
                  <span className="text-[10px] text-slate-400">{obj.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Crew Size */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-300 font-semibold">Astronaut Crew Count:</span>
              <span className="text-orange-400 font-bold">{crewSize} Crew</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              value={crewSize}
              onChange={(e) => setCrewSize(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-2 bg-mars-void rounded-lg"
            />
          </div>

          {/* Rehydration Water Cap */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-300 font-semibold">Max Rehydration Water:</span>
              <span className="text-cyan-400 font-bold">{maxWater} Liters / Day</span>
            </div>
            <input
              type="range"
              min="2"
              max="16"
              step="0.5"
              value={maxWater}
              onChange={(e) => setMaxWater(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-2 bg-mars-void rounded-lg"
            />
          </div>

          {/* Fresh Biomass Cap */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-300 font-semibold">Available Fresh Biomass:</span>
              <span className="text-emerald-400 font-bold">{maxBiomass} g / Day</span>
            </div>
            <input
              type="range"
              min="200"
              max="3000"
              step="100"
              value={maxBiomass}
              onChange={(e) => setMaxBiomass(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-2 bg-mars-void rounded-lg"
            />
          </div>

          {/* Solve Button */}
          <button
            onClick={handleSolve}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white font-mono text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/25"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Solving Simplex via SciPy...' : 'Run SciPy Linear Solver'}</span>
          </button>
        </div>

        {/* Right 2 Columns: Optimization Results & Meal Breakdown */}
        <div className="nova-panel-elevated rounded-2xl p-5 sm:p-6 border border-white/10 lg:col-span-2 space-y-6">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[350px] text-center p-8">
              <Scale className="w-12 h-12 text-slate-500 mb-3" />
              <h3 className="font-mono text-base font-bold text-white">SciPy Solver Standing By</h3>
              <p className="text-xs font-mono text-slate-300 max-w-md mt-1">
                Configure your mission constraints and click "Run SciPy Linear Solver" to compute the optimal daily ration matrix.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-mono flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Optimal Solution Metrics */}
              <div>
                <h4 className="text-xs font-mono font-bold text-white mb-3 uppercase tracking-wider">
                  Optimal Daily Crew Allocation (Sol {missionSol})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-3.5 rounded-xl bg-mars-void border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Calories / Crew</span>
                    <span className="text-base font-bold text-white mt-1 block">
                      {result.optimal_daily_metrics.calories_per_crew_kcal} kcal
                    </span>
                    <span className="text-[10px] text-emerald-400">Total: {result.optimal_daily_metrics.total_calories_kcal} kcal</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-mars-void border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Protein Provided</span>
                    <span className="text-base font-bold text-emerald-400 mt-1 block">
                      {result.optimal_daily_metrics.total_protein_g} g
                    </span>
                    <span className="text-[10px] text-slate-400">Target: 70g / crew</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-mars-void border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Daily Mass Consumed</span>
                    <span className="text-base font-bold text-cyan-300 mt-1 block">
                      {result.optimal_daily_metrics.total_daily_mass_kg} kg
                    </span>
                    <span className="text-[10px] text-slate-400">Includes packaging</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-mars-void border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Preparation Water</span>
                    <span className="text-base font-bold text-cyan-300 mt-1 block">
                      {result.optimal_daily_metrics.rehydration_water_required_liters} L
                    </span>
                    <span className="text-[10px] text-slate-400">For rehydratables</span>
                  </div>
                </div>
              </div>

              {/* Compliance Gauges */}
              <div>
                <h4 className="text-xs font-mono font-bold text-white mb-3 uppercase tracking-wider">
                  NASA-STD-3001 Constraint Fulfillment
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  {Object.entries(result.nasa_std_3001_compliance).map(([key, pct]) => (
                    <div key={key} className="p-3 rounded-xl bg-mars-void border border-white/10">
                      <span className="text-slate-400 text-[10px] block uppercase font-semibold">{key.replace('_compliance_pct', '')}</span>
                      <span className="text-sm font-bold text-emerald-400 mt-0.5 block">{pct}%</span>
                      <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Allocated Food Servings List */}
              <div>
                <h4 className="text-xs font-mono font-bold text-white mb-2.5 uppercase tracking-wider">
                  Selected Daily Rations Breakdown
                </h4>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-mars-void text-slate-300 uppercase text-[10px] border-b border-white/10">
                      <tr>
                        <th className="p-3">Food Item</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Daily Servings</th>
                        <th className="p-3 text-right">Total Mass</th>
                        <th className="p-3 text-right">Calories Provided</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {result.allocated_food_plan.map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition">
                          <td className="p-3 font-bold text-white">
                            {item.name}
                            <span className="text-[10px] text-slate-400 block font-normal">ID: {item.id}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/10">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-orange-400">
                            {item.daily_servings} servings
                          </td>
                          <td className="p-3 text-right text-slate-300">
                            {item.total_mass_g} g
                          </td>
                          <td className="p-3 text-right text-emerald-400 font-bold">
                            {item.calories_provided} kcal
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
