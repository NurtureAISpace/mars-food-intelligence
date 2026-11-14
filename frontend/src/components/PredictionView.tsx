import React, { useEffect, useState } from 'react';
import { fetchFoodCatalog, predictShelfLife } from '../api';
import { FoodItem, ShelfLifePrediction } from '../types';
import { TrendingUp, Thermometer, ShieldCheck, AlertCircle, Info, Sparkles } from 'lucide-react';

export const PredictionView: React.FC = () => {
  const [catalog, setCatalog] = useState<FoodItem[]>([]);
  const [selectedFoodId, setSelectedFoodId] = useState<string>('TH-001');
  const [storageTemp, setStorageTemp] = useState<number>(4.0);
  const [thresholdPct, setThresholdPct] = useState<number>(50.0);
  const [prediction, setPrediction] = useState<ShelfLifePrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchFoodCatalog()
      .then((data) => {
        setCatalog(data.items);
        if (data.items.length > 0) {
          setSelectedFoodId(data.items[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedFoodId) return;
    setLoading(true);
    predictShelfLife({
      food_id: selectedFoodId,
      storage_temperature_c: storageTemp,
      critical_nutrient: 'thiamine_b1',
      degradation_threshold_pct: thresholdPct,
      max_sols: 800,
    })
      .then((data) => {
        setPrediction(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedFoodId, storageTemp, thresholdPct]);

  const selectedItem = catalog.find((i) => i.id === selectedFoodId);

  // SVG Chart Dimensions
  const chartWidth = 700;
  const chartHeight = 270;
  const padding = 50;

  const points = prediction?.retention_curve || [];
  const maxSol = 800;

  const getCoordinates = (sol: number, retention: number) => {
    const x = padding + (sol / maxSol) * (chartWidth - padding * 2);
    const y = chartHeight - padding - (retention / 100.0) * (chartHeight - padding * 2);
    return { x, y };
  };

  const pathD = points.reduce((acc, pt, idx) => {
    const { x, y } = getCoordinates(pt.sol, pt.retention_pct);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const thresholdY = chartHeight - padding - (thresholdPct / 100.0) * (chartHeight - padding * 2);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div>
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-bold font-mono text-white">PREDICTION & ARRHENIUS DEGRADATION KINETICS</h2>
        </div>
        <p className="text-xs text-slate-300 font-mono mt-1">
          First-principles thermodynamic degradation forecasting using chemical kinetic constants and activation energy ($E_a$).
        </p>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Sliders & Parameters */}
        <div className="nova-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-5">
          <h3 className="font-mono font-bold text-white text-sm border-b border-white/10 pb-3 uppercase">
            Simulation Parameters
          </h3>

          {/* Food Selection */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">Select Space Ration Item:</label>
            <select
              value={selectedFoodId}
              onChange={(e) => setSelectedFoodId(e.target.value)}
              className="w-full bg-mars-void border border-white/15 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.id}] {item.name} ({item.category})
                </option>
              ))}
            </select>
          </div>

          {/* Temperature Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5 font-mono text-xs">
              <span className="text-slate-300 font-semibold">Storage Temperature:</span>
              <span className={`font-bold px-2 py-0.5 rounded ${storageTemp <= 4 ? 'bg-cyan-500/20 text-cyan-300' : storageTemp <= 21 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                {storageTemp}°C
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="40"
              step="1"
              value={storageTemp}
              onChange={(e) => setStorageTemp(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-2 bg-mars-void rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>-20°C (Freeze)</span>
              <span className="text-cyan-400 font-bold">4°C (Nominal)</span>
              <span>21°C (Ambient)</span>
              <span className="text-red-400 font-bold">35°C (Failure)</span>
            </div>
          </div>

          {/* Degradation Threshold Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5 font-mono text-xs">
              <span className="text-slate-300 font-semibold">Viability Cutoff Threshold:</span>
              <span className="text-orange-400 font-bold">{thresholdPct}% Retention</span>
            </div>
            <input
              type="range"
              min="20"
              max="80"
              step="5"
              value={thresholdPct}
              onChange={(e) => setThresholdPct(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-2 bg-mars-void rounded-lg"
            />
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Minimum nutritional efficacy limit for mission survival.
            </p>
          </div>

          {/* Item Kinetics Summary Box */}
          {selectedItem && (
            <div className="p-4 rounded-xl bg-mars-void/90 border border-white/10 space-y-2 text-xs font-mono">
              <span className="text-orange-400 font-bold uppercase text-[11px] block tracking-wider">Item Arrhenius Kinetics</span>
              <div className="flex justify-between text-slate-300">
                <span>Activation Energy (Ea):</span>
                <span className="text-white font-bold">{selectedItem.activation_energy_Ea_kJ_mol} kJ/mol</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Frequency Factor (A):</span>
                <span className="text-white font-bold">{selectedItem.arrhenius_A.toLocaleString()} day⁻¹</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Reaction Kinetic Order:</span>
                <span className="text-white font-bold">{selectedItem.kinetic_order}-Order Exponential</span>
              </div>
            </div>
          )}
        </div>

        {/* Right 2 Columns: Degradation Curve Visualization & Drop-Dead Milestone */}
        <div className="nova-panel-elevated rounded-2xl p-5 sm:p-6 border border-white/10 lg:col-span-2 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-3 gap-2">
            <div>
              <h3 className="font-mono font-bold text-white text-base">
                DYNAMIC NUTRIENT RETENTION CURVE: {selectedItem?.name}
              </h3>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                Storage: <strong className="text-cyan-400">{storageTemp}°C</strong> • Rate constant $k$: <strong className="text-orange-400">{prediction?.rate_constant_k_per_day} day⁻¹</strong>
              </p>
            </div>

            <div className={`px-3 py-1 rounded-full border font-mono text-xs font-bold ${
              prediction?.status === 'STABLE'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/20'
                : 'bg-red-500/20 border-red-500/50 text-red-300 shadow-sm shadow-red-500/30'
            }`}>
              {prediction?.status === 'STABLE' ? '● STABLE PAST SOL-450' : '⚠️ PRE-MATURE DEPLETION'}
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="relative bg-mars-void/90 rounded-xl p-3 border border-white/10 overflow-hidden shadow-inner">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
              {/* Grid Lines */}
              {[0, 25, 50, 75, 100].map((val) => {
                const y = chartHeight - padding - (val / 100.0) * (chartHeight - padding * 2);
                return (
                  <g key={val}>
                    <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#1e2d4a" strokeDasharray="3 3" />
                    <text x={padding - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace" fontWeight="600">
                      {val}%
                    </text>
                  </g>
                );
              })}

              {/* Sols Grid */}
              {[0, 200, 400, 600, 800].map((s) => {
                const x = padding + (s / maxSol) * (chartWidth - padding * 2);
                return (
                  <g key={s}>
                    <line x1={x} y1={padding} x2={x} y2={chartHeight - padding} stroke="#1e2d4a" strokeDasharray="3 3" />
                    <text x={x} y={chartHeight - padding + 18} textAnchor="middle" fill="#cbd5e1" fontSize="10" fontFamily="monospace" fontWeight="600">
                      Sol {s}
                    </text>
                  </g>
                );
              })}

              {/* Sol 450 Target Marker Line */}
              {(() => {
                const x450 = padding + (450 / maxSol) * (chartWidth - padding * 2);
                return (
                  <g>
                    <line x1={x450} y1={padding} x2={x450} y2={chartHeight - padding} stroke="#f97316" strokeWidth="2" strokeDasharray="4 4" />
                    <text x={x450} y={padding - 8} textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="bold" fontFamily="monospace">
                      TARGET: SOL 450
                    </text>
                  </g>
                );
              })()}

              {/* Threshold Line */}
              <line
                x1={padding}
                y1={thresholdY}
                x2={chartWidth - padding}
                y2={thresholdY}
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <text x={chartWidth - padding - 8} y={thresholdY - 6} textAnchor="end" fill="#fca5a5" fontSize="10" fontWeight="bold" fontFamily="monospace">
                CUTOFF THRESHOLD: {thresholdPct}%
              </text>

              {/* Curve Path */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>

          {/* Drop-Dead Sols & Metrics Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-mars-void border border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Drop-Dead Sol Horizon</span>
              <span className="text-xl font-bold text-orange-400 mt-1 block">
                {prediction?.drop_dead_sol ? `Sol ${prediction.drop_dead_sol}` : '> 800 Sols'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Threshold violation date</span>
            </div>

            <div className="p-3.5 rounded-xl bg-mars-void border border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nutrient Half-Life ($t_{1/2}$)</span>
              <span className="text-xl font-bold text-cyan-300 mt-1 block">
                {prediction?.half_life_sols} Sols
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">At current {storageTemp}°C regime</span>
            </div>

            <div className="p-3.5 rounded-xl bg-mars-void border border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target Sol-450 Retention</span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">
                {prediction?.retention_curve.find((pt) => pt.sol === 450)?.retention_pct ?? '—'}%
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Thiamine B1 remaining</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
