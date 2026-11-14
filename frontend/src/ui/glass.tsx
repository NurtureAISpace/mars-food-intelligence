// Glass UI kit for the 3 main screens ("mission designer" look): one big panel per screen, section cards,
// stat tiles, key-value rows, status badges (colour + word + icon), chips, selectable cards, source tags and a
// single "Details" toggle. Root font is 18px (html 112.5%); sizes below are in px so they match the spec exactly.
// Minimum text size on the 3 screens: 16px.
import React, { useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronDown, Database, FlaskConical, HelpCircle, Loader2, Lock,
  Smartphone, Stethoscope, TestTube, type LucideIcon,
} from 'lucide-react';
import type { CrewStatus } from '../types';
import { STATUS_WORD } from './tokens';

type Icon = LucideIcon;

/** The one large centered glass panel of a screen: 44px light title, 20px subtitle, optional Back. */
export const GlassPanel: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  tags?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, onBack, tags, children }) => (
  <section className="glass-panel reveal">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[34px] font-light leading-tight text-white sm:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-4xl text-[20px] leading-relaxed text-slate-300">{subtitle}</p>}
        {tags && <div className="mt-4 flex flex-wrap gap-2">{tags}</div>}
      </div>
      {onBack && (
        <button onClick={onBack} className="btn-secondary shrink-0 self-start">
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back
        </button>
      )}
    </header>
    <div className="mt-10 space-y-8">{children}</div>
  </section>
);

/** Section card: 44px icon tile + 26px semibold title; optional right slot (usually a SourceTag). */
export const Section: React.FC<{
  icon: Icon;
  title: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon: I, title, right, children }) => (
  <div className="section-card">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <span className="icon-tile"><I className="h-6 w-6" aria-hidden /></span>
        <h2 className="text-[26px] font-semibold leading-tight text-white">{title}</h2>
      </div>
      {right}
    </div>
    {children}
  </div>
);

/** Inner card with a 22px semibold title. */
export const Card: React.FC<{ title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title, right, children, className = '',
}) => (
  <div className={`inner-card ${className}`}>
    {(title || right) && (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {title && <h3 className="text-[22px] font-semibold leading-snug text-white">{title}</h3>}
        {right}
      </div>
    )}
    {children}
  </div>
);

/** Mission-briefing stat tile: 56px bold number, 18px label, optional source line. */
export const StatTile: React.FC<{ label: string; value: React.ReactNode; tone?: string; source?: React.ReactNode }> = ({
  label, value, tone = 'text-white', source,
}) => (
  <div className="section-card !p-6">
    <div className={`text-[56px] font-bold leading-none tabular-nums ${tone}`}>{value}</div>
    <div className="mt-3 text-[18px] text-slate-300">{label}</div>
    {source && <div className="mt-3">{source}</div>}
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
      size === 'lg' ? 'px-4 py-2 text-[22px]' : 'px-3 py-1.5 text-[18px]'}`}>
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
  sky: 'bg-sky-500/15 text-sky-200',
  violet: 'bg-violet-500/15 text-violet-200',
  neutral: 'bg-white/10 text-slate-200',
} as const;
export type ChipTone = keyof typeof CHIP_TONE;

/** Small fact chip (16px, max ~2 short lines). */
export const Chip: React.FC<{ tone?: ChipTone; icon?: Icon; children: React.ReactNode }> = ({ tone = 'neutral', icon: I, children }) => (
  <span className={`chip ${CHIP_TONE[tone]}`}>
    {I && <I className="h-4 w-4 shrink-0" aria-hidden />}
    <span>{children}</span>
  </span>
);

/** Where a number comes from. Every number on the 3 screens sits under one of these. */
export type SourceKind = 'real' | 'simulated' | 'demo' | 'astronaut';
const SOURCE: Record<SourceKind, { label: string; tone: ChipTone; icon: Icon }> = {
  real: { label: 'Real NASA data (Inspiration4)', tone: 'green', icon: Database },
  simulated: { label: 'Simulated mission', tone: 'neutral', icon: FlaskConical },
  demo: { label: 'Demo check-in', tone: 'amber', icon: TestTube },
  astronaut: { label: 'From Astronaut App', tone: 'blue', icon: Smartphone },
};
export const SourceTag: React.FC<{ kind: SourceKind }> = ({ kind }) => (
  <Chip tone={SOURCE[kind].tone} icon={SOURCE[kind].icon}>{SOURCE[kind].label}</Chip>
);
/** Back-compat name used by the screen headers. */
export const DataTag: React.FC<{ kind: 'real' | 'simulated' }> = ({ kind }) => <SourceTag kind={kind} />;

/** Key-value rows: label left (slate-400), value right (white semibold), thin dividers. */
export type Dot = 'green' | 'amber' | 'red' | 'none';
const DOT: Record<Dot, string> = { green: 'bg-nominal', amber: 'bg-watch', red: 'bg-act', none: 'bg-slate-500' };
const DOT_WORD: Record<Dot, string> = { green: 'in range', amber: 'slightly off', red: 'out of range', none: 'no reading' };

export const KVList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <dl className="divide-y divide-white/10">{children}</dl>
);
export const KVRow: React.FC<{ label: React.ReactNode; value: React.ReactNode; dot?: Dot; valueClass?: string }> = ({
  label, value, dot, valueClass = 'text-white',
}) => (
  <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
    <dt className="flex items-center gap-2.5 text-[18px] text-slate-400">
      {dot && (
        <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${DOT[dot]}`} role="img" aria-label={DOT_WORD[dot]} />
      )}
      {label}
    </dt>
    <dd className={`text-right text-[18px] font-semibold tabular-nums ${valueClass}`}>{value}</dd>
  </div>
);

/** Short bullet list (18px). */
export const Bullets: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="space-y-3">
    {items.map((it, i) => (
      <li key={i} className="flex gap-3 text-[18px] leading-relaxed text-white">
        <span className="mt-[11px] h-2 w-2 shrink-0 rounded-full bg-indigo-400" aria-hidden />
        <span>{it}</span>
      </li>
    ))}
  </ul>
);

/** Selectable card: icon + title + one meta line. Selected = indigo border + glow + round check badge, and it
 *  expands to show up to 3 coloured chips (and optional extra content). */
export const SelectCard: React.FC<{
  selected: boolean;
  onClick: () => void;
  icon: Icon;
  title: string;
  subtitle?: React.ReactNode;
  chips?: Array<{ tone: ChipTone; label: string; text: React.ReactNode }>;
  extra?: React.ReactNode;
}> = ({ selected, onClick, icon: I, title, subtitle, chips, extra }) => (
  <div data-selected={selected} className="select-card w-full">
    <button type="button" onClick={onClick} aria-pressed={selected}
      className="block w-full rounded-xl text-left focus-visible:outline-offset-4">
      {selected && (
        <span className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full bg-indigo-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.8)]" aria-hidden>
          <Check className="h-5 w-5" />
        </span>
      )}
      <span className="icon-tile"><I className="h-6 w-6" aria-hidden /></span>
      <span className="mt-4 block pr-10 text-[22px] font-semibold text-white">{title}</span>
      {subtitle && <span className="mt-1 block text-[16px] text-slate-300">{subtitle}</span>}
    </button>
    {selected && chips && chips.length > 0 && (
      <div className="mt-4 grid grid-cols-1 gap-2">
        {chips.slice(0, 3).map((c) => (
          <span key={c.label} className={`chip !flex flex-col !items-start !gap-0 !py-2 ${CHIP_TONE[c.tone]}`}>
            <span className="text-[16px] font-semibold">{c.label}</span>
            <span className="text-[16px] font-normal opacity-90">{c.text}</span>
          </span>
        ))}
      </div>
    )}
    {selected && extra && <div className="mt-4">{extra}</div>}
  </div>
);

/** The single collapsed "Details" toggle a screen may have. */
export const Details: React.FC<{ label?: string; children: React.ReactNode }> = ({ label = 'Details', children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex min-h-[48px] items-center gap-2 text-[18px] font-medium text-indigo-200 hover:text-white">
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        {label}
      </button>
      {open && <div className="mt-2 space-y-2 text-[18px] leading-relaxed text-slate-300">{children}</div>}
    </div>
  );
};

/** Pseudonym with a lock: the real name never leaves the astronaut's device. */
export const PseudonymCode: React.FC<{ code: string }> = ({ code }) => (
  <span className="inline-flex items-center gap-2 font-mono text-[22px] font-semibold tracking-wide text-white"
    title="Name stays on the astronaut's device">
    <Lock className="h-5 w-5 text-indigo-300" aria-hidden />
    {code}
    <span className="sr-only">(anonymized code; name stays on the astronaut's device)</span>
  </span>
);

export const Loading: React.FC<{ children?: React.ReactNode }> = ({ children = 'Loading…' }) => (
  <p className="flex items-center gap-2 text-[18px] text-slate-300" role="status">
    <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {children}
  </p>
);

export const ErrorBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="alert" className="rounded-xl border border-act/45 bg-act/10 px-5 py-4 text-[18px] text-white">
    <span className="font-semibold text-rose-300">Could not reach the server. </span>
    {children}
  </div>
);
