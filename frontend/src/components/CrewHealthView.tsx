// Crew (landing): latest Astronaut App check-in per seat, shown only by its anonymized code.
// The web Daily Check-in form, streaks, demo values and the alert/rules section were removed from the web UI;
// the backend endpoints stay because the Astronaut App uses them.
import React from 'react';
import { Clock, ExternalLink, Rocket, Smartphone, Users } from 'lucide-react';
import { CrewCheckinsState, SeatState, checkinReason } from '../hooks/useCrewCheckins';
import { ErrorBox, GlassPanel, Loading, PseudonymCode, Section, StatTile, StatusBadge } from '../ui/glass';

// Offline-first Astronaut App (apps/astronaut). Override with VITE_ASTRONAUT_APP_URL at build time.
const ASTRONAUT_APP_URL: string = import.meta.env.VITE_ASTRONAUT_APP_URL ?? 'http://localhost:3001';

function when(e: NonNullable<SeatState['latest']>): string {
  const iso = e.measured_at ?? e.recorded_at;
  const d = new Date(iso);
  const t = Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `Sol ${e.sol} · ${t}`;
}

const SeatCard: React.FC<{ s: SeatState }> = ({ s }) => (
  <div className="section-card flex flex-col gap-3 !p-5">
    <span className="text-sm font-medium uppercase tracking-wider text-slate-300">Seat {s.seat}</span>
    {s.latest ? (
      <>
        {s.pseudonym ? <PseudonymCode code={s.pseudonym} /> : <span className="text-xl font-semibold text-white">{s.astronautId}</span>}
        <div><StatusBadge status={s.latest.overall_status} /></div>
        <span className="inline-flex items-center gap-1.5 text-base text-slate-300">
          <Clock className="h-4 w-4" aria-hidden /> {when(s.latest)}
        </span>
        <p className="text-base text-white">{checkinReason(s.latest)}</p>
      </>
    ) : (
      <>
        <span className="text-xl font-semibold text-slate-200">No check-in yet</span>
        <div><StatusBadge status="NONE" label="Waiting" /></div>
      </>
    )}
  </div>
);

export const CrewHealthView: React.FC<{ crew: CrewCheckinsState; onNavigate: (tab: string) => void }> = ({ crew, onNavigate }) => {
  const { seats, error, reload, currentSol, allGood, needAttention } = crew;

  return (
    <GlassPanel title="MONITOR. PREDICT. PROTECT." subtitle="The Mars crew's daily health, at a glance.">
      {error && !seats && (
        <ErrorBox>
          Start the backend, then <button onClick={() => void reload()} className="underline">try again</button>.
        </ErrorBox>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Crew members" value={seats ? seats.length : '—'} />
        <StatTile label="Current Sol" value={currentSol ?? '—'} />
        <StatTile label="All good" value={seats ? allGood : '—'} tone="text-nominal" />
        <StatTile label="Need attention" value={seats ? needAttention : '—'} tone={needAttention ? 'text-watch' : 'text-white'} />
      </div>

      <Section icon={Users} title="Crew">
        {!seats && !error && <Loading />}
        {seats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {seats.map((s) => <SeatCard key={s.astronautId} s={s} />)}
          </div>
        )}
      </Section>

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <a href={ASTRONAUT_APP_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
            <Smartphone className="h-5 w-5" aria-hidden /> Open Astronaut App <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <button onClick={() => onNavigate('realdata')} className="btn-secondary">
            <Rocket className="h-5 w-5" aria-hidden /> Real NASA Data
          </button>
        </div>
        <p className="text-base text-slate-300">Daily check-ins come from the Astronaut App.</p>
      </div>
    </GlassPanel>
  );
};
