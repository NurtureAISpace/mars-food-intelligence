import React, { useEffect, useState } from 'react';
import { fetchFoodCatalog, predictShelfLife } from '../api';
import { FoodItem, ShelfLifePrediction } from '../types';
import { Hero } from '../ui/Hero';
import { Card, DataBadge, SectionHead, Stat, TonePill } from '../ui/primitives';
import { C } from '../ui/tokens';
import {
  ANNOT, AXIS_TITLE, ChartLegend, GlowFilter, HaloDot, SvgTooltip, TICK, nearest, useHoverX, useSvgId,
} from '../ui/chart';

const MAX_SOL = 800;
const TARGET_SOL = 450;

// Storage temperature band → text tone (warmer = faster vitamin loss)
const tempTone = (t: number) => (t <= 4 ? 'text-fg' : t <= 21 ? 'text-watch' : 'text-act');

const RetentionChart: React.FC<{ prediction: ShelfLifePrediction | null; thresholdPct: number; loading: boolean }> = ({
  prediction, thresholdPct, loading,
}) => {
  const W = 800, H = 300, L = 62, R = 20, T = 34, B = 50;
  const glowId = useSvgId('glow');
  const fadeId = useSvgId('fade');
  const sx = (sol: number) => L + (sol / MAX_SOL) * (W - L - R);
  const sy = (pct: number) => H - B - (pct / 100) * (H - T - B);
  const pts: Array<[number, number]> = (prediction?.retention_curve ?? []).map((p) => [p.sol, p.retention_pct]);
  const line = pts.map(([s, r], i) => `${i ? 'L' : 'M'} ${sx(s).toFixed(1)} ${sy(r).toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L ${sx(pts[pts.length - 1][0]).toFixed(1)} ${sy(0)} L ${sx(pts[0][0]).toFixed(1)} ${sy(0)} Z` : '';
  const { hx, bind } = useHoverX({ x0: L, x1: W - R, d0: 0, d1: MAX_SOL, width: W });
  const hp = hx !== null ? nearest(pts, hx) : null;
  const dd = prediction?.drop_dead_sol;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-auto w-full min-w-[560px] transition-opacity ${loading ? 'opacity-60' : ''}`}
      role="img" aria-label="Nutrient retention over mission Sols">
      <defs>
        <GlowFilter id={glowId} />
        <linearGradient id={fadeId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={C.series1} stopOpacity={0.22} />
          <stop offset="100%" stopColor={C.series1} stopOpacity={0} />
        </linearGradient>
      </defs>

      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={L} y1={sy(v)} x2={W - R} y2={sy(v)} stroke={C.grid} />
          <text x={L - 10} y={sy(v) + 4} textAnchor="end" {...TICK} fontSize={12}>{v}%</text>
        </g>
      ))}
      {[0, 200, 400, 600, 800].map((s) => (
        <text key={s} x={sx(s)} y={H - B + 19} textAnchor="middle" {...TICK} fontSize={12}>{s}</text>
      ))}
      <line x1={L} y1={sy(0)} x2={W - R} y2={sy(0)} stroke={C.axis} />
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" {...AXIS_TITLE} fontSize={11.5}>MISSION SOL</text>
      <text transform={`translate(16 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" {...AXIS_TITLE} fontSize={11.5}>
        THIAMINE (B1) RETAINED (%)
      </text>

      {/* Sol-450 mission target */}
      <line x1={sx(TARGET_SOL)} y1={T} x2={sx(TARGET_SOL)} y2={H - B} stroke={C.accent} strokeWidth="1" strokeDasharray="4 4" />
      <text x={sx(TARGET_SOL)} y={T - 12} textAnchor="middle" {...ANNOT} fontSize={12} fontWeight={600}>MISSION TARGET · SOL 450</text>

      {/* Viability cut-off (glowing, status red) */}
      <line x1={L} y1={sy(thresholdPct)} x2={W - R} y2={sy(thresholdPct)} stroke={C.act} strokeWidth="1.5" strokeDasharray="6 4"
        filter={`url(#${glowId})`} />
      <text x={L + 8} y={sy(thresholdPct) + 18} {...ANNOT} fontSize={12}>cut-off {thresholdPct}%</text>

      {area && <path d={area} fill={`url(#${fadeId})`} />}
      {line && <path d={line} fill="none" stroke={C.series1} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />}

      {dd !== undefined && dd !== null && dd <= MAX_SOL && (
        <g>
          <HaloDot cx={sx(dd)} cy={sy(thresholdPct)} color={C.act} r={4.5} />
          <text x={sx(dd) > W * 0.65 ? sx(dd) - 12 : sx(dd) + 12} y={sy(thresholdPct) - 14}
            textAnchor={sx(dd) > W * 0.65 ? 'end' : 'start'} {...ANNOT} fontSize={12} fontWeight={600} fill={C.fg}>
            Below cut-off at Sol {dd}
          </text>
        </g>
      )}

      {hp && (
        <g pointerEvents="none">
          <line x1={sx(hp[0])} y1={T} x2={sx(hp[0])} y2={H - B} stroke={C.fg} opacity={0.25} />
          <circle cx={sx(hp[0])} cy={sy(hp[1])} r={4} fill={C.series1} stroke={C.ink} strokeWidth={1.5} />
          <SvgTooltip x={sx(hp[0])} y={T + 6} maxX={W - R}
            lines={[{ text: `Sol ${Math.round(hp[0])}` }, { text: `${hp[1].toFixed(1)}% retained`, color: C.series1 }]} />
        </g>
      )}
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" {...bind} />
    </svg>
  );
};

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
  const stable = prediction?.status === 'STABLE';
  const survives = (prediction?.drop_dead_sol ?? 0) >= TARGET_SOL;

  return (
    <div>
      <Hero
        index="03"
        label="Food & Vitamins"
        lines={['Food fades.']}
        subtitle="Stored space food loses vitamins over time — faster when it's warm."
        planet="mars"
      >
        <DataBadge kind="synthetic">Model forecast · Arrhenius kinetics</DataBadge>
      </Hero>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] lg:gap-5">
        {/* Controls */}
        <Card className="space-y-6">
          <SectionHead index="04" label="Storage conditions" title="Pick food & heat" />

          <label className="block">
            <span className="eyebrow mb-2 block">Space ration item</span>
            <select value={selectedFoodId} onChange={(e) => setSelectedFoodId(e.target.value)} className="field">
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.id}] {item.name} ({item.category})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="flex items-baseline justify-between">
              <span className="eyebrow">Storage temperature</span>
              <span className={`font-mono text-2xl font-semibold ${tempTone(storageTemp)}`}>{storageTemp}°C</span>
            </span>
            <input type="range" min="-20" max="40" step="1" value={storageTemp}
              onChange={(e) => setStorageTemp(Number(e.target.value))} className="range mt-3 h-4" />
            <span className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
              <span>−20 freeze</span><span className="text-fg">4 chilled</span><span>21 ambient</span><span>35 overheat</span>
            </span>
          </label>

          <label className="block">
            <span className="flex items-baseline justify-between">
              <span className="eyebrow">Viability cut-off</span>
              <span className="font-mono text-2xl font-semibold text-accent">{thresholdPct}%</span>
            </span>
            <input type="range" min="20" max="80" step="5" value={thresholdPct}
              onChange={(e) => setThresholdPct(Number(e.target.value))} className="range mt-3 h-4" />
            <span className="mt-1.5 block text-xs text-muted">User-selected threshold (not a NASA standard).</span>
          </label>

          {selectedItem && (
            <div className="well space-y-2 p-4 text-sm">
              <span className="eyebrow block">Item Arrhenius constants</span>
              {([
                ['Activation energy (Ea)', `${selectedItem.activation_energy_Ea_kJ_mol} kJ/mol`],
                ['Frequency factor (A)', `${selectedItem.arrhenius_A.toLocaleString()} day⁻¹`],
                ['Reaction order', `${selectedItem.kinetic_order}-order exponential`],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
                  <span className="text-muted">{k}</span>
                  <span className="text-right font-mono text-fg">{v}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Curve */}
        <Card className="space-y-5">
          <SectionHead
            index="05"
            label="Nutrient retention curve"
            title={selectedItem?.name ?? '—'}
            right={prediction && (
              <TonePill tone={stable ? 'nominal' : 'act'} pulse={!stable} size="md">
                {stable ? 'Stable past Sol 450' : 'Critical degradation'}
              </TonePill>
            )}
          />
          <p className="-mt-2 font-mono text-xs text-muted">
            Storage <span className="text-fg">{storageTemp}°C</span> · rate constant k = <span className="text-fg">{prediction?.rate_constant_k_per_day ?? '—'} day⁻¹</span>
          </p>

          <p className="-mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted md:hidden">Swipe the chart to see all 800 Sols →</p>
          <div className="well overflow-x-auto p-3 sm:p-4">
            <RetentionChart prediction={prediction} thresholdPct={thresholdPct} loading={loading} />
          </div>
          <ChartLegend items={[
            { kind: 'line', color: C.series1, label: 'Thiamine (B1) retained (model)' },
            { kind: 'threshold', color: C.act, label: 'Viability cut-off' },
            { kind: 'dash', color: C.accent, label: 'Mission target Sol 450' },
            { kind: 'dot', color: C.act, label: 'Falls below cut-off' },
          ]} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Half-life (t½)" value={prediction?.half_life_sols ?? '—'} unit="Sols" hint="50% nutrient loss point" />
            <Stat label="Below cut-off at" value={prediction ? `Sol ${prediction.drop_dead_sol}` : '—'}
              tone={survives ? 'text-nominal' : 'text-act'} hint={`Falls below ${thresholdPct}% retention`} />
            <Stat label="Sol 450 status" value={prediction ? (survives ? 'Survives' : 'Expires early') : '—'}
              tone={survives ? 'text-nominal' : 'text-act'} hint="Baseline mission gate" />
          </div>
        </Card>
      </div>
    </div>
  );
};
