// Real NASA Data: the crew-wide finding from Inspiration4 blood tests (GET /api/v1/real-data/i4),
// shown as big "before flight -> after landing" numbers. Every number comes from the API response.
import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ExternalLink, Lightbulb, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { fetchRealDataI4 } from '../api';
import type { RealDataI4, RealDataSharedFinding } from '../types';
import { Chip, DataTag, Details, ErrorBox, GlassPanel, Loading, Section } from '../ui/glass';

const num = (x: number | null | undefined) => (x === null || x === undefined ? '—' : x.toFixed(Math.abs(x) >= 100 ? 0 : 1));

const PersonCard: React.FC<{
  p: RealDataSharedFinding['per_astronaut'][number];
  f: RealDataSharedFinding;
  nTests: number | null;
  afterLabel: string;
}> = ({ p, f, nTests, afterLabel }) => {
  const lower = f.direction === 'down';
  const Trend = lower ? TrendingDown : TrendingUp;
  return (
    <div className="section-card flex flex-col gap-3 !p-5">
      <span className="text-sm font-medium uppercase tracking-wider text-slate-300">Crew {p.astronaut}</span>
      <div className="flex flex-wrap items-baseline gap-x-3 text-white">
        <span className="text-4xl font-bold tabular-nums">{num(p.baseline_mean)}</span>
        <ArrowRight className="h-6 w-6 self-center text-indigo-300" aria-label="to" />
        <span className="text-4xl font-bold tabular-nums">{num(p.value)}</span>
        <span className="text-base text-slate-300">{f.unit}</span>
      </div>
      <span className="text-base text-slate-300">
        Before flight{nTests ? ` (avg of ${nTests} tests)` : ''} → {afterLabel}
      </span>
      <div className="flex flex-col items-start gap-2">
        {p.beyond_all_preflight_values ? (
          <Chip tone="amber" icon={Trend}>
            {lower ? 'Lower' : 'Higher'} than all {nTests ?? ''} of their own pre-flight tests
          </Chip>
        ) : (
          <Chip tone="neutral">Within their own pre-flight tests</Chip>
        )}
        {p.ref_status === 'in' ? (
          <Chip tone="green" icon={CheckCircle2}>Still in the normal lab range</Chip>
        ) : p.ref_status !== 'n/a' ? (
          <Chip tone="red">Outside the normal lab range</Chip>
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
  const afterLabel = data?.timepoints.find((t) => t.id === f?.timepoint)?.label ?? f?.timepoint ?? '';
  const testsFor = (astronaut: string) =>
    data?.series.find((s) => s.astronaut === astronaut && s.analyte === f?.analyte)?.baseline.n ?? null;
  const limits = (data?.limitations ?? []).filter((l) => ['small_crew', 'few_baseline_points', 'short_mission'].includes(l.key));
  const dirWord = f?.direction === 'down' ? 'lower' : 'higher';

  return (
    <GlassPanel
      title="Real NASA Data"
      subtitle="NASA shared blood tests of 4 people who flew to orbit (Inspiration4). We tested our system on them."
      onBack={onBack}
      tags={<DataTag kind="real" />}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      {!data && !error && <Loading />}

      {data && !f && (
        <Section icon={Users} title="Result"><p className="text-lg text-white">No change was shared by the whole crew.</p></Section>
      )}

      {data && f && (
        <>
          <Section icon={Users} title={f.label}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {f.per_astronaut.map((p) => (
                <PersonCard key={p.astronaut} p={p} f={f} nTests={testsFor(p.astronaut)} afterLabel={afterLabel} />
              ))}
            </div>
          </Section>

          <Section icon={Lightbulb} title="What this shows">
            <p className="text-lg text-white">
              {f.n_beyond_all_preflight_values} of {f.n_crew} were {dirWord} than every one of their own pre-flight
              tests, yet {f.n_inside_reference_range} of {f.n_crew} stayed in the normal lab range. A standard lab check
              misses this — comparing each person with their own normal catches it.
            </p>
          </Section>

          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-slate-300">
              <span>Source: NASA OSDR</span>
              {data.source.urls.map((u) => (
                <a key={u.url} href={u.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-200 underline-offset-4 hover:text-white hover:underline">
                  {u.label.replace(/\s*study page$/i, '')} <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              ))}
            </p>
            {limits.length > 0 && (
              <Details>
                <ul className="list-disc space-y-1 pl-6">
                  {limits.map((l) => <li key={l.key}>{l.title}</li>)}
                </ul>
              </Details>
            )}
          </div>
        </>
      )}
    </GlassPanel>
  );
};
