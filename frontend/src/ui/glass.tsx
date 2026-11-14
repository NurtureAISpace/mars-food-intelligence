// Glass UI kit for the 3 main screens: one big panel per screen, section cards, stat tiles,
// status badges (colour + word + icon), chips, selectable cards and a single "Details" toggle.
import React, { useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronDown, Database, FlaskConical, HelpCircle, Loader2, Lock,
  Stethoscope, type LucideIcon,
} from 'lucide-react';
import type { CrewStatus } from '../types';
import { STATUS_WORD } from './tokens';

type Icon = LucideIcon;

/** The one large centered glass panel of a screen: big light title, one-line subtitle, optional Back. */
export const GlassPanel: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  tags?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, onBack, tags, children }) => (
  <section className="glass-panel reveal">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-light leading-tight text-white sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-lg text-slate-300">{subtitle}</p>}
        {tags && <div className="mt-4 flex flex-wrap gap-2">{tags}</div>}
      </div>
      {onBack && (
        <button onClick={onBack} className="btn-secondary shrink-0 self-start">
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back
        </button>
      )}
    </header>
    <div className="mt-8 space-y-6">{children}</div>
  </section>
);

/** Section card with an icon tile + title row. */
export const Section: React.FC<{
  icon: Icon;
  title: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon: I, title, right, children }) => (
  <div className="section-card">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="icon-tile"><I className="h-5 w-5" aria-hidden /></span>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
      </div>
      {right}
    </div>
    {children}
  </div>
);

/** Mission-briefing stat tile: big bold number, short label. */
export const StatTile: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone = 'text-white' }) => (
  <div className="section-card !p-5">
    <div className={`text-4xl font-bold tabular-nums sm:text-5xl ${tone}`}>{value}</div>
    <div className="mt-1 text-base text-slate-300">{label}</div>
  </div>
);

export type StatusKey = CrewStatus | 'NONE';

const STATUS_STYLE: Record<StatusKey, { icon: Icon; text: string; bg: string; border: string }> = {
  NOMINAL: { icon: CheckCircle2, text: 'text-nominal', bg: 'bg-nominal/10', border: 'border-nominal/40' },
  WATCH: { icon: AlertTriangle, text: 'text-watch', bg: 'bg-watch/10', border: 'border-watch/40' },
  ACT: { icon: Stethoscope, text: 'text-act', bg: 'bg-act/10', border: 'border-act/45' },
  CALIBRATING: { icon: Loader2, text: 'text-slate-200', bg: 'bg-white/5', border: 'border-white/20' },
  NONE: { icon: HelpCircle, text: 'text-slate-300', bg: 'bg-white/5', border: 'border-white/20' },
};

export const statusWord = (s: StatusKey) => (s === 'NONE' ? 'No data' : STATUS_WORD[s]);
export const statusText = (s: StatusKey) => STATUS_STYLE[s].text;

/** Status as colour + plain word + icon (never colour alone). */
export const StatusBadge: React.FC<{ status: StatusKey; label?: string; size?: 'md' | 'lg' }> = ({ status, label, size = 'md' }) => {
  const st = STATUS_STYLE[status];
  const I = st.icon;
  return (
    <span className={`inline-flex items-center gap-2 rounded-xl border font-semibold ${st.bg} ${st.border} ${st.text} ${
      size === 'lg' ? 'px-4 py-2 text-xl' : 'px-3 py-1.5 text-base'}`}>
      <I className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden />
      {label ?? statusWord(status)}
    </span>
  );
};

const CHIP_TONE = {
  green: 'bg-nominal/15 text-nominal',
  amber: 'bg-watch/15 text-watch',
  red: 'bg-act/15 text-rose-300',
  blue: 'bg-indigo-500/20 text-indigo-200',
  neutral: 'bg-white/10 text-slate-200',
} as const;

/** Small fact chip (max ~2 short lines). */
export const Chip: React.FC<{ tone?: keyof typeof CHIP_TONE; icon?: Icon; children: React.ReactNode }> = ({ tone = 'neutral', icon: I, children }) => (
  <span className={`chip ${CHIP_TONE[tone]}`}>
    {I && <I className="h-4 w-4 shrink-0" aria-hidden />}
    <span>{children}</span>
  </span>
);

/** Honesty label, always short. */
export const DataTag: React.FC<{ kind: 'real' | 'simulated' }> = ({ kind }) =>
  kind === 'real' ? (
    <Chip tone="green" icon={Database}>Real NASA data (Inspiration4, de-identified)</Chip>
  ) : (
    <Chip tone="neutral" icon={FlaskConical}>Simulated mission data</Chip>
  );

/** Selectable card: selected = indigo border + glow + round check badge. */
export const SelectCard: React.FC<{
  selected: boolean;
  onClick: () => void;
  icon: Icon;
  title: string;
  subtitle?: React.ReactNode;
}> = ({ selected, onClick, icon: I, title, subtitle }) => (
  <button type="button" onClick={onClick} aria-pressed={selected} className="select-card w-full">
    {selected && (
      <span className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-indigo-500 text-white" aria-hidden>
        <Check className="h-4 w-4" />
      </span>
    )}
    <span className="icon-tile"><I className="h-5 w-5" aria-hidden /></span>
    <span className="mt-4 block text-2xl font-semibold text-white">{title}</span>
    {subtitle && <span className="mt-1 block text-base text-slate-300">{subtitle}</span>}
  </button>
);

/** The single collapsed "Details" toggle a screen may have. */
export const Details: React.FC<{ label?: string; children: React.ReactNode }> = ({ label = 'Details', children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex min-h-[44px] items-center gap-2 text-base font-medium text-indigo-200 hover:text-white">
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        {label}
      </button>
      {open && <div className="mt-2 text-base text-slate-300">{children}</div>}
    </div>
  );
};

/** Pseudonym with a lock: the real name never leaves the astronaut's device. */
export const PseudonymCode: React.FC<{ code: string }> = ({ code }) => (
  <span className="inline-flex items-center gap-2 font-mono text-xl font-semibold tracking-wide text-white"
    title="Name stays on the astronaut's device">
    <Lock className="h-5 w-5 text-indigo-300" aria-hidden />
    {code}
    <span className="sr-only">(anonymized code; name stays on the astronaut's device)</span>
  </span>
);

export const Loading: React.FC<{ children?: React.ReactNode }> = ({ children = 'Loading…' }) => (
  <p className="flex items-center gap-2 text-lg text-slate-300" role="status">
    <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {children}
  </p>
);

export const ErrorBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="alert" className="rounded-xl border border-act/45 bg-act/10 px-4 py-3 text-base text-white">
    <span className="font-semibold text-rose-300">Could not reach the server. </span>
    {children}
  </div>
);
