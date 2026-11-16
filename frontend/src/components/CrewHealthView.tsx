// Crew (landing): latest Astronaut App check-in per seat, shown only by its anonymized code.
// Every number comes from GET /health/checkins (per seat) and GET /health/scenarios (destination label).
// Seeded demo entries are tagged "Demo check-in"; real ones "From Astronaut App".
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, ExternalLink, Globe, QrCode, Rocket, Smartphone, UserPlus, Users } from 'lucide-react';
import { HealthAvatar } from './HealthAvatar';
import { JoinCrewModal } from './JoinCrewModal';
import { fetchCrewScenarios } from '../api';
import { useAppUrl } from '../appLink';
import {
  CrewCheckinsState, SeatState, checkinReadings, checkinReason, indicatorWord, isDemoCheckin, joinIndicatorWords,
} from '../hooks/useCrewCheckins';
import type { CheckinIndicatorKey } from '../types';
import {
  Chip, Dot, ErrorBox, GlassPanel, KVList, KVRow, Loading, PseudonymCode, Section, SourceTag, StatTile, StatusBadge,
} from '../ui/glass';

function when(e: NonNullable<SeatState['latest']>): string {
  const iso = e.measured_at ?? e.recorded_at;
  const d = new Date(iso);
  const t = Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `Sol ${e.sol} · ${t}`;
}

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

const SeatCard: React.FC<{ s: SeatState; currentSol: number | null; selected: boolean; onSelect: () => void }> = ({
  s, currentSol, selected, onSelect,
}) => (
  <button type="button" onClick={onSelect} aria-pressed={selected}
    aria-label={`${s.guest ? 'Guest' : 'Seat'} ${s.seat}: show in body view`}
    className={`inner-card flex h-full flex-col gap-4 text-left transition ${selected ? 'ring-2 ring-indigo-400/80' : 'hover:ring-1 hover:ring-white/20'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[0.8889rem] font-medium uppercase tracking-wider text-slate-300">{s.guest ? 'Guest' : 'Seat'} {s.seat}</span>
      {s.latest && <SourceTag kind={isDemoCheckin(s.latest) ? 'demo' : 'astronaut'} />}
    </div>
    {s.latest ? (
      <>
        {s.pseudonym ? <PseudonymCode code={s.pseudonym} /> : <span className="text-[1.2222rem] font-semibold text-white">{s.astronautId}</span>}
        <div><StatusBadge status={s.latest.overall_status} /></div>
        <span className="inline-flex items-center gap-2 text-[0.8889rem] text-slate-300">
          <Clock className="h-4 w-4" aria-hidden /> {when(s.latest)}
        </span>
        <KVList>
          {checkinReadings(s.latest).map((r) => (
            <KVRow key={r.key} label={r.label} value={r.value} dot={(r.color ?? 'none') as Dot} />
          ))}
        </KVList>
        <p className="text-[1rem] leading-relaxed text-white">{checkinReason(s.latest)}</p>
      </>
    ) : (
      <>
        <span className="text-[1.2222rem] font-semibold text-slate-200">No check-in yet</span>
        <div><StatusBadge status="NONE" label="Waiting" /></div>
        <p className="text-[1rem] text-slate-300">Readings appear here after the first check-in in the Astronaut App.</p>
      </>
    )}
    <NextStep step={nextStep(s, currentSol)} />
  </button>
);

type StepTone = 'act' | 'watch' | 'missing' | 'ok';
const NO_ACTION = 'No action needed today.';

/** One next step per person, built only from their latest check-in status and colours (nothing hardcoded). */
function nextStep(s: SeatState, currentSol: number | null): { text: string; tone: StepTone } {
  const e = s.latest;
  const keysWith = (color: 'red' | 'amber') =>
    Object.entries(e?.colors ?? {}).filter(([, c]) => c === color).map(([k]) => indicatorWord(k as CheckinIndicatorKey));
  if (e?.overall_status === 'ACT') {
    return { tone: 'act', text: `${joinIndicatorWords(keysWith('red')) || 'A reading'} outside the reference range: check with the flight surgeon today.` };
  }
  if (e?.overall_status === 'WATCH') {
    const off = keysWith('amber');
    const what = off.length ? joinIndicatorWords(off) : joinIndicatorWords((e.baseline_flags ?? []).map(indicatorWord));
    return { tone: 'watch', text: `Measure ${what ? what.toLowerCase() : 'all readings'} again at the next check-in.` };
  }
  // Guests join for a live demo only, so a missing guest check-in is not a crew task.
  if (!s.guest && (!e || (currentSol !== null && e.sol < currentSol))) {
    return { tone: 'missing', text: `No check-in${currentSol !== null ? ` for Sol ${currentSol}` : ''} yet: remind them to open the Astronaut App.` };
  }
  return { tone: 'ok', text: NO_ACTION };
}

const STEP_STYLE: Record<StepTone, string> = {
  act: 'border-act bg-act/10',
  watch: 'border-watch bg-watch/10',
  missing: 'border-sky-400 bg-sky-400/10',
  ok: 'border-nominal bg-nominal/10',
};

const NextStep: React.FC<{ step: ReturnType<typeof nextStep> }> = ({ step }) => (
  <div className={`mt-auto rounded-xl border-l-4 px-4 py-3 ${STEP_STYLE[step.tone]}`}>
    <span className="block text-[0.8889rem] font-semibold uppercase tracking-wider text-slate-300">Next step</span>
    <span className="mt-1 block text-[1rem] leading-relaxed text-white">{step.text}</span>
  </div>
);

export const CrewHealthView: React.FC<{ crew: CrewCheckinsState; onNavigate: (tab: string) => void }> = ({ crew, onNavigate }) => {
  const { seats, guests, error, reload, currentSol, allGood, needAttention } = crew;
  const [destination, setDestination] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const appUrl = useAppUrl(); // same link as the QR code
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
  const nActions = people.filter((p) => nextStep(p, currentSol).tone !== 'ok').length;

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.75fr_1.5fr]">
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
        <div className="flex flex-col gap-6 max-lg:grid max-lg:grid-cols-2 max-lg:gap-4">
          <StatTile label="All readings in range" value={seats ? allGood : '—'} tone="text-nominal"
            source={seats ? <SeatSources seats={seats} /> : undefined} />
          <StatTile label="Need attention" value={seats ? needAttention : '—'} tone={needAttention ? 'text-watch' : 'text-white'}
            source={seats ? <SeatSources seats={seats} /> : undefined} />
        </div>
        {seats ? <HealthAvatar person={selected} /> : <div />}
      </div>

      <Section icon={Users} title="Crew: latest readings"
        right={seats ? <Chip tone={nActions ? 'amber' : 'green'}>{nActions} {nActions === 1 ? 'action' : 'actions'} today</Chip> : undefined}>
        {!seats && !error && <Loading />}
        {seats && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
              {seats.map((s) => <SeatCard key={s.astronautId} s={s} currentSol={currentSol}
                selected={selected?.astronautId === s.astronautId} onSelect={() => setSelectedId(s.astronautId)} />)}
            </div>
            <h3 className="mt-2 flex items-center gap-2 text-[1.1111rem] font-semibold text-slate-200 max-lg:flex-wrap">
              <UserPlus className="h-5 w-5" aria-hidden /> Guests <span className="text-[0.8889rem] font-normal text-slate-400">· live check-ins from the QR code</span>
            </h3>
            {guests.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
                {guests.map((s) => <SeatCard key={s.astronautId} s={s} currentSol={currentSol}
                  selected={selected?.astronautId === s.astronautId} onSelect={() => setSelectedId(s.astronautId)} />)}
              </div>
            ) : (
              <button type="button" onClick={() => setJoinOpen(true)}
                className="inner-card flex items-center justify-between gap-3 border-dashed text-left text-[1.1111rem] text-slate-200 hover:ring-1 hover:ring-white/20">
                <span className="inline-flex items-center gap-3"><QrCode className="h-6 w-6 text-indigo-300" aria-hidden /> Scan the QR code to join</span>
                <ArrowRight className="h-5 w-5 text-indigo-300" aria-hidden />
              </button>
            )}
          </div>
        )}
      </Section>

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between max-lg:!flex-col max-lg:!items-stretch">
        <div className="flex flex-wrap gap-3 max-lg:flex-col max-lg:[&>*]:w-full">
          <a href={appUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            <Smartphone className="h-5 w-5" aria-hidden /> Open Astronaut App <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <button onClick={() => setJoinOpen(true)} className="btn-secondary max-lg:hidden">
            <QrCode className="h-5 w-5" aria-hidden /> Join the crew
          </button>
          <button onClick={() => onNavigate('realdata')} className="btn-secondary">
            <Rocket className="h-5 w-5" aria-hidden /> NASA Evidence
          </button>
        </div>
        <p className="text-[1rem] text-slate-300">Green: in range · Amber: slightly off · Red: outside the range.</p>
      </div>
      {joinOpen && <JoinCrewModal onClose={() => setJoinOpen(false)} />}
    </GlassPanel>
  );
};
