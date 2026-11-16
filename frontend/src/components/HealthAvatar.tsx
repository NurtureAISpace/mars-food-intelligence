// Clickable body figure for one crew member: 3 zones (Brain, Heart, Blood), each coloured by the worst status of
// its 2 readings. Every value and colour comes from the latest check-in (GET /health/checkins); no new numbers.
import React, { useState } from 'react';
import { Brain, Droplet, HeartPulse } from 'lucide-react';
import type { CheckinColor, CheckinHistoryEntry, CheckinIndicatorKey } from '../types';
import { SeatState, checkinReadings, checkinReason } from '../hooks/useCrewCheckins';
import { Dot, KVList, KVRow } from '../ui/glass';

type ZoneId = 'brain' | 'heart' | 'blood';

const ZONES: Array<{
  id: ZoneId; label: string; icon: typeof Brain; keys: CheckinIndicatorKey[];
  cx: number; cy: number; r: number; labelY: number;
}> = [
  { id: 'brain', label: 'Brain', icon: Brain, keys: ['mood', 'sleep'], cx: 100, cy: 42, r: 24, labelY: 42 },
  { id: 'heart', label: 'Heart', icon: HeartPulse, keys: ['heart_rate', 'blood_pressure'], cx: 112, cy: 112, r: 20, labelY: 112 },
  { id: 'blood', label: 'Blood', icon: Droplet, keys: ['body_temperature', 'blood_glucose'], cx: 100, cy: 172, r: 20, labelY: 172 },
];

const RANK: Record<CheckinColor, number> = { green: 1, amber: 2, red: 3 };
const TONE: Record<Dot, string> = { green: 'text-nominal', amber: 'text-watch', red: 'text-act', none: 'text-slate-500' };
const WORD: Record<Dot, string> = { green: 'in range', amber: 'slightly off', red: 'outside the range', none: 'no data' };

function zoneColor(e: CheckinHistoryEntry | null, keys: CheckinIndicatorKey[]): Dot {
  const cs = keys.map((k) => e?.colors?.[k]).filter((c): c is CheckinColor => !!c);
  if (!cs.length) return 'none';
  return cs.reduce((w, c) => (RANK[c] > RANK[w] ? c : w));
}

/** The existing sentence generator, applied to this zone's 2 readings only. */
function zoneSentence(e: CheckinHistoryEntry, keys: CheckinIndicatorKey[]): string {
  const colors = Object.fromEntries(Object.entries(e.colors ?? {}).filter(([k]) => keys.includes(k as CheckinIndicatorKey)));
  return checkinReason({
    ...e,
    colors: colors as CheckinHistoryEntry['colors'],
    baseline_flags: (e.baseline_flags ?? []).filter((k) => keys.includes(k)),
  });
}

/** Simple human silhouette (own drawing): head, neck, torso, arms, legs. */
const Silhouette = () => (
  <g className="text-slate-600/50" fill="currentColor" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
    <circle cx="100" cy="42" r="28" />
    <rect x="90" y="68" width="20" height="14" rx="4" />
    <path d="M60 84 Q100 74 140 84 L146 150 Q140 200 132 214 L68 214 Q60 200 54 150 Z" />
    <path d="M60 86 Q44 92 40 120 L32 200 Q31 212 40 212 Q46 212 47 200 L58 132 Z" />
    <path d="M140 86 Q156 92 160 120 L168 200 Q169 212 160 212 Q154 212 153 200 L142 132 Z" />
    <path d="M70 212 L98 212 L96 320 Q95 332 84 332 Q74 332 74 320 Z" />
    <path d="M102 212 L130 212 L126 320 Q126 332 116 332 Q105 332 104 320 Z" />
  </g>
);

export const HealthAvatar: React.FC<{ person: SeatState | null }> = ({ person }) => {
  const [zone, setZone] = useState<ZoneId>('brain');
  const e = person?.latest ?? null;
  const active = ZONES.find((z) => z.id === zone)!;
  const readings = e ? checkinReadings(e).filter((r) => active.keys.includes(r.key)) : [];
  const who = person ? `${person.guest ? 'Guest' : 'Seat'} ${person.seat}` : '—';

  return (
    <div className="section-card !p-6 flex flex-col gap-3 max-lg:!p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[0.8889rem] font-medium uppercase tracking-wider text-slate-300">Body view · {who}</span>
        {person?.pseudonym && <span className="font-mono text-[0.8889rem] text-slate-300">{person.pseudonym}</span>}
      </div>
      <p className="text-[0.8889rem] text-slate-300">Tap a body area to see readings.</p>
      <div className="flex items-start gap-4 max-lg:flex-col max-lg:items-stretch">
        <svg viewBox="0 0 250 340" className="w-[9.4444rem] shrink-0 max-lg:mx-auto max-lg:w-[13rem]" role="group" aria-label={`Body figure for ${who}`}>
          <Silhouette />
          {ZONES.map((z) => {
            const c = zoneColor(e, z.keys);
            const I = z.icon;
            const sel = z.id === zone;
            const pick = () => setZone(z.id);
            return (
              <g key={z.id} role="button" tabIndex={0} aria-pressed={sel}
                aria-label={`${z.label}: ${z.keys.length} readings, ${WORD[c]}. Show readings.`}
                onClick={pick} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } }}
                className={`${TONE[c]} cursor-pointer outline-none [&:focus-visible>circle]:stroke-white`}>
                <circle cx={z.cx} cy={z.cy} r={z.r} fill="currentColor" fillOpacity={sel ? 0.45 : 0.25}
                  stroke="currentColor" strokeWidth={sel ? 4 : 2} />
                <I x={z.cx - 11} y={z.cy - 11} width={22} height={22} color="white" aria-hidden />
                <line x1={z.cx + z.r} y1={z.cy} x2={186} y2={z.labelY} stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx={190} cy={z.labelY} r={5} fill="currentColor" />
                <text x={200} y={z.labelY + 6} fill="white" fontSize="17" fontWeight={sel ? 700 : 500}>{z.label}</text>
              </g>
            );
          })}
        </svg>
        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 p-4" aria-live="polite">
          <div className={`flex items-center gap-2 text-[1.1111rem] font-semibold ${TONE[zoneColor(e, active.keys)]}`}>
            <active.icon className="h-5 w-5" aria-hidden /> {active.label}
          </div>
          {e ? (
            <>
              <div className="mt-3">
                <KVList>
                  {readings.map((r) => <KVRow key={r.key} label={r.label} value={r.value} dot={(r.color ?? 'none') as Dot} />)}
                </KVList>
              </div>
              <p className="mt-3 text-[0.8889rem] leading-relaxed text-white">{zoneSentence(e, active.keys)}</p>
            </>
          ) : (
            <p className="mt-3 text-[0.8889rem] text-slate-300">No check-in yet for this person.</p>
          )}
        </div>
      </div>
    </div>
  );
};
