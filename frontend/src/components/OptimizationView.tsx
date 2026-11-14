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
          <Cpu className="w-5 h-5 text-accent" />
          <h2 className="display text-3xl text-fg sm:text-4xl">SCIPY DIET & PAYLOAD OPTIMIZATION ENGINE</h2>
        </div>
        <p className="text-xs text-muted font-mono mt-1">
          Solves multi-objective linear programming ($\min c^T x$ subject to $A x \ge b$) to meet daily nutrient targets (vitamin C/B1: NASA JSC 2005; others assumed).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Constraints & Objective Setup */}
        <div className="card rounded-xl p-5 border border-white/10 space-y-5">
          <h3 className="font-mono font-bold text-fg text-sm border-b border-white/10 pb-3 uppercase">
            Optimizer Bounds & Objective
          </h3>

          {/* Objective Mode */}
          <div>
            <label className="block text-xs font-mono text-soft mb-1.5">Optimization Objective:</label>
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
                  className={`p-3 rounded-lg border cursor-pointer font-mono text-xs transition ${
                    objectiveMode === obj.id
                      ? 'bg-accent/20 border-accent text-fg'
                      : 'bg-black/30 border-white/10 text-muted hover:border-white/25'
                  }`}
                >
                  <span className="font-bold block text-fg">{obj.label}</span>
                  <span className="text-[10px] text-muted">{obj.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Crew Size */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-soft">Astronaut Crew Count:</span>
              <span className="text-accent font-bold">{crewSize} Crew</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              value={crewSize}
              onChange={(e) => setCrewSize(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Rehydration Water Cap */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-soft">Max Rehydration Water:</span>
              <span className="text-fg font-bold">{maxWater} Liters / Day</span>
            </div>
            <input
              type="range"
              min="2"
              max="16"
              step="0.5"
              value={maxWater}
              onChange={(e) => setMaxWater(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Fresh Biomass Cap */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-soft">Available Fresh Biomass:</span>
              <span className="text-nominal font-bold">{maxBiomass} g / Day</span>
            </div>
            <input
              type="range"
              min="200"
              max="3000"
              step="100"
              value={maxBiomass}
              onChange={(e) => setMaxBiomass(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Solve Button */}
          <button
            onClick={handleSolve}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-fg font-mono text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-accent/25"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Solving Simplex via SciPy...' : 'Run SciPy Linear Solver'}</span>
          </button>
        </div>

        {/* Right 2 Columns: Optimization Results & Meal Breakdown */}
        <div className="card rounded-xl p-5 border border-white/10 lg:col-span-2 space-y-6">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[350px] text-center p-8">
              <Scale className="w-12 h-12 text-muted mb-3" />
              <h3 className="font-mono text-base font-bold text-fg">Solver Standing By</h3>
              <p className="text-xs font-mono text-muted max-w-md mt-1">
                Configure your mission constraints and click "Run SciPy Linear Solver" to compute the mathematically optimal daily diet.
              </p>
            </div>
          )}

          {result && (
            <>
              {/* Daily Totals Bar */}
              <div className="border-b border-white/10 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-nominal" />
                    <h3 className="font-mono font-bold text-fg text-sm">
                      OPTIMAL DAILY RATION PLAN ({result.crew_size} CREW • SOL {result.mission_sol})
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-accent uppercase font-semibold">
                    {result.objective_mode}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-black/30 border border-white/10">
                    <span className="text-muted block text-[10px]">TOTAL CALORIES</span>
                    <span className="text-base font-bold text-fg">
                      {result.optimal_daily_metrics.total_calories_kcal.toLocaleString()} kcal
                    </span>
                    <span className="text-[10px] text-nominal block">
                      {result.optimal_daily_metrics.calories_per_crew_kcal} kcal / crew
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-black/30 border border-white/10">
                    <span className="text-muted block text-[10px]">TOTAL PROTEIN</span>
                    <span className="text-base font-bold text-fg">
                      {result.optimal_daily_metrics.total_protein_g} g
                    </span>
                    <span className="text-[10px] text-muted block">Daily target met</span>
                  </div>

                  <div className="p-3 rounded-lg bg-black/30 border border-white/10">
                    <span className="text-muted block text-[10px]">DAILY MASS CONSUMED</span>
                    <span className="text-base font-bold text-fg">
                      {result.optimal_daily_metrics.total_daily_mass_kg} kg
                    </span>
                    <span className="text-[10px] text-muted block">Includes packaging</span>
                  </div>

                  <div className="p-3 rounded-lg bg-black/30 border border-white/10">
                    <span className="text-muted block text-[10px]">PREPARATION WATER</span>
                    <span className="text-base font-bold text-fg">
                      {result.optimal_daily_metrics.rehydration_water_required_liters} L
                    </span>
                    <span className="text-[10px] text-muted block">For rehydratables</span>
                  </div>
                </div>
              </div>

              {/* Compliance Gauges */}
              <div>
                <h4 className="text-xs font-mono font-bold text-soft mb-3 uppercase">Daily Target Coverage</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  {Object.entries(result.nasa_std_3001_compliance).map(([key, pct]) => (
                    <div key={key} className="p-2.5 rounded-lg bg-black/30 border border-white/10">
                      <span className="text-muted text-[10px] block uppercase">{key.replace('_compliance_pct', '')}</span>
                      <span className="text-sm font-bold text-nominal">{pct}%</span>
                      <div className="w-full bg-white/[0.06] h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-nominal rounded-full"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Allocated Food Servings List */}
              <div>
                <h4 className="text-xs font-mono font-bold text-soft mb-2 uppercase">Selected Daily Rations Breakdown</h4>
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-black/30 text-muted uppercase text-[10px] border-b border-white/10">
                      <tr>
                        <th className="p-2.5">Food Item</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-right">Daily Servings</th>
                        <th className="p-2.5 text-right">Total Mass</th>
                        <th className="p-2.5 text-right">Calories Provided</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {result.allocated_food_plan.map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.06]">
                          <td className="p-2.5 font-bold text-fg">
                            {item.name}
                            <span className="text-[10px] text-muted block">ID: {item.id}</span>
                          </td>
                          <td className="p-2.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-soft border border-white/10">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-accent">
                            {item.daily_servings}x
                          </td>
                          <td className="p-2.5 text-right text-soft">
                            {item.total_mass_g} g
                          </td>
                          <td className="p-2.5 text-right font-medium text-nominal">
                            {item.calories_provided} kcal
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
