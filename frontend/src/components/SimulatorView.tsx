import React, { useState } from 'react';
import { runMissionSimulation } from '../api';
import { SimulationResult } from '../types';
import { Compass, AlertTriangle, CheckCircle2, Flame, ShieldAlert, Play, RotateCcw } from 'lucide-react';

export const SimulatorView: React.FC = () => {
  const [duration, setDuration] = useState<number>(600);
  const [crewSize, setCrewSize] = useState<number>(4);
  const [storageRegime, setStorageRegime] = useState<string>('CHILLED');
  const [enableCoolingFailure, setEnableCoolingFailure] = useState<boolean>(true);
  const [coolingFailureSol, setCoolingFailureSol] = useState<number>(150);
  const [failureDuration, setFailureDuration] = useState<number>(45);
  const [peakTemp, setPeakTemp] = useState<number>(31.5);
  const [enableCropFailure, setEnableCropFailure] = useState<boolean>(false);
  const [cropFailureSol, setCropFailureSol] = useState<number>(250);
  const [rationStrategy, setRationStrategy] = useState<string>('NOMINAL_FULL');

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSimulate = () => {
    setLoading(true);
    runMissionSimulation({
      mission_duration_sols: duration,
      crew_size: crewSize,
      storage_regime: storageRegime,
      cooling_failure_sol: enableCoolingFailure ? coolingFailureSol : null,
      failure_duration_sols: failureDuration,
      failure_peak_temp_c: peakTemp,
      crop_failure_sol: enableCropFailure ? cropFailureSol : null,
      crop_area_m2: 18.0,
      ration_strategy: rationStrategy,
    })
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  // Run on mount once
  React.useEffect(() => {
    handleSimulate();
  }, []);

  // SVG Chart Dimensions
  const chartWidth = 720;
  const chartHeight = 280;
  const padding = 45;

  const timeline = result?.telemetry_timeline || [];

  const getCoordinates = (sol: number, securityIndex: number) => {
    const x = padding + (sol / duration) * (chartWidth - padding * 2);
    const y = chartHeight - padding - (securityIndex / 100.0) * (chartHeight - padding * 2);
    return { x, y };
  };

  const securityPath = timeline.reduce((acc, pt, idx) => {
    const { x, y } = getCoordinates(pt.sol, pt.food_security_index);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const thiaminePath = timeline.reduce((acc, pt, idx) => {
    const { x, y } = getCoordinates(pt.sol, pt.thiamine_retention_pct);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <Compass className="w-5 h-5 text-accent" />
          <h2 className="display text-3xl text-fg sm:text-4xl">MARS HABITAT MISSION SIMULATOR</h2>
        </div>
        <p className="text-xs text-muted font-mono mt-1">
          Sol-by-Sol dynamic stress testing: model refrigeration breakdowns, greenhouse blight, and multi-year food security survival.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="card rounded-xl p-5 border border-white/10 space-y-5">
          <h3 className="font-mono font-bold text-fg text-sm border-b border-white/10 pb-3 uppercase">
            Scenario & Failure Injections
          </h3>

          {/* Mission Duration */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-soft">Mission Duration:</span>
              <span className="text-accent font-bold">{duration} Sols</span>
            </div>
            <input
              type="range"
              min="300"
              max="900"
              step="50"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted mt-1">
              <span>Sol 300</span>
              <span className="text-accent font-bold">Sol 450 (Target)</span>
              <span>Sol 600</span>
              <span>Sol 900</span>
            </div>
          </div>

          {/* Baseline Storage Regime */}
          <div>
            <label className="block text-xs font-mono text-soft mb-1.5">Baseline Storage Regime:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStorageRegime('CHILLED')}
                className={`py-2 rounded-lg text-xs font-mono border transition ${
                  storageRegime === 'CHILLED'
                    ? 'bg-series-1/20 border-series-1 text-fg font-bold'
                    : 'bg-black/30 border-white/10 text-muted'
                }`}
              >
                Chilled (4.0°C)
              </button>
              <button
                onClick={() => setStorageRegime('AMBIENT')}
                className={`py-2 rounded-lg text-xs font-mono border transition ${
                  storageRegime === 'AMBIENT'
                    ? 'bg-watch/20 border-watch text-watch font-bold'
                    : 'bg-black/30 border-white/10 text-muted'
                }`}
              >
                Ambient (21.0°C)
              </button>
            </div>
          </div>

          {/* Cooling Loop Malfunction Injection */}
          <div className="p-3.5 rounded-lg bg-black/30 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-mono text-act font-bold">
                <Flame className="w-4 h-4" />
                <span>Cooling System Failure</span>
              </div>
              <input
                type="checkbox"
                checked={enableCoolingFailure}
                onChange={(e) => setEnableCoolingFailure(e.target.checked)}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>

            {enableCoolingFailure && (
              <div className="space-y-3 pt-2 text-xs font-mono">
                <div>
                  <div className="flex justify-between text-soft mb-1">
                    <span>Failure Trigger:</span>
                    <span className="text-act font-bold">Sol {coolingFailureSol}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max={duration - 100}
                    step="25"
                    value={coolingFailureSol}
                    onChange={(e) => setCoolingFailureSol(Number(e.target.value))}
                    className="w-full accent-act cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-soft mb-1">
                    <span>Excursion Duration:</span>
                    <span className="text-accent font-bold">{failureDuration} Sols</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="120"
                    step="5"
                    value={failureDuration}
                    onChange={(e) => setFailureDuration(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-soft mb-1">
                    <span>Peak Overheat Temp:</span>
                    <span className="text-act font-bold">+{peakTemp}°C</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="38"
                    step="0.5"
                    value={peakTemp}
                    onChange={(e) => setPeakTemp(Number(e.target.value))}
                    className="w-full accent-act cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Ration Strategy */}
          <div>
            <label className="block text-xs font-mono text-soft mb-1.5">Rationing Strategy:</label>
            <select
              value={rationStrategy}
              onChange={(e) => setRationStrategy(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-xs font-mono text-fg focus:outline-none focus:border-accent"
            >
              <option value="NOMINAL_FULL">Nominal Full Rations (2800 kcal/crew)</option>
              <option value="CONSERVATION_15_PCT">Conservation Mode (-15% Burn Rate)</option>
              <option value="SURVIVAL">Survival Emergency (-30% Burn Rate)</option>
            </select>
          </div>

          {/* Run Button */}
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-fg font-mono text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-accent/25"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{loading ? 'Simulating Orbit & Degradation...' : 'Execute Mission Simulation'}</span>
          </button>
        </div>

        {/* Right 2 Columns: Dynamic Trajectories & Telemetry Log */}
        <div className="card rounded-xl p-5 border border-white/10 lg:col-span-2 space-y-6">
          {/* Mission Survival Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                {result?.summary_metrics.mission_survived ? (
                  <CheckCircle2 className="w-5 h-5 text-nominal" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-act" />
                )}
                <h3 className="font-mono font-bold text-fg text-base">
                  {result?.summary_metrics.mission_survived
                    ? 'MISSION VIABLE: SOL-450 THRESHOLD ACHIEVED'
                    : `CRITICAL DEFICIT AT SOL ${result?.summary_metrics.first_critical_sol}`}
                </h3>
              </div>
              <p className="text-xs font-mono text-muted mt-0.5">
                Minimum Food Security Index: <strong className="text-accent">{result?.summary_metrics.minimum_food_security_index}%</strong> • Biomass Harvested: <strong className="text-nominal">{result?.summary_metrics.total_biomass_harvested_kg} kg</strong>
              </p>
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-0.5 bg-accent inline-block"></span>
                <span className="text-soft">Food Security Index</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-0.5 bg-series-1 inline-block"></span>
                <span className="text-soft">Thiamine Retention</span>
              </div>
            </div>
          </div>

          {/* SVG Multi-Curve Simulation Plot */}
          <div className="relative bg-black/30 rounded-lg p-3 border border-white/10 overflow-hidden">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
              {/* Horizontal Grid */}
              {[0, 25, 50, 75, 100].map((val) => {
                const y = chartHeight - padding - (val / 100.0) * (chartHeight - padding * 2);
                return (
                  <g key={val}>
                    <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
                    <text x={padding - 8} y={y + 4} textAnchor="end" fill="#A1A1AA" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                      {val}%
                    </text>
                  </g>
                );
              })}

              {/* Vertical Sols Grid */}
              {[0, 150, 300, 450, 600].map((s) => {
                if (s > duration) return null;
                const x = padding + (s / duration) * (chartWidth - padding * 2);
                return (
                  <g key={s}>
                    <line x1={x} y1={padding} x2={x} y2={chartHeight - padding} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
                    <text x={x} y={chartHeight - padding + 16} textAnchor="middle" fill="#A1A1AA" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                      Sol {s}
                    </text>
                  </g>
                );
              })}

              {/* Sol 450 Target Milestone Highlight */}
              {duration >= 450 && (() => {
                const x450 = padding + (450 / duration) * (chartWidth - padding * 2);
                return (
                  <g>
                    <line x1={x450} y1={padding} x2={x450} y2={chartHeight - padding} stroke="#FF6B2C" strokeWidth="2" strokeDasharray="4 4" />
                    <text x={x450} y={padding - 6} textAnchor="middle" fill="#FF6B2C" fontSize="10" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">
                      SOL-450 GOAL
                    </text>
                  </g>
                );
              })()}

              {/* Failure Duration Shading Area */}
              {enableCoolingFailure && (() => {
                const startX = padding + (coolingFailureSol / duration) * (chartWidth - padding * 2);
                const endX = padding + (Math.min(duration, coolingFailureSol + failureDuration) / duration) * (chartWidth - padding * 2);
                return (
                  <g>
                    <rect
                      x={startX}
                      y={padding}
                      width={Math.max(2, endX - startX)}
                      height={chartHeight - padding * 2}
                      fill="#F43F5E"
                      fillOpacity="0.12"
                    />
                    <text x={startX + 4} y={padding + 16} fill="#F43F5E" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                      FAILURE EXCURSION (+{peakTemp}°C)
                    </text>
                  </g>
                );
              })()}

              {/* Thiamine Path */}
              <path d={thiaminePath} fill="none" stroke="#199EB8" strokeWidth="2.5" />

              {/* Food Security Path */}
              <path d={securityPath} fill="none" stroke="#FF6B2C" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          {/* Critical Advisories Log */}
          <div>
            <h4 className="text-xs font-mono font-bold text-soft mb-2 uppercase flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-accent" />
              <span>Simulated Event & Hazard Log ({result?.critical_advisories.length} Events)</span>
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {result?.critical_advisories.map((adv, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-black/30 border border-white/10 text-soft flex items-center justify-between"
                >
                  <span className={adv.includes('CRITICAL') || adv.includes('WARNING') ? 'text-watch font-bold' : 'text-soft'}>
                    {adv}
                  </span>
                  <span className="text-[10px] text-muted uppercase">LOG ENTRY</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
