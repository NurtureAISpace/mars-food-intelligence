import React, { useEffect, useState } from 'react';
import { fetchFoodCatalog, fetchDatasetAudit, fetchValidationBenchmarks } from '../api';
import { FoodItem, DataAuditReport, ValidationBenchmarks } from '../types';
import { Database, CheckCircle, Award, BarChart3, Search, Filter } from 'lucide-react';

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
      <div className="flex items-center justify-center min-h-[22.2222rem]">
        <div className="text-center font-mono text-muted">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Auditing Data Pipeline & Ingesting Scientific Spaceflight Datasets...
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
            <Database className="w-5 h-5 text-accent" />
            <h2 className="display text-3xl text-fg sm:text-4xl">DATA LABORATORY & SCIENTIFIC BENCHMARKING</h2>
          </div>
          <p className="text-xs text-muted font-mono mt-1">
            Illustrative space food inventory (synthetic values), schema checks, and comparison with published retention endpoints.
          </p>
        </div>

        {/* Quality Score Badge */}
        <div className="flex items-center space-x-3 bg-nominal/10 border border-nominal/30 px-4 py-2 rounded-xl">
          <CheckCircle className="w-6 h-6 text-nominal" />
          <div className="font-mono">
            <span className="text-[0.5556rem] text-nominal block uppercase font-semibold">Data Pipeline Audit</span>
            <span className="text-sm font-bold text-fg">
              {audit?.data_quality_score_pct}% Schema Checks Passed
            </span>
          </div>
        </div>
      </div>

      {/* Model Benchmark Accuracy Banner */}
      <div className="card rounded-xl p-5 border border-white/10 bg-gradient-to-r from-white/[0.04] via-white/[0.04] to-accent/[0.06]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-lg bg-accent/20 border border-accent/40 text-accent flex-shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-mono font-bold text-fg text-sm">LITERATURE ENDPOINT CHECK</h3>
                <span className="text-[0.5556rem] font-mono px-2 py-0.5 rounded bg-nominal/20 text-nominal border border-nominal/40 font-bold">
                  {benchmarks?.validation_verdict}
                </span>
              </div>
              <p className="text-xs text-soft font-mono mt-1">
                Published endpoints: Goulette et al. 2020 (thiamine), Cooper et al. 2017 (vitamin C).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6 font-mono text-xs">
            <div className="border-l border-white/10 pl-4">
              <span className="text-muted text-[0.5556rem] block">R² (n/a, endpoint data)</span>
              <span className="text-lg font-bold text-nominal">{benchmarks?.aggregate_r2_score}</span>
            </div>
            <div className="border-l border-white/10 pl-4">
              <span className="text-muted text-[0.5556rem] block">ROOT MEAN SQ ERROR</span>
              <span className="text-lg font-bold text-accent">{benchmarks?.aggregate_rmse}%</span>
            </div>
            <div className="border-l border-white/10 pl-4">
              <span className="text-muted text-[0.5556rem] block">BENCHMARK SERIES</span>
              <span className="text-lg font-bold text-fg">{benchmarks?.total_benchmark_series} Datasets</span>
            </div>
          </div>
        </div>

        {/* Validation Data Points Comparison Table */}
        <div className="mt-4 pt-4 border-t border-white/10 overflow-x-auto">
          <h4 className="text-xs font-mono font-bold text-soft mb-2 uppercase">Published vs. Predicted Retention Matrix</h4>
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-muted border-b border-white/10/60">
                <th className="pb-2">Food / Nutrient</th>
                <th className="pb-2">Storage Temp</th>
                <th className="pb-2">Sol Horizon</th>
                <th className="pb-2 text-right">Published value</th>
                <th className="pb-2 text-right">Arrhenius Prediction</th>
                <th className="pb-2 text-right">Residual</th>
                <th className="pb-2 text-right">R² (n/a)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {benchmarks?.series.map((s, idx) => (
                <React.Fragment key={idx}>
                  {s.datapoints.slice(1, 4).map((dp, dpIdx) => (
                    <tr key={dpIdx} className="hover:bg-white/[0.06]">
                      {dpIdx === 0 ? (
                        <td className="py-2 text-fg font-medium" rowSpan={3}>
                          {s.food_name} <br />
                          <span className="text-[0.5556rem] text-accent uppercase">({s.nutrient})</span>
                        </td>
                      ) : null}
                      {dpIdx === 0 ? (
                        <td className="py-2 text-fg" rowSpan={3}>
                          {s.temperature_c}°C
                        </td>
                      ) : null}
                      <td className="py-2 text-soft">Sol {dp.sol}</td>
                      <td className="py-2 text-right font-bold text-fg">{dp.measured_retention}%</td>
                      <td className="py-2 text-right text-nominal">{dp.predicted_retention}%</td>
                      <td className="py-2 text-right text-muted">{dp.residual > 0 ? `+${dp.residual}` : dp.residual}%</td>
                      {dpIdx === 0 ? (
                        <td className="py-2 text-right text-nominal font-bold" rowSpan={3}>
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
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-accent text-fg font-bold'
                  : 'bg-white/[0.04] text-soft hover:bg-white/[0.06] border border-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search rations (e.g. Salmon)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-fg placeholder-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Space Food Inventory Table */}
      <div className="card rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-black/30 text-muted border-b border-white/10 uppercase text-[0.6111rem]">
              <tr>
                <th className="p-3.5">ID / Name</th>
                <th className="p-3.5">Category & Preservation</th>
                <th className="p-3.5 text-right">Serving</th>
                <th className="p-3.5 text-right">Calories</th>
                <th className="p-3.5 text-right">Protein</th>
                <th className="p-3.5 text-right">Thiamine (B1)</th>
                <th className="p-3.5 text-right">Vit-C</th>
                <th className="p-3.5 text-right">Ea (kJ/mol)</th>
                <th className="p-3.5 text-right">Shelf Life (4°C)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.06] transition">
                  <td className="p-3.5">
                    <span className="font-bold text-fg block">{item.name}</span>
                    <span className="text-[0.5556rem] text-accent font-mono">{item.id}</span>
                  </td>
                  <td className="p-3.5">
                    <span className="inline-block px-2 py-0.5 rounded text-[0.5556rem] font-semibold bg-white/[0.06] border border-white/10 text-soft">
                      {item.category}
                    </span>
                    <span className="block text-[0.5556rem] text-muted mt-0.5">{item.preservation_method}</span>
                  </td>
                  <td className="p-3.5 text-right text-soft">{item.serving_size_g} g</td>
                  <td className="p-3.5 text-right font-bold text-fg">{item.calories_kcal} kcal</td>
                  <td className="p-3.5 text-right text-soft">{item.protein_g} g</td>
                  <td className="p-3.5 text-right text-watch font-medium">{item.thiamine_b1_mg} mg</td>
                  <td className="p-3.5 text-right text-nominal font-medium">{item.vitamin_c_mg} mg</td>
                  <td className="p-3.5 text-right text-fg">{item.activation_energy_Ea_kJ_mol}</td>
                  <td className="p-3.5 text-right font-bold text-accent">
                    {item.shelf_life_chilled_sols_at_4C} Sols
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
