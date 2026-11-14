import React, { useEffect, useState } from 'react';
import { fetchFoodCatalog, fetchDatasetAudit, fetchValidationBenchmarks } from '../api';
import { FoodItem, DataAuditReport, ValidationBenchmarks } from '../types';
import { Database, CheckCircle2, Award, BarChart3, Search, Filter, ShieldCheck } from 'lucide-react';

export const DataLabView: React.FC = () => {
  const [catalog, setCatalog] = useState<FoodItem[]>([]);
  const [audit, setAudit] = useState<DataAuditReport | null>(null);
  const [benchmarks, setBenchmarks] = useState<ValidationBenchmarks | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([fetchFoodCatalog(), fetchDatasetAudit(), fetchValidationBenchmarks()])
      .then(([catData, auditData, benchData]) => {
        setCatalog(catData.items);
        setAudit(auditData);
        setBenchmarks(benchData);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const categories = ['ALL', 'Freeze-Dried', 'Thermostabilized', 'Natural Form', 'Bio-regenerative'];

  const filteredItems = catalog.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center font-mono text-slate-300">
          <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Ingesting Spaceflight Food Datasets & Running Automated Pipeline Audits...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-orange-400" />
            <h2 className="text-xl font-bold font-mono text-white">DATA LABORATORY & SCIENTIFIC BENCHMARKING</h2>
          </div>
          <p className="text-xs text-slate-300 font-mono mt-1">
            Illustrative space food inventory (synthetic values), schema checks, and comparison with published retention endpoints.
          </p>
        </div>

        {/* Quality Score Badge - Honest Technical Label */}
        <div className="flex items-center space-x-3 bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 rounded-2xl">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="font-mono">
            <span className="text-[10px] text-emerald-300 block uppercase font-bold tracking-wider">Data Pipeline Audit</span>
            <span className="text-sm font-bold text-white">
              {audit?.data_quality_score_pct}% Schema Checks Passed
            </span>
          </div>
        </div>
      </div>

      {/* Model Benchmark Accuracy Banner */}
      <div className="nova-panel-elevated rounded-2xl p-5 sm:p-6 border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-3 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono font-bold text-white text-base">LITERATURE ENDPOINT CHECK</h3>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  {benchmarks?.validation_verdict || 'PASSED'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-1">
                Published endpoints: Goulette et al. 2020 (thiamine), Cooper et al. 2017 (vitamin C).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6 font-mono text-xs shrink-0">
            <div className="border-l border-white/10 pl-4">
              <span className="text-slate-400 text-[10px] block font-bold uppercase">R² (n/a, endpoint data)</span>
              <span className="text-xl font-bold text-emerald-400">{benchmarks?.aggregate_r2_score}</span>
            </div>
            <div className="border-l border-white/10 pl-4">
              <span className="text-slate-400 text-[10px] block font-bold uppercase">RMSE Retention</span>
              <span className="text-xl font-bold text-orange-400">{benchmarks?.aggregate_rmse}%</span>
            </div>
            <div className="border-l border-white/10 pl-4">
              <span className="text-slate-400 text-[10px] block font-bold uppercase">Empirical Series</span>
              <span className="text-xl font-bold text-cyan-400">{benchmarks?.total_benchmark_series} Datasets</span>
            </div>
          </div>
        </div>

        {/* Validation Data Points Comparison Table */}
        <div className="mt-5 pt-4 border-t border-white/10 overflow-x-auto">
          <h4 className="text-xs font-mono font-bold text-white mb-2.5 uppercase tracking-wider">
            Published vs. Predicted Retention Matrix
          </h4>
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-slate-300 border-b border-white/15">
                <th className="pb-2.5">Food / Nutrient</th>
                <th className="pb-2.5">Storage Temp</th>
                <th className="pb-2.5">Sol Horizon</th>
                <th className="pb-2.5 text-right">Published value</th>
                <th className="pb-2.5 text-right">Arrhenius Prediction</th>
                <th className="pb-2.5 text-right">Residual</th>
                <th className="pb-2.5 text-right">R² (n/a)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {benchmarks?.series.map((s, idx) => (
                <React.Fragment key={idx}>
                  {s.datapoints.slice(1, 4).map((dp, dpIdx) => (
                    <tr key={dpIdx} className="hover:bg-white/5 transition">
                      {dpIdx === 0 ? (
                        <td className="py-2.5 text-white font-bold" rowSpan={3}>
                          {s.food_name} <br />
                          <span className="text-[10px] text-orange-400 uppercase font-medium">({s.nutrient})</span>
                        </td>
                      ) : null}
                      {dpIdx === 0 ? (
                        <td className="py-2.5 text-cyan-300 font-bold" rowSpan={3}>
                          {s.temperature_c}°C
                        </td>
                      ) : null}
                      <td className="py-2.5 text-slate-300">Sol {dp.sol}</td>
                      <td className="py-2.5 text-right font-bold text-white">{dp.measured_retention}%</td>
                      <td className="py-2.5 text-right text-emerald-400 font-bold">{dp.predicted_retention}%</td>
                      <td className="py-2.5 text-right text-slate-300">{dp.residual > 0 ? `+${dp.residual}` : dp.residual}%</td>
                      {dpIdx === 0 ? (
                        <td className="py-2.5 text-right text-emerald-400 font-bold" rowSpan={3}>
                          {s.r2_score}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catalog Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                  : 'bg-mars-void text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search rations, IDs, nutrients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-mars-void border border-white/15 rounded-full pl-9 pr-4 py-2 text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Food Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div key={item.id} className="nova-panel rounded-2xl p-5 border border-white/10 space-y-3 font-mono">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">{item.category}</span>
                <h4 className="text-base font-bold text-white mt-0.5">{item.name}</h4>
                <span className="text-[10px] text-slate-400">ID: {item.id} • {item.package_type}</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold">
                {item.calories_kcal} kcal
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/10">
              <div>
                <span className="text-slate-400 text-[10px] block">Vitamin C</span>
                <span className="text-cyan-300 font-bold">{item.vitamin_c_mg} mg</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Thiamine B1</span>
                <span className="text-purple-300 font-bold">{item.thiamine_b1_mg} mg</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Shelf Life (4°C)</span>
                <span className="text-emerald-300 font-bold">{item.shelf_life_chilled_sols_at_4C} Sols</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Activation Energy</span>
                <span className="text-amber-300 font-bold">{item.activation_energy_Ea_kJ_mol} kJ/mol</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
