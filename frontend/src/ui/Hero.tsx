import React from 'react';
import { Eyebrow } from './primitives';

type PlanetKind = 'mars' | 'earth';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Ellipse orbit (viewBox 0..100), tilted. Back half is drawn under the planet, front half over it.
const RX = 49, RY = 15;
const ORBIT_PATH = `M ${50 - RX} 50 a ${RX} ${RY} 0 1 0 ${2 * RX} 0 a ${RX} ${RY} 0 1 0 ${-2 * RX} 0`;
const OrbitArc: React.FC<{ half: 'back' | 'front'; moon?: boolean }> = ({ half, moon }) => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
    <g transform="rotate(-18 50 50)">
      <path
        d={half === 'back'
          ? `M ${50 - RX} 50 A ${RX} ${RY} 0 0 1 ${50 + RX} 50`
          : `M ${50 + RX} 50 A ${RX} ${RY} 0 0 1 ${50 - RX} 50`}
        fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.35" vectorEffect="non-scaling-stroke"
      />
      {moon && (
        <circle r="1.5" fill="#F5F5F4" style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.8))' }}
          cx={reducedMotion() ? 50 - RX * 0.7 : undefined} cy={reducedMotion() ? 50 + RY * 0.71 : undefined}>
          {!reducedMotion() && <animateMotion dur="48s" repeatCount="indefinite" path={ORBIT_PATH} />}
        </circle>
      )}
    </g>
  </svg>
);

/** Glowing CSS planet with a thin tilted orbit line and a small moon. No images. */
export const Planet: React.FC<{ kind: PlanetKind; size: string; className?: string }> = ({ kind, size, className = '' }) => (
  <div className={`relative grid place-items-center ${className}`} style={{ width: size, height: size }} aria-hidden>
    <OrbitArc half="back" />
    <div className={`planet planet-${kind}`} style={{ width: '58%', height: '58%' }} />
    <OrbitArc half="front" moon />
  </div>
);

/**
 * Editorial hero: numbered label, giant 2–3 word headline, one-line subtitle, planet on the right.
 * Kept under ~45vh so the data below stays visible on a 1366×768 laptop / projector.
 */
export const Hero: React.FC<{
  index: string;
  label: string;
  lines: string[];
  subtitle: string;
  planet: PlanetKind;
  meta?: React.ReactNode;     // right side of the label row (e.g. status)
  children?: React.ReactNode; // honesty badges, links
}> = ({ index, label, lines, subtitle, planet, meta, children }) => (
  <section className="relative overflow-hidden border-b border-line pb-8 pt-6 sm:pb-10 lg:max-h-[45vh] lg:min-h-[300px]">
    <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
      <Eyebrow index={index}>{label}</Eyebrow>
      <div className="flex items-center gap-3">
        {meta}
        <Planet kind={planet} size="56px" className="md:hidden" />
      </div>
    </div>

    <div className="grid items-center gap-6 pt-6 md:grid-cols-[minmax(0,1fr)_auto] lg:pt-8">
      <div className="reveal min-w-0">
        <h1 className="display text-[clamp(2.4rem,5.4vw,5rem)] uppercase leading-[0.92] text-fg">
          {lines.map((l, i) => (
            <span key={l} className="block">
              {i === lines.length - 1 ? <>{l.replace(/\.$/, '')}<span className="text-accent">.</span></> : l}
            </span>
          ))}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{subtitle}</p>
        {children && <div className="mt-5 flex flex-wrap items-center gap-2">{children}</div>}
      </div>

      <div className="relative hidden md:block">
        <Planet kind={planet} size="min(24vw, 30vh, 300px)" />
      </div>
    </div>
  </section>
);
