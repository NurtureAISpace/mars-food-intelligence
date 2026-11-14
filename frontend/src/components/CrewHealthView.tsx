// Crew (landing): latest Astronaut App check-in per seat, shown only by its anonymized code.
// Every number comes from GET /health/checkins (per seat) and GET /health/scenarios (destination label).
// Seeded demo entries are tagged "Demo check-in"; real ones "From Astronaut App".
import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Clock, ExternalLink, Globe, QrCode, Rocket, Smartphone, UserPlus, Users } from 'lucide-react';
import { JoinCrewModal } from './JoinCrewModal';
import { fetchCrewScenarios } from '../api';
import {
  CrewCheckinsState, SeatState, checkinReadings, checkinReason, indicatorWord, isDemoCheckin, joinIndicatorWords,
} from '../hooks/useCrewCheckins';
import type { CheckinIndicatorKey } from '../types';
import {
  Bullets, Dot, ErrorBox, GlassPanel, KVList, KVRow, Loading, PseudonymCode, Section, SourceTag, StatTile, StatusBadge,
} from '../ui/glass';

// Offline-first Astronaut App (apps/astronaut). Override with VITE_ASTRONAUT_APP_URL at build time.
const ASTRONAUT_APP_URL: string = import.meta.env.VITE_ASTRONAUT_APP_URL ?? 'http://localhost:3001';

function when(e: NonNullable<SeatState['latest']>): string {
  const iso = e.measured_at ?? e.recorded_at;
  const d = new Date(iso);
  const t = Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `Sol ${e.sol} · ${t}`;
}

const nameOf = (s: SeatState) => s.pseudonym ?? s.astronautId;

/** Source tags for a set of seats: demo, Astronaut App, or both. */
const SeatSources: React.FC<{ seats: SeatState[] }> = ({ seats }) => {
  const withData = seats.filter((s) => s.latest);
  const demo = withData.some((s) => isDemoCheckin(s.latest!));
  const real = withData.some((s) => !isDemoCheckin(s.latest!));
  return (
    <span className="flex flex-wrap gap-2">
      {real && <SourceTag kind="astronaut" />}
      {demo && <SourceTag kind="demo" />}
    </span>
  );
};

const SeatCard: React.FC<{ s: SeatState; selected: boolean; onSelect: () => void }> = ({ s, selected, onSelect }) => (
  <button type="button" onClick={onSelect} aria-pressed={selected}
    aria-label={`${s.guest ? 'Guest' : 'Seat'} ${s.seat}: show in body view`}
    className={`inner-card flex flex-col gap-4 text-left transition ${selected ? 'ring-2 ring-indigo-400/80' : 'hover:ring-1 hover:ring-white/20'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[16px] font-medium uppercase tracking-wider text-slate-300">{s.guest ? 'Guest' : 'Seat'} {s.seat}</span>
      {s.latest && <SourceTag kind={isDemoCheckin(s.latest) ? 'demo' : 'astronaut'} />}
    </div>
    {s.latest ? (
      <>
        {s.pseudonym ? <PseudonymCode code={s.pseudonym} /> : <span className="text-[22px] font-semibold text-white">{s.astronautId}</span>}
        <div><StatusBadge status={s.latest.overall_status} /></div>
        <span className="inline-flex items-center gap-2 text-[16px] text-slate-300">
          <Clock className="h-4 w-4" aria-hidden /> {when(s.latest)}
        </span>
        <KVList>
          {checkinReadings(s.latest).map((r) => (
            <KVRow key={r.key} label={r.label} value={r.value} dot={(r.color ?? 'none') as Dot} />
          ))}
        </KVList>
        <p className="text-[18px] leading-relaxed text-white">{checkinReason(s.latest)}</p>
      </>
    ) : (
      <>
        <span className="text-[22px] font-semibold text-slate-200">No check-in yet</span>
        <div><StatusBadge status="NONE" label="Waiting" /></div>
        <p className="text-[18px] text-slate-300">Readings appear here after the first check-in in the Astronaut App.</p>
      </>
    )}
  </button>
);

/** Up to 3 actions for today, built only from the latest check-in statuses and colours. */
function todaysActions(seats: SeatState[], currentSol: number | null): string[] {
  const out: string[] = [];
  const keysWith = (s: SeatState, color: 'red' | 'amber') =>
    Object.entries(s.latest!.colors ?? {}).filter(([, c]) => c === color).map(([k]) => indicatorWord(k as CheckinIndicatorKey));
  for (const s of seats.filter((x) => x.latest?.overall_status === 'ACT')) {
    out.push(`${nameOf(s)}: ${joinIndicatorWords(keysWith(s, 'red'))} outside the reference range. Check with the flight surgeon today.`);
  }
  for (const s of seats.filter((x) => x.latest?.overall_status === 'WATCH')) {
    const off = keysWith(s, 'amber');
    const what = off.length ? joinIndicatorWords(off) : joinIndicatorWords((s.latest!.baseline_flags ?? []).map(indicatorWord));
    out.push(`${nameOf(s)}: measure ${what || 'all readings'} again at the next check-in.`);
  }
  for (const s of seats.filter((x) => !x.latest || (currentSol !== null && x.latest.sol < currentSol))) {
    out.push(`Seat ${s.seat}: no check-in${currentSol !== null ? ` for Sol ${currentSol}` : ''} yet. Remind them to open the Astronaut App.`);
  }
  if (!out.length) {
    out.push(`No action needed today: all ${seats.length} crew members have every reading in range. Next check-in tomorrow.`);
  }
  return out.slice(0, 3);
}

export const CrewHealthView: React.FC<{ crew: CrewCheckinsState; onNavigate: (tab: string) => void }> = ({ crew, onNavigate }) => {
  const { seats, guests, error, reload, currentSol, allGood, needAttention } = crew;
  const [destination, setDestination] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Body view: the clicked card; default = first card needing attention, else Seat 1.
  const people = useMemo(() => [...(seats ?? []), ...guests], [seats, guests]);
  const selected = people.find((p) => p.astronautId === selectedId)
    ?? (seats ?? []).find((s) => s.latest && s.latest.overall_status !== 'NOMINAL')
    ?? seats?.[0] ?? null;

  useEffect(() => {
    fetchCrewScenarios()
      .then((d) => setDestination(d.destinations?.find((x) => x.id === d.default_destination)?.label ?? null))
      .catch(() => setDestination(null));
  }, []);

  const checkedInToday = seats && currentSol !== null ? seats.filter((s) => s.latest?.sol === currentSol).length : 0;

  return (
    <GlassPanel
      title="MONITOR. PREDICT. PROTECT."
      subtitle="The crew's daily health at a glance. Each astronaut measures six readings in the Astronaut App; we compare them with reference ranges and with their own usual values."
    >
      {error && !seats && (
        <ErrorBox>
          Start the backend, then <button onClick={() => void reload()} className="underline">try again</button>.
        </ErrorBox>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section icon={Globe} title="Mission">
          <KVList>
            <KVRow label="Destination" value={
              <span className="inline-flex flex-wrap items-center justify-end gap-2">{destination ?? '—'} <SourceTag kind="simulated" /></span>} />
            <KVRow label="Crew size" value={seats ? seats.length : '—'} />
            <KVRow label="Current Sol" value={currentSol ?? '—'} />
            <KVRow label="Check-ins today" value={seats ? (
              <span className="inline-flex flex-wrap items-center justify-end gap-2">{`${checkedInToday} / ${seats.length}`} <SeatSources seats={seats} /></span>
            ) : '—'} />
          </KVList>
        </Section>
        <div className="flex flex-col gap-6">
          <StatTile label="All readings in range" value={seats ? allGood : '—'} tone="text-nominal"
            source={seats ? <SeatSources seats={seats} /> : undefined} />
          <StatTile label="Need attention" value={seats ? needAttention : '—'} tone={needAttention ? 'text-watch' : 'text-white'}
            source={seats ? <SeatSources seats={seats} /> : undefined} />
        </div>
      </div>

      <Section icon={Users} title="Crew: latest readings">
        {!seats && !error && <Loading />}
        {seats && (
          <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
                {seats.map((s) => <SeatCard key={s.astronautId} s={s}
                  selected={selected?.astronautId === s.astronautId} onSelect={() => setSelectedId(s.astronautId)} />)}
              </div>
              {guests.length > 0 && (
                <>
                  <h3 className="flex items-center gap-2 text-[18px] font-semibold text-slate-200">
                    <UserPlus className="h-5 w-5" aria-hidden /> Guests
                  </h3>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
                    {guests.map((s) => <SeatCard key={s.astronautId} s={s}
                      selected={selected?.astronautId === s.astronautId} onSelect={() => setSelectedId(s.astronautId)} />)}
                  </div>
                </>
              )}
          </div>
        )}
      </Section>

      {seats && (
        <Section icon={ClipboardList} title="Today's actions">
          <Bullets items={todaysActions(seats, currentSol)} />
        </Section>
      )}

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <a href={ASTRONAUT_APP_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
            <Smartphone className="h-5 w-5" aria-hidden /> Open Astronaut App <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <button onClick={() => setJoinOpen(true)} className="btn-secondary">
            <QrCode className="h-5 w-5" aria-hidden /> Join the crew
          </button>
          <button onClick={() => onNavigate('realdata')} className="btn-secondary">
            <Rocket className="h-5 w-5" aria-hidden /> Real NASA Data
          </button>
        </div>
        <p className="text-[18px] text-slate-300">Green: in range · Amber: slightly off · Red: outside the range.</p>
      </div>
      {joinOpen && <JoinCrewModal onClose={() => setJoinOpen(false)} />}
    </GlassPanel>
  );
};
