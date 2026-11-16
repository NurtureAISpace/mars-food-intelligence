// NASA Evidence: the crew-wide finding from Inspiration4 blood tests (GET /api/v1/real-data/i4) plus the NASA research
// our app builds on. Every number in the data part comes from that one API response (source, timepoints, series,
// finding, limitations). The research list is references only (docs/DATA_SOURCES.md, "Supporting references"):
// we did not use their raw data, and no figures are copied.
import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ExternalLink, Info, Lightbulb, Orbit, Search, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { fetchRealDataI4 } from '../api';
import type { RealDataI4, RealDataSharedFinding } from '../types';
import { Card, Chip, Details, ErrorBox, GlassPanel, KVList, KVRow, Loading, Section, SourceTag } from '../ui/glass';

/** NASA research behind the app (references, not datasets). */
const RESEARCH: Array<{ label: string; where: string; text: string; usedFor: string; url: string }> = [
  {
    label: 'Cooper, Perchonok & Douglas 2017', where: 'npj Microgravity',
    text: 'NASA tested 109 space foods for 3 years at room temperature: vitamins B1 and C may fall to inadequate levels after 1 and 3 years.',
    usedFor: 'our Food forecast', url: 'https://doi.org/10.1038/s41526-017-0022-z',
  },
  {
    label: 'Smith, Heer & Zwart 2020', where: 'PubMed Central',
    text: "On the ISS, 800 IU of vitamin D per day kept astronauts' vitamin D normal (samples from 65 astronauts).",
    usedFor: 'our vitamin D advice', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7257693/',
  },
  {
    label: 'Hardy & Theriot 2025', where: 'NASA NTRS 20240014873',
    text: 'A NASA study of 35 astronauts found people adapt to spaceflight differently.',
    usedFor: 'why we compare each person with their own values', url: 'https://ntrs.nasa.gov/citations/20240014873',
  },
  {
    label: 'NASA Integrated Medical Model', where: 'nasa.gov',
    text: 'NASA plans medical risk for whole crews; we add a daily, personal layer.',
    usedFor: 'the daily Crew screen', url: 'https://www.nasa.gov/nasa-integrated-medical-model-imm-overview/',
  },
  {
    label: 'Iyer et al. 2024', where: 'Foods 13(24):4093',
    text: 'NASA food bars kept more vitamin B1 when stored cold (4 °C) — rodent food, used only as support.',
    usedFor: 'support for the cold-storage scenario', url: 'https://www.mdpi.com/2304-8158/13/24/4093',
  },
];

const ResearchSection: React.FC = () => (
  <Section icon={BookOpen} title="NASA research behind our app">
    <ol className="divide-y divide-white/10">
      {RESEARCH.map((r) => (
        <li key={r.url} className="flex flex-col gap-2 py-5 first:pt-0 last:pb-0">
          <span className="text-[1.1111rem] font-semibold text-white">
            {r.label} <span className="font-normal text-slate-400">· {r.where}</span>
          </span>
          <span className="text-[1rem] leading-relaxed text-slate-200">{r.text}</span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Chip tone="blue">Used for: {r.usedFor}</Chip>
            <a href={r.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[0.8889rem] text-indigo-200 underline-offset-4 hover:text-white hover:underline max-lg:inline max-lg:break-all max-lg:[&>svg]:inline max-lg:[&>svg]:align-[-0.15em]">
              {r.url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')} <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </span>
        </li>
      ))}
    </ol>
    <p className="mt-6 border-t border-white/10 pt-5 text-[0.8889rem] leading-relaxed text-slate-300">
      Datasets we analyse: OSD-569 and OSD-575 (NASA OSDR). The studies above are references; we did not use their raw data.
    </p>
  </Section>
);

const num = (x: number | null | undefined) => (x === null || x === undefined ? '—' : x.toFixed(Math.abs(x) >= 100 ? 0 : 1));

const PersonCard: React.FC<{ data: RealDataI4; p: RealDataSharedFinding['per_astronaut'][number]; f: RealDataSharedFinding }> = ({ data, p, f }) => {
  const lower = f.direction === 'down';
  const Trend = lower ? TrendingDown : TrendingUp;
  const series = data.series.find((s) => s.astronaut === p.astronaut && s.analyte === f.analyte);
  const label = (id: string) => (data.timepoints.find((t) => t.id === id)?.label ?? id).replace(/ (launch|return)$/, '');
  const value = (id: string) => series?.points.find((pt) => pt.timepoint === id)?.value ?? null;
  const pre = series?.baseline.timepoints ?? data.baseline_timepoints;
  return (
    <div className="inner-card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[1.2222rem] font-semibold text-white">Crew {p.astronaut}</span>
        <span className="text-[0.8889rem] text-slate-300">{f.unit}</span>
      </div>
      <KVList>
        {pre.map((id) => <KVRow key={id} label={label(id)} value={num(value(id))} />)}
        <KVRow label={label(f.timepoint)} value={num(p.value)} valueClass="text-watch" />
      </KVList>
      <div className="flex flex-col items-start gap-2">
        {p.beyond_all_preflight_values ? (
          <Chip tone="amber" icon={Trend}>{lower ? 'Below' : 'Above'} all {pre.length} pre-flight tests</Chip>
        ) : (
          <Chip tone="neutral">Within own pre-flight tests</Chip>
        )}
        {p.ref_status === 'in' ? (
          <Chip tone="green" icon={CheckCircle2}>In normal lab range</Chip>
        ) : p.ref_status !== 'n/a' ? (
          <Chip tone="red">Outside normal lab range</Chip>
        ) : null}
      </div>
    </div>
  );
};

export const RealDataView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<RealDataI4 | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRealDataI4().then(setData).catch((e) => setError(String(e)));
  }, []);

  const f = data?.summary.shared_finding ?? null;
  const tp = (id: string) => data?.timepoints.find((t) => t.id === id)?.label ?? id;
  const analyte = data?.analytes.find((a) => a.name === f?.analyte);
  const range = analyte?.reference_range;
  const dirWord = f?.direction === 'down' ? 'below' : 'above';
  const nPre = data?.baseline_timepoints.length ?? 0;
  const limits = (data?.limitations ?? []).filter((l) => ['small_crew', 'few_baseline_points', 'short_mission'].includes(l.key));
  const real = <SourceTag kind="real" />;

  return (
    <GlassPanel
      title="NASA Evidence"
      subtitle="Real NASA data (Inspiration4) + NASA research behind our app."
      onBack={onBack}
      tags={real}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      {!data && !error && <Loading />}

      {data && (
        <Section icon={Orbit} title="Mission facts" right={real}>
          <KVList>
            <KVRow label="Mission" value={data.source.mission.split(':')[0]} />
            <KVRow label="Where" value="Earth orbit" />
            <KVRow label="Time in space" value={`About ${data.source.mission_days} days`} />
            <KVRow label="Crew" value={`${data.crew.length} civilians`} />
            <KVRow label="NASA studies" value={data.source.osd_ids.join(' / ')} />
            <KVRow label="Blood tests" value={`${data.baseline_timepoints.length} before flight, ${data.post_flight_timepoints.length} after`} />
          </KVList>
        </Section>
      )}

      {data && !f && (
        <Section icon={Users} title="Result" right={real}><p className="text-[1rem] text-white">No change was shared by the whole crew.</p></Section>
      )}

      {data && f && (
        <>
          <Section icon={Users} title={f.label} right={real}>
            <p className="-mt-2 mb-5 text-[1rem] text-slate-300">
              {nPre} tests before launch, then the test {tp(f.timepoint)}.
              {range?.low != null && range?.high != null ? ` Normal lab range: ${range.low}–${range.high} ${f.unit}.` : ''}
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
              {f.per_astronaut.map((p) => <PersonCard key={p.astronaut} data={data} p={p} f={f} />)}
            </div>
          </Section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card title={<span className="inline-flex items-center gap-2"><Search className="h-5 w-5 text-indigo-300" aria-hidden />What we found</span>}>
              <p className="text-[1rem] leading-relaxed text-white">
                After landing, {f.n_beyond_all_preflight_values} of {f.n_crew} people were {dirWord} all their own pre-flight
                values, yet {f.n_inside_reference_range} of {f.n_crew} stayed inside the normal lab range.
              </p>
            </Card>
            <Card title={<span className="inline-flex items-center gap-2"><Lightbulb className="h-5 w-5 text-indigo-300" aria-hidden />Why it matters</span>}>
              <p className="text-[1rem] leading-relaxed text-white">
                A standard lab check would call everyone normal. Comparing each person with their own usual values shows the
                change. The Crew screen uses the same idea for daily check-ins.
              </p>
            </Card>
            <Card title={<span className="inline-flex items-center gap-2"><Info className="h-5 w-5 text-indigo-300" aria-hidden />Limits</span>}>
              <p className="text-[1rem] leading-relaxed text-white">
                Only {data.crew.length} people, {nPre} pre-flight tests each and a {data.source.mission_days}-day mission. It shows
                the method works on real data; it is not proof for a Mars trip.
              </p>
            </Card>
          </div>

          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[1rem] text-slate-300">
              <span>Source: NASA Open Science Data Repository</span>
              {data.source.urls.map((u) => (
                <a key={u.url} href={u.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-200 underline-offset-4 hover:text-white hover:underline">
                  {u.label.replace(/\s*study page$/i, '')} <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              ))}
            </p>
          </div>
        </>
      )}

      <ResearchSection />

      {limits.length > 0 && (
        <Details items={limits.map((l) => <><span className="font-semibold text-white">{l.title}.</span> {l.text}</>)} />
      )}
    </GlassPanel>
  );
};
