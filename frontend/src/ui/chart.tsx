import React, { useId, useState } from 'react';
import { C, MONO } from './tokens';

/** Shared SVG text styles: mono tick labels in the secondary text colour (never series colour). */
export const TICK = { fill: C.muted, fontSize: 11, fontFamily: MONO } as const;
export const AXIS_TITLE = { fill: C.muted, fontSize: 10.5, fontFamily: MONO, letterSpacing: '0.12em' } as const;
export const ANNOT = { fill: C.soft, fontSize: 10.5, fontFamily: MONO } as const;

/** Unique, CSS-safe id prefix for SVG defs (several charts share a page). */
export function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Soft glow filter for threshold lines and highlighted marks. */
export const GlowFilter: React.FC<{ id: string; blur?: number }> = ({ id, blur = 2.5 }) => (
  <filter id={id} x="-20%" y="-200%" width="140%" height="500%">
    <feGaussianBlur stdDeviation={blur} result="b" />
    <feMerge>
      <feMergeNode in="b" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

/** Small dot with a translucent halo. */
export const HaloDot: React.FC<{ cx: number; cy: number; color: string; r?: number }> = ({ cx, cy, color, r = 3.5 }) => (
  <g>
    <circle cx={cx} cy={cy} r={r * 2.6} fill={color} opacity={0.18} />
    <circle cx={cx} cy={cy} r={r} fill={color} stroke={C.ink} strokeWidth={1.5} />
  </g>
);

export type LegendKind = 'line' | 'dash' | 'band' | 'dot' | 'threshold' | 'event';
export interface LegendItem { kind: LegendKind; color: string; label: string }

const Swatch: React.FC<{ kind: LegendKind; color: string }> = ({ kind, color }) => {
  switch (kind) {
    case 'line':
      return <span className="inline-block h-[2px] w-5 rounded" style={{ background: color }} />;
    case 'dash':
      return <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: color }} />;
    case 'threshold':
      return <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: color, boxShadow: `0 0 6px ${color}` }} />;
    case 'band':
      return <span className="inline-block h-3 w-5 rounded-sm" style={{ background: `${color}26`, border: `1px solid ${color}66` }} />;
    case 'event':
      return <span className="inline-block h-3 w-5 rounded-sm" style={{ background: `${color}2E` }} />;
    case 'dot':
      return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 0 3px ${color}33` }} />;
  }
};

/** HTML legend under a chart. Text stays in text colours; the swatch carries identity. */
export const ChartLegend: React.FC<{ items: LegendItem[]; note?: string }> = ({ items, note }) => (
  <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
    {items.map((it) => (
      <li key={it.label} className="inline-flex items-center gap-2">
        <Swatch kind={it.kind} color={it.color} />
        <span>{it.label}</span>
      </li>
    ))}
    {note && <li className="font-mono text-[11px] uppercase tracking-[0.12em]">{note}</li>}
  </ul>
);

/** Chart plate: title row + svg slot + legend. */
export const ChartPlate: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  legend?: LegendItem[];
  legendNote?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, legend, legendNote, children, className = '' }) => (
  <figure className={`well p-4 ${className}`}>
    <figcaption className="mb-2 flex flex-col gap-0.5">
      <span className="text-sm font-semibold text-fg">{title}</span>
      {subtitle && <span className="font-mono text-[11px] text-muted">{subtitle}</span>}
    </figcaption>
    {children}
    {legend && legend.length > 0 && <ChartLegend items={legend} note={legendNote} />}
  </figure>
);

/**
 * Hover crosshair helper for x-continuous charts. Returns the hovered x (in data units)
 * and props to spread on a transparent <rect> covering the plot area.
 */
export function useHoverX(opts: { x0: number; x1: number; d0: number; d1: number; width: number }) {
  const [hx, setHx] = useState<number | null>(null);
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * opts.width;
    const f = Math.min(1, Math.max(0, (px - opts.x0) / (opts.x1 - opts.x0)));
    setHx(opts.d0 + f * (opts.d1 - opts.d0));
  };
  return { hx, bind: { onMouseMove: onMove, onMouseLeave: () => setHx(null) } };
}

/** Nearest point (by x) in a sorted series. */
export function nearest(points: Array<[number, number]>, x: number): [number, number] | null {
  if (!points.length) return null;
  let best = points[0];
  for (const p of points) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
  return best;
}

/** Tooltip box drawn inside the SVG, flipped to stay within the plot. */
export const SvgTooltip: React.FC<{ x: number; y: number; lines: Array<{ text: string; color?: string }>; maxX: number }> = ({ x, y, lines, maxX }) => {
  const w = Math.max(...lines.map((l) => l.text.length)) * 6.6 + 18;
  const h = lines.length * 15 + 10;
  const left = x + 10 + w > maxX ? x - 10 - w : x + 10;
  return (
    <g pointerEvents="none">
      <rect x={left} y={y} width={w} height={h} rx={6} fill="#0E0F13" stroke="rgba(255,255,255,0.16)" />
      {lines.map((l, i) => (
        <g key={i}>
          {l.color && <circle cx={left + 9} cy={y + 13 + i * 15} r={3} fill={l.color} />}
          <text x={left + (l.color ? 17 : 9)} y={y + 17 + i * 15} fill={C.fg} fontSize={11} fontFamily={MONO}>{l.text}</text>
        </g>
      ))}
    </g>
  );
};
