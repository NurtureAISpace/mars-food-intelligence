// Hex values for places Tailwind classes can't reach (SVG fill/stroke, inline styles).
// Keep in sync with tailwind.config.js.
import type { CrewStatus } from '../types';

export const C = {
  ink: '#020617',
  fg: '#F8FAFC',
  soft: '#E2E8F0',
  muted: '#CBD5E1',
  accent: '#6366F1',
  nominal: '#4ADE80',
  watch: '#FBBF24',
  act: '#F43F5E',
  real: '#34D399',
  series1: '#3B82F6',
  series2: '#A78BFA',
  forecast: '#E2E8F0',
  grid: 'rgba(255,255,255,0.07)',
  axis: 'rgba(255,255,255,0.18)',
  band: '#4ADE80',
} as const;

export const MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace';

export type StatusTone = 'neutral' | 'nominal' | 'watch' | 'act';

export const TONE: Record<StatusTone, { text: string; bg: string; border: string; dot: string; hex: string }> = {
  neutral: { text: 'text-soft', bg: 'bg-white/[0.04]', border: 'border-white/15', dot: 'bg-muted', hex: C.muted },
  nominal: { text: 'text-nominal', bg: 'bg-nominal/10', border: 'border-nominal/30', dot: 'bg-nominal', hex: C.nominal },
  watch: { text: 'text-watch', bg: 'bg-watch/10', border: 'border-watch/35', dot: 'bg-watch', hex: C.watch },
  act: { text: 'text-act', bg: 'bg-act/10', border: 'border-act/40', dot: 'bg-act', hex: C.act },
};

export const STATUS_TONE: Record<CrewStatus, StatusTone> = {
  CALIBRATING: 'neutral',
  NOMINAL: 'nominal',
  WATCH: 'watch',
  ACT: 'act',
};

/** Severity order used to pick the worst status. */
export const STATUS_RANK: Record<CrewStatus, number> = { CALIBRATING: 0, NOMINAL: 1, WATCH: 2, ACT: 3 };

/**
 * Plain-English status words shown in the UI. Backend values (NOMINAL / WATCH / ACT) stay unchanged;
 * only what people read changes. Always shown as colour + word + icon.
 */
export const STATUS_WORD: Record<CrewStatus, string> = {
  CALIBRATING: 'Learning',
  NOMINAL: 'All good',
  WATCH: 'Take care',
  ACT: 'Call doctor',
};
