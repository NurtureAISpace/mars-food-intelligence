import React, { useState, useEffect } from 'react';
import {
  Activity,
  Droplets,
  Wind,
  Zap,
  Gauge,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Cpu,
  Layers,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import {
  fetchLifeSupportTelemetry,
  fetchRegolithSensors,
  runLifeSupportSimulation
} from '../api';
import {
  LifeSupportTelemetryData,
  RegolithSensorNodeData,
  LifeSupportSimulationResult
} from '../types';

export const LifeSupportView: React.FC = () => {
  const [telemetry, setTelemetry] = useState<LifeSupportTelemetryData | null>(null);
  const [sensors, setSensors] = useState<RegolithSensorNodeData[]>([]);
  const [simulation, setSimulation] = useState<LifeSupportSimulationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive controls
  const [missionSol, setMissionSol] = useState<number>(450);
  const [crewSize, setCrewSize] = useState<number>(4);
  const [dustStormActive, setDustStormActive] = useState<boolean>(false);
  const [o2LeakActive, setO2LeakActive] = useState<boolean>(false);
  const [closedLoopEnabled, setClosedLoopEnabled] = useState<boolean>(true);

  // Load live snapshot telemetry
  const loadTelemetry = async () => {
    try {
      setLoading(true);
      const data = await fetchLifeSupportTelemetry({
        sol: missionSol,
        crew_size: crewSize,
        dust_storm_active: dustStormActive,
        o2_leak_active: o2LeakActive,
      });
      setTelemetry(data);
      setSensors(data.regolith_moisture_sensors);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load life support telemetry');
    } finally {
      setLoading(false);
    }
  };

  // Run dynamic simulation
  const handleRunSimulation = async () => {
    try {
      setSimLoading(true);
      const simData = await runLifeSupportSimulation({
        mission_duration_sols: 450,
        crew_size: crewSize,
        dust_storm_sol: dustStormActive ? 180 : null,
        dust_storm_duration: 60,
        o2_leak_sol: o2LeakActive ? 280 : null,
        o2_leak_duration: 30,
        greenhouse_area_m2: 24.0,
        enable_closed_loop: closedLoopEnabled,
      });
      setSimulation(simData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Simulation run failed');
    } finally {
      setSimLoading(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
  }, [missionSol, crewSize, dustStormActive, o2LeakActive]);

  useEffect(() => {
    handleRunSimulation();
  }, [closedLoopEnabled]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-series-1/[0.08] via-white/[0.03] to-nominal/[0.06] border border-series-1/30 p-6 md:p-8 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-series-1/10 border border-series-1/30 text-fg text-xs font-mono font-medium">
              <Cpu className="w-3.5 h-3.5" />
              <span>Computer Engineering & Life Support Simulation Architecture</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-fg tracking-tight font-mono">
              ECLSS & Smart Regolith Hydro-Management
            </h1>
            <p className="text-sm text-soft max-w-2xl">
              Closed-loop Environmental Control and Life Support System (ECLSS) with automated Sabatier water recovery,
              electrolytic OGS, and IoT capacitive regolith soil moisture micro-irrigation controller.
            </p>
            <div className="pt-1 flex items-center space-x-2 text-xs font-mono text-fg/80">
              <span>Author: Faruk Karimli (Computer Engineering & Life Support Simulation)</span>
              <span>•</span>
              <span className="text-nominal font-semibold">Synthetic scenario</span>
            </div>
          </div>

          {/* Quick Status Pill */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3">
            <div className="px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full animate-pulse ${
                telemetry?.overall_eclss_status === 'CRITICAL' ? 'bg-act' :
                telemetry?.overall_eclss_status === 'WARNING' ? 'bg-watch' : 'bg-nominal'
              }`} />
              <div>
                <span className="text-[11px] font-mono text-muted uppercase tracking-wider block">ECLSS System State</span>
                <span className="text-sm font-bold font-mono text-fg">
                  {telemetry?.overall_eclss_status || 'INITIALIZING'}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 flex items-center space-x-3">
              <Droplets className="w-5 h-5 text-fg" />
              <div>
                <span className="text-[11px] font-mono text-muted uppercase tracking-wider block">Water Loop Closure</span>
                <span className="text-sm font-bold font-mono text-fg">
                  {telemetry?.reserves.water_loop_closure_pct ?? 96.8}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contingency Stress-Testing Controls */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <Sliders className="w-5 h-5 text-accent" />
            <h2 className="text-sm font-mono font-bold text-fg uppercase tracking-wider">
              Contingency & Life-Support Stress Controls (Faruk Karimli Engine)
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunSimulation}
              disabled={simLoading}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-series-1 hover:bg-series-1 text-fg text-xs font-mono font-medium transition-all shadow-md shadow-series-1/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${simLoading ? 'animate-spin' : ''}`} />
              <span>Re-Simulate Mission Sol-450</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {/* Mission Sol Selector */}
          <div className="bg-white/[0.06] p-3.5 rounded-lg border border-white/10">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-mono text-muted">Mission Sol</span>
              <span className="text-xs font-mono font-bold text-accent">Sol {missionSol}</span>
            </div>
            <input
              type="range"
              min={1}
              max={600}
              step={10}
              value={missionSol}
              onChange={(e) => setMissionSol(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer h-1.5 bg-white/[0.12] rounded-lg"
            />
          </div>

          {/* Dust Storm Toggle */}
          <button
            onClick={() => setDustStormActive(!dustStormActive)}
            className={`p-3.5 rounded-lg border flex flex-col justify-between text-left transition-all ${
              dustStormActive
                ? 'bg-watch/10 border-watch text-watch'
                : 'bg-white/[0.06] border-white/10 text-soft hover:border-white/25'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-mono font-semibold">Global Dust Storm</span>
              <AlertTriangle className={`w-4 h-4 ${dustStormActive ? 'text-watch' : 'text-muted'}`} />
            </div>
            <span className="text-[11px] text-muted mt-1 font-mono">
              {dustStormActive ? 'Solar -72% (Aux Batt On)' : 'Clear Martian Sky'}
            </span>
          </button>

          {/* O2 Leak Toggle */}
          <button
            onClick={() => setO2LeakActive(!o2LeakActive)}
            className={`p-3.5 rounded-lg border flex flex-col justify-between text-left transition-all ${
              o2LeakActive
                ? 'bg-act/10 border-act text-act'
                : 'bg-white/[0.06] border-white/10 text-soft hover:border-white/25'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-mono font-semibold">Cabin O2 Micro-Leak</span>
              <Wind className={`w-4 h-4 ${o2LeakActive ? 'text-act' : 'text-muted'}`} />
            </div>
            <span className="text-[11px] text-muted mt-1 font-mono">
              {o2LeakActive ? 'Depressurization Active' : 'Hull Integrity 100%'}
            </span>
          </button>

          {/* Closed Loop Water Toggle */}
          <button
            onClick={() => setClosedLoopEnabled(!closedLoopEnabled)}
            className={`p-3.5 rounded-lg border flex flex-col justify-between text-left transition-all ${
              closedLoopEnabled
                ? 'bg-series-1/10 border-series-1 text-fg'
                : 'bg-white/[0.06] border-white/10 text-soft hover:border-white/25'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-mono font-semibold">Sabatier + WRS Loop</span>
              <Droplets className={`w-4 h-4 ${closedLoopEnabled ? 'text-fg' : 'text-muted'}`} />
            </div>
            <span className="text-[11px] text-muted mt-1 font-mono">
              {closedLoopEnabled ? 'Closed Loop Active (assumed recovery)' : 'Open Loop (Resupply Dependent)'}
            </span>
          </button>
        </div>
      </div>

      {/* Real-Time Telemetry Gauges (4 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Atmosphere HUD */}
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-mono font-semibold uppercase">Cabin Atmosphere</span>
            <Gauge className="w-4 h-4 text-fg" />
          </div>
          <div className="my-3 space-y-1">
            <div className="flex items-baseline space-x-2">
              <span className="display text-3xl text-fg sm:text-4xl">
                {telemetry?.atmosphere.total_pressure_kpa ?? 101.3}
              </span>
              <span className="text-xs font-mono text-muted">kPa Total</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono text-muted pt-1 border-t border-white/10">
              <span>pO2: <strong className="text-nominal">{telemetry?.atmosphere.partial_pressure_o2_kpa ?? 21.3} kPa</strong></span>
              <span>pCO2: <strong className="text-watch">{telemetry?.atmosphere.partial_pressure_co2_kpa ?? 0.38} kPa</strong></span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-nominal flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Normobaric (101.3 kPa)</span>
          </div>
        </div>

        {/* Oxygen Generation (OGS) */}
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-mono font-semibold uppercase">Oxygen Balance</span>
            <Wind className="w-4 h-4 text-nominal" />
          </div>
          <div className="my-3 space-y-1">
            <div className="flex items-baseline space-x-2">
              <span className="display text-3xl text-fg sm:text-4xl">
                {telemetry?.reserves.o2_reserve_kg ?? 350.0}
              </span>
              <span className="text-xs font-mono text-muted">kg O2 Reserve</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono text-muted pt-1 border-t border-white/10">
              <span>Crew Demand: <strong className="text-accent">{telemetry?.daily_rates.crew_o2_consumption_kg ?? 3.36} kg/d</strong></span>
              <span>Crop O2: <strong className="text-nominal">{telemetry?.daily_rates.plant_o2_generation_kg ?? 1.85} kg/d</strong></span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-muted">
            OGS Electrolysis: <strong className="text-fg">{telemetry?.daily_rates.ogs_electrolysis_o2_kg ?? 1.51} kg/d</strong>
          </div>
        </div>

        {/* Potable Water & Sabatier Recovery */}
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-mono font-semibold uppercase">Potable Water & WRS</span>
            <Droplets className="w-4 h-4 text-fg" />
          </div>
          <div className="my-3 space-y-1">
            <div className="flex items-baseline space-x-2">
              <span className="display text-3xl text-fg sm:text-4xl">
                {telemetry?.reserves.potable_water_l ?? 2400.0}
              </span>
              <span className="text-xs font-mono text-muted">Liters Potable</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono text-muted pt-1 border-t border-white/10">
              <span>Sabatier Regen: <strong className="text-fg">+{telemetry?.daily_rates.sabatier_water_recovered_l ?? 3.27} L/d</strong></span>
              <span>Transpiration: <strong className="text-nominal">+{telemetry?.daily_rates.water_transpired_crops_l ?? 4.1} L/d</strong></span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-fg">
            Net Sol Drift: <strong>{telemetry?.daily_rates.net_water_daily_delta_l ?? -0.8} L/d</strong>
          </div>
        </div>

        {/* Power & Solar Insolation */}
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-mono font-semibold uppercase">Solar & Battery Grid</span>
            <Zap className="w-4 h-4 text-watch" />
          </div>
          <div className="my-3 space-y-1">
            <div className="flex items-baseline space-x-2">
              <span className="display text-3xl text-fg sm:text-4xl">
                {telemetry?.power.battery_state_of_charge_pct ?? 96.5}%
              </span>
              <span className="text-xs font-mono text-muted">Battery SOC</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono text-muted pt-1 border-t border-white/10">
              <span>Solar Gen: <strong className="text-watch">{telemetry?.power.solar_power_generated_kwh ?? 180.0} kWh</strong></span>
              <span>Demand: <strong className="text-soft">{telemetry?.power.power_consumed_kwh ?? 115.0} kWh</strong></span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-muted">
            Grid Balance: <strong className={dustStormActive ? 'text-watch' : 'text-nominal'}>
              {dustStormActive ? 'DEFICIT (Batt Discharging)' : 'SURPLUS (+65.0 kWh)'}
            </strong>
          </div>
        </div>
      </div>

      {/* Regolith Soil Moisture Platform (Faruk Karimli's Hardware & IoT Innovation) */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Droplets className="w-5 h-5 text-fg" />
              <h2 className="text-lg font-mono font-bold text-fg tracking-tight">
                Smart Soil & Regolith Moisture Platform
              </h2>
            </div>
            <p className="text-xs text-muted mt-1">
              Capacitive Volumetric Water Content (VWC %) telemetry & closed-loop micro-controller irrigation valves
              — illustrative values, not calibrated.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded bg-white/[0.06] border border-white/10 text-[11px] font-mono text-soft">
              Automated PID Pulse Irrigation: <strong className="text-nominal">ONLINE</strong>
            </span>
          </div>
        </div>

        {/* 4 Sensor Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {sensors.map((node) => {
            const isDry = node.status === 'DRY_WARNING';
            const isSaline = node.status === 'SALINE_STRESS';
            return (
              <div
                key={node.node_id}
                className={`p-4 rounded-xl border transition-all ${
                  node.irrigation_valve_open
                    ? 'bg-series-1/10 border-series-1 shadow-md shadow-series-1/10'
                    : isDry
                    ? 'bg-watch/10 border-watch/60'
                    : 'bg-white/[0.06] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/[0.06] text-soft">
                    {node.node_id}
                  </span>
                  <div className={`flex items-center space-x-1.5 text-[11px] font-mono font-medium ${
                    node.irrigation_valve_open ? 'text-fg animate-pulse' : 'text-muted'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${node.irrigation_valve_open ? 'bg-series-1' : 'bg-white/[0.12]'}`} />
                    <span>{node.irrigation_valve_open ? 'VALVE OPEN' : 'VALVE CLOSED'}</span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-fg font-mono truncate" title={node.zone_name}>
                  {node.zone_name}
                </h3>
                <p className="text-[11px] text-muted font-mono mt-0.5 truncate">
                  Crop: <strong className="text-soft">{node.target_crop}</strong>
                </p>

                {/* VWC Gauge Bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Regolith Moisture (VWC)</span>
                    <span className="font-bold text-fg">{node.volumetric_water_content_pct}%</span>
                  </div>
                  <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        node.volumetric_water_content_pct < 30 ? 'bg-watch' :
                        node.volumetric_water_content_pct > 50 ? 'bg-series-2' : 'bg-series-1'
                      }`}
                      style={{ width: `${Math.min(100, (node.volumetric_water_content_pct / 60) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-muted">
                    <span>Dry (&lt;35%)</span>
                    <span>Nominal (40-50%)</span>
                    <span>Sat (&gt;55%)</span>
                  </div>
                </div>

                {/* Telemetry Row */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/10 text-[11px] font-mono">
                  <div>
                    <span className="text-muted block">Salinity (EC)</span>
                    <span className={`font-bold ${isSaline ? 'text-act' : 'text-soft'}`}>
                      {node.electrical_conductivity_ds_m} dS/m
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block">Regolith pH</span>
                    <span className="font-bold text-soft">{node.regolith_ph}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Root Temp</span>
                    <span className="font-bold text-soft">{node.soil_temperature_c} °C</span>
                  </div>
                  <div>
                    <span className="text-muted block">Probe Depth</span>
                    <span className="font-bold text-soft">{node.depth_cm} cm</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic 450-Sol Mission Life Support Simulation Graph */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-mono font-bold text-fg tracking-tight">
                450-Sol Life Support Mass-Balance Trajectory
              </h2>
            </div>
            <p className="text-xs text-muted mt-1">
              Dynamic tracking of Oxygen Reserves, Potable Water Reservoir, Battery State-of-Charge, and Regolith Moisture.
            </p>
          </div>
          {simulation && (
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-nominal/10 border border-nominal/30 text-nominal text-xs font-mono font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Verdict: {simulation.final_metrics.survival_verdict}</span>
            </div>
          )}
        </div>

        {/* SVG Vector Telemetry Graph */}
        <div className="mt-6">
          {simLoading ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-fg animate-spin" />
            </div>
          ) : simulation && simulation.timeline.length > 0 ? (
            <div className="relative">
              <svg viewBox="0 0 900 240" className="w-full h-64 overflow-visible">
                {/* Background Grid Lines */}
                <line x1="50" y1="20" x2="870" y2="20" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
                <line x1="50" y1="75" x2="870" y2="75" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
                <line x1="50" y1="130" x2="870" y2="130" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
                <line x1="50" y1="185" x2="870" y2="185" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
                <line x1="50" y1="210" x2="870" y2="210" stroke="rgba(255,255,255,0.14)" />

                {/* Y Axis Labels */}
                <text x="40" y="24" fill="#A1A1AA" fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono', monospace">100%</text>
                <text x="40" y="79" fill="#A1A1AA" fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono', monospace">75%</text>
                <text x="40" y="134" fill="#A1A1AA" fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono', monospace">50%</text>
                <text x="40" y="189" fill="#A1A1AA" fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono', monospace">25%</text>
                <text x="40" y="214" fill="#A1A1AA" fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono', monospace">0%</text>

                {/* Stress Event Shaded Bands */}
                {dustStormActive && (
                  <rect x="378" y="20" width="110" height="190" fill="#FBBF24" fillOpacity="0.12" rx="4" />
                )}
                {o2LeakActive && (
                  <rect x="560" y="20" width="55" height="190" fill="#F43F5E" fillOpacity="0.12" rx="4" />
                )}

                {/* Potable Water Reserve Line (Cyan) */}
                <path
                  d={simulation.timeline.map((pt, i) => {
                    const x = 50 + (pt.sol / 450) * 820;
                    const normalizedWater = (pt.potable_water_reserve_l / 3000.0) * 100.0;
                    const y = 210 - (normalizedWater / 100.0) * 190;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#199EB8"
                  strokeWidth="2.5"
                />

                {/* O2 Reserve Line (Emerald) */}
                <path
                  d={simulation.timeline.map((pt, i) => {
                    const x = 50 + (pt.sol / 450) * 820;
                    const normalizedO2 = (pt.o2_reserve_kg / 400.0) * 100.0;
                    const y = 210 - (normalizedO2 / 100.0) * 190;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#4ADE80"
                  strokeWidth="2.5"
                />

                {/* Battery SOC Line (Amber) */}
                <path
                  d={simulation.timeline.map((pt, i) => {
                    const x = 50 + (pt.sol / 450) * 820;
                    const y = 210 - (pt.battery_soc_pct / 100.0) * 190;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />

                {/* Current Sol Indicator Marker */}
                <line
                  x1={50 + (missionSol / 450) * 820}
                  y1="20"
                  x2={50 + (missionSol / 450) * 820}
                  y2="210"
                  stroke="#FF6B2C"
                  strokeWidth="2"
                />
                <circle
                  cx={50 + (missionSol / 450) * 820}
                  cy="20"
                  r="4"
                  fill="#FF6B2C"
                />
              </svg>

              {/* Sol X-Axis Labels */}
              <div className="flex justify-between pl-12 pr-4 text-[11px] font-mono text-muted mt-2">
                <span>Sol 0</span>
                <span>Sol 100</span>
                <span>Sol 200 {dustStormActive && <span className="text-watch font-bold">(Dust Storm)</span>}</span>
                <span>Sol 300 {o2LeakActive && <span className="text-act font-bold">(O2 Leak)</span>}</span>
                <span>Sol 400</span>
                <span>Sol 450</span>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10 text-xs font-mono">
                <div className="flex items-center space-x-2">
                  <div className="w-3.5 h-1 bg-series-1 rounded-full" />
                  <span className="text-soft">Potable Water Reservoir (L)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3.5 h-1 bg-nominal rounded-full" />
                  <span className="text-soft">O2 Atmosphere Tank (kg)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3.5 h-1 bg-watch rounded-full" />
                  <span className="text-soft">Battery Power SOC (%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                  <span className="text-accent">Current Mission Sol Marker</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted font-mono text-sm">
              Simulation data unavailable. Click 'Re-Simulate Mission Sol-450' to generate.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
