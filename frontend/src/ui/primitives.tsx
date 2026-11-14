import React from 'react';
import { Database, FlaskConical } from 'lucide-react';
import type { CrewStatus } from '../types';
import { STATUS_TONE, StatusTone, TONE } from './tokens';

/** Small uppercase mono label. Pass `index` for numbered sections: "03 — CREW". */
export const Eyebrow: React.FC<{ index?: string; children: React.ReactNode; className?: string }> = ({ index, children, className = '' }) => (
  <span className={`eyebrow ${className}`}>
    {index && <span className="text-accent">{index}</span>}
    {index && <span className="mx-2 text-muted">—</span>}
    {children}
  </span>
);

/** Card header: numbered eyebrow + title + optional right slot, hairline below. */
export const SectionHead: React.FC<{
  index?: string;
  label: string;
  title?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}> = ({ index, label, title, right, className = '' }) => (
  <div className={`flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
    <div className="min-w-0">
      <Eyebrow index={index}>{label}</Eyebrow>
      {title && <h3 className="display mt-1.5 text-xl text-fg sm:text-2xl">{title}</h3>}
    </div>
    {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
  </div>
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }> = ({ hover, className = '', ...rest }) => (
  <div className={`card ${hover ? 'card-hover' : ''} p-5 sm:p-6 ${className}`} {...rest} />
);

/** Status pill. ACT gets a soft pulsing glow. */
export const StatusPill: React.FC<{ status: CrewStatus; label?: string; size?: 'sm' | 'md' }> = ({ status, label, size = 'sm' }) => (
  <TonePill tone={STATUS_TONE[status]} pulse={status === 'ACT'} size={size}>{label ?? status}</TonePill>
);

export const TonePill: React.FC<{ tone: StatusTone; pulse?: boolean; size?: 'sm' | 'md'; children: React.ReactNode }> = ({
  tone, pulse, size = 'sm', children,
}) => {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-semibold uppercase tracking-[0.12em] ${t.bg} ${t.border} ${t.text} ${
        size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]'
      } ${pulse ? 'glow-act' : ''}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot} ${pulse ? 'animate-pulse' : ''}`} />
      {children}
    </span>
  );
};

/** Honesty badges: real data = emerald, synthetic/simulated = neutral outline. */
export const DataBadge: React.FC<{ kind: 'real' | 'synthetic'; children: React.ReactNode }> = ({ kind, children }) =>
  kind === 'real' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-real/40 bg-real/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-real">
      <Database className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-soft">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );

/** Big mono number with small unit + label underneath. */
export const Stat: React.FC<{ label: string; value: React.ReactNode; unit?: string; tone?: string; hint?: React.ReactNode; className?: string }> = ({
  label, value, unit, tone = 'text-fg', hint, className = '',
}) => (
  <div className={`well p-4 ${className}`}>
    <span className="eyebrow block">{label}</span>
    <span className={`mt-1.5 block font-mono text-2xl font-semibold ${tone}`}>
      {value}
      {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
    </span>
    {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
  </div>
);

export const ErrorNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="alert" className="rounded-xl border border-act/40 bg-act/10 px-4 py-3 font-mono text-xs text-fg">
    <span className="font-semibold text-act">Backend error · </span>
    {children}
  </div>
);
