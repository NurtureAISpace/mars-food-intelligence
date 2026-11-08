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
  const chartHeight = 260;
  const padding = 45;

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
          <h2 className="text-xl font-bold font-mono text-white">PREDICTION & ARRHENIUS DEGRADATION ENGINE</h2>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-1">
          First-principles thermodynamic degradation forecasting using chemical kinetic constants and activation energy ($E_a$).
        </p>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Sliders & Parameters */}
        <div className="glass-panel rounded-xl p-5 border border-mars-border space-y-5">
          <h3 className="font-mono font-bold text-white text-sm border-b border-mars-border pb-3 uppercase">
            Simulation Parameters
          </h3>

          {/* Food Selection */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5">Select Space Ration Item:</label>
            <select
              value={selectedFoodId}
              onChange={(e) => setSelectedFoodId(e.target.value)}
              className="w-full bg-mars-dark border border-mars-border rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
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
              <span className="text-slate-300">Storage Temperature:</span>
              <span className={`font-bold ${storageTemp <= 4 ? 'text-cyan-400' : storageTemp <= 21 ? 'text-amber-400' : 'text-red-400'}`}>
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
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>-20°C (Deep Freeze)</span>
              <span className="text-cyan-400 font-bold">4°C (Chilled)</span>
              <span>21°C (Ambient)</span>
              <span className="text-red-400">35°C (Overheat)</span>
            </div>
          </div>

          {/* Degradation Threshold Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5 font-mono text-xs">
              <span className="text-slate-300">Viability Cutoff Threshold:</span>
              <span className="text-orange-400 font-bold">{thresholdPct}% Retention</span>
            </div>
            <input
              type="range"
              min="20"
              max="80"
              step="5"
              value={thresholdPct}
              onChange={(e) => setThresholdPct(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 font-mono mt-1">
              NASA standard minimum required nutritional efficacy limit.
            </p>
          </div>

          {/* Item Kinetics Summary Box */}
          {selectedItem && (
            <div className="p-3.5 rounded-lg bg-mars-dark border border-mars-border space-y-2 text-xs font-mono">
              <span className="text-orange-400 font-bold uppercase text-[11px] block">Item Arrhenius Constants</span>
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
        <div className="glass-panel rounded-xl p-5 border border-mars-border lg:col-span-2 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-mars-border pb-3 gap-2">
            <div>
              <h3 className="font-mono font-bold text-white text-sm">
                DYNAMIC NUTRIENT RETENTION CURVE: {selectedItem?.name}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Storage: <strong className="text-cyan-400">{storageTemp}°C</strong> • Rate constant $k$: <strong className="text-orange-400">{prediction?.rate_constant_k_per_day} day⁻¹</strong>
              </p>
            </div>

            <div className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold ${
              prediction?.status === 'STABLE'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {prediction?.status === 'STABLE' ? 'STABLE PAST SOL-450' : 'CRITICAL DEGRADATION'}
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="relative bg-mars-dark/90 rounded-lg p-3 border border-mars-border overflow-hidden">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
              {/* Grid Lines */}
              {[0, 25, 50, 75, 100].map((val) => {
                const y = chartHeight - padding - (val / 100.0) * (chartHeight - padding * 2);
                return (
                  <g key={val}>
                    <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#1f2e4d" strokeDasharray="3 3" />
                    <text x={padding - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
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
                    <line x1={x} y1={padding} x2={x} y2={chartHeight - padding} stroke="#1f2e4d" strokeDasharray="3 3" />
                    <text x={x} y={chartHeight - padding + 16} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">
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
                    <text x={x450} y={padding - 6} textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="bold" fontFamily="monospace">
                      TARGET: SOL 450
                    </text>
                  </g>
                );
              })()}

              {/* Critical Cutoff Horizontal Line */}
              <line
                x1={padding}
                y1={thresholdY}
                x2={chartWidth - padding}
                y2={thresholdY}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />
              <text x={chartWidth - padding} y={thresholdY - 6} textAnchor="end" fill="#ef4444" fontSize="10" fontFamily="monospace">
                Cutoff ({thresholdPct}%)
              </text>

              {/* Retention Curve Path */}
              <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" />

              {/* Drop-Dead Point Marker */}
              {prediction?.drop_dead_sol && prediction.drop_dead_sol <= maxSol && (
                (() => {
                  const coords = getCoordinates(prediction.drop_dead_sol, thresholdPct);
                  return (
                    <g>
                      <circle cx={coords.x} cy={coords.y} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                      <text x={coords.x + 10} y={coords.y - 10} fill="#fca5a5" fontSize="11" fontWeight="bold" fontFamily="monospace">
                        Drop-Dead: Sol {prediction.drop_dead_sol}
                      </text>
                    </g>
                  );
                })()
              )}
            </svg>
          </div>

          {/* Metric Callouts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-mars-dark border border-mars-border">
              <span className="text-slate-400 block text-[11px]">CALCULATED HALF-LIFE (t½)</span>
              <span className="text-lg font-bold text-white mt-0.5 block">
                {prediction?.half_life_sols} <span className="text-xs font-normal text-slate-400">Sols</span>
              </span>
              <span className="text-[10px] text-cyan-400">50% nutrient loss point</span>
            </div>

            <div className="p-3.5 rounded-lg bg-mars-dark border border-mars-border">
              <span className="text-slate-400 block text-[11px]">DROP-DEAD SOL</span>
              <span className={`text-lg font-bold mt-0.5 block ${
                (prediction?.drop_dead_sol ?? 0) <= 450 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                Sol {prediction?.drop_dead_sol}
              </span>
              <span className="text-[10px] text-slate-400">Falls below {thresholdPct}% threshold</span>
            </div>

            <div className="p-3.5 rounded-lg bg-mars-dark border border-mars-border">
              <span className="text-slate-400 block text-[11px]">SOL-450 STATUS</span>
              <span className={`text-lg font-bold mt-0.5 block ${
                (prediction?.drop_dead_sol ?? 0) >= 450 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {(prediction?.drop_dead_sol ?? 0) >= 450 ? 'SURVIVES SOL-450' : 'EXPIRES EARLY'}
              </span>
              <span className="text-[10px] text-slate-400">Baseline mission gate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
