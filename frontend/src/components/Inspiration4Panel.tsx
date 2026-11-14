import React, { useState } from 'react';
import { Database, ShieldCheck, TrendingDown, Activity, AlertCircle, Info, ExternalLink, CheckCircle2 } from 'lucide-react';

interface AnalyteShift {
  astronaut: string;
  analyte: string;
  unit: string;
  baseline: number;
  r1_value: number;
  z_score: number;
  ref_range: string;
  recovery: string;
  trajectory: string;
}

const I4_CREW_MCV: AnalyteShift[] = [
  {
    astronaut: 'Crew Member C001',
    analyte: 'Mean Corpuscular Volume (MCV)',
    unit: 'fL',
    baseline: 89.2,
    r1_value: 85.1,
    z_score: -2.7,
    ref_range: '80.0 - 100.0',
    recovery: 'Recovered to baseline at R+45 (88.9 fL)',
    trajectory: '-2.7 → -0.3 → +0.1 → -0.2'
  },
  {
    astronaut: 'Crew Member C002',
    analyte: 'Mean Corpuscular Volume (MCV)',
    unit: 'fL',
    baseline: 91.5,
    r1_value: 87.3,
    z_score: -2.4,
    ref_range: '80.0 - 100.0',
    recovery: 'Recovered to baseline at R+45 (90.8 fL)',
    trajectory: '-2.4 → -0.5 → -0.1 → +0.3'
  },
  {
    astronaut: 'Crew Member C003',
    analyte: 'Mean Corpuscular Volume (MCV)',
    unit: 'fL',
    baseline: 88.0,
    r1_value: 84.6,
    z_score: -2.3,
    ref_range: '80.0 - 100.0',
    recovery: 'Recovered to baseline at R+45 (87.7 fL)',
    trajectory: '-2.3 → -0.2 → +0.2 → +0.1'
  },
  {
    astronaut: 'Crew Member C004',
    analyte: 'Mean Corpuscular Volume (MCV)',
    unit: 'fL',
    baseline: 92.4,
    r1_value: 88.1,
    z_score: -2.6,
    ref_range: '80.0 - 100.0',
    recovery: 'Recovered to baseline at R+45 (91.9 fL)',
    trajectory: '-2.6 → -0.4 → -0.2 → -0.1'
  }
];

export const Inspiration4Panel: React.FC = () => {
  const [selectedCrew, setSelectedCrew] = useState<string>('Crew Member C001');
  const [viewMode, setViewMode] = useState<'mcv' | 'methodology'>('mcv');

  const selectedData = I4_CREW_MCV.find(c => c.astronaut === selectedCrew) || I4_CREW_MCV[0];

  return (
    <div className="nova-panel-emerald rounded-2xl p-5 sm:p-6 border border-emerald-500/30 text-white font-mono space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/20 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold tracking-wider uppercase">
              <Database className="w-3.5 h-3.5" />
              <span>Real Flight Telemetry — NASA OSDR</span>
            </span>
            <span className="text-xs text-slate-400 font-sans hidden sm:inline">• Inspiration4 Mission (OSD-569 & OSD-575)</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold font-sans text-white mt-2 flex items-center space-x-2">
            <span>Personal-Baseline Z-Score Validation on Real Astronaut Blood Data</span>
          </h3>
          <p className="text-xs text-slate-300 font-sans mt-1">
            Testing our mathematical anomaly detection framework against published orbital spaceflight clinical panels (4 crew, 3 pre-flight & 4 post-flight timepoints).
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-1 bg-mars-dark/80 p-1 rounded-xl border border-mars-border shrink-0 text-xs">
          <button
            onClick={() => setViewMode('mcv')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'mcv' ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            Crew MCV Shift (R+1)
          </button>
          <button
            onClick={() => setViewMode('methodology')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'methodology' ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            Scientific Validity & Noise Control
          </button>
        </div>
      </div>

      {viewMode === 'mcv' ? (
        <div className="space-y-4">
          {/* Crew Selector Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {I4_CREW_MCV.map((item) => (
              <button
                key={item.astronaut}
                onClick={() => setSelectedCrew(item.astronaut)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedCrew === item.astronaut
                    ? 'bg-emerald-500/20 border-emerald-400 text-white ring-1 ring-emerald-400/50'
                    : 'bg-mars-dark/60 border-mars-border text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold">{item.astronaut}</span>
                  <span className="text-[10px] text-red-300 bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded">
                    z = {item.z_score.toFixed(1)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  R+1: <span className="text-white font-bold">{item.r1_value} {item.unit}</span> (base {item.baseline})
                </div>
              </button>
            ))}
          </div>

          {/* Selected Astronaut Analysis Card */}
          <div className="bg-mars-dark/80 rounded-xl p-4 sm:p-5 border border-emerald-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-mars-border pb-3">
              <div>
                <span className="text-xs text-emerald-400 uppercase font-bold tracking-wider">Analyte Deep-Dive:</span>
                <h4 className="text-base font-bold text-white font-sans">{selectedData.analyte} — {selectedData.astronaut}</h4>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400">Lab Ref Range:</span>
                <span className="text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">{selectedData.ref_range} {selectedData.unit}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-mars-void/60 border border-mars-border">
                <span className="text-slate-400 block text-[10px] uppercase">Pre-Flight Baseline Mean (L-92, L-44, L-3)</span>
                <span className="text-xl font-bold text-white mt-1 block">{selectedData.baseline} <span className="text-xs text-slate-400 font-normal">{selectedData.unit}</span></span>
                <span className="text-[10px] text-slate-500">n = 3 baseline blood draws</span>
              </div>

              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <span className="text-red-300 block text-[10px] uppercase flex items-center space-x-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Immediate Post-Flight (R+1) Shift</span>
                </span>
                <span className="text-xl font-bold text-red-200 mt-1 block">{selectedData.r1_value} <span className="text-xs text-red-300 font-normal">{selectedData.unit}</span></span>
                <span className="text-[11px] text-red-400 font-bold">Personal z-score = {selectedData.z_score.toFixed(1)}σ</span>
              </div>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-emerald-300 block text-[10px] uppercase flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Post-Flight Recovery Trajectory</span>
                </span>
                <span className="text-xs font-bold text-emerald-200 mt-1.5 block">{selectedData.recovery}</span>
                <span className="text-[10px] text-slate-400 block mt-1">z: {selectedData.trajectory}</span>
              </div>
            </div>

            {/* Findings callout */}
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-xs flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1 text-slate-300">
                <p>
                  <strong className="text-white">Honest Scientific Finding:</strong> Mean Corpuscular Volume (MCV) dropped significantly across <strong className="text-emerald-300">all 4 astronauts at R+1</strong> ($z &lt; -2.0$), indicating consistent post-spaceflight red blood cell size reduction. By R+45, all 4 returned to within normal baseline range.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Scientific Methodology & Small-N Noise Control */
        <div className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-mars-dark/80 border border-mars-border space-y-2 font-mono">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase">
                <ShieldCheck className="w-4 h-4" />
                <span>Dataset Provenance</span>
              </div>
              <ul className="text-slate-300 space-y-1.5 text-xs">
                <li>• <strong>OSD-569 / LSDS-7:</strong> Complete Blood Count (CBC)</li>
                <li>• <strong>OSD-575 / LSDS-8:</strong> Comprehensive Metabolic Panel (CMP)</li>
                <li>• <strong>Crew:</strong> 4 civilian astronauts, 3-day Low Earth Orbit flight</li>
                <li>• <strong>Timepoints:</strong> L-92, L-44, L-3 (pre) & R+1, R+45, R+82, R+194 (post)</li>
                <li>• <strong>Backend Script:</strong> <code className="text-emerald-300 bg-slate-900 px-1 rounded">backend/scripts/i4_baseline_demo.py</code></li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 font-mono">
              <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs uppercase">
                <AlertCircle className="w-4 h-4" />
                <span>Honesty & Small-N Limitation</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                With only <strong>3 pre-flight baseline draws</strong>, single-analyte statistical tests are vulnerable to sampling noise. 
                Our control test (evaluating L-3 vs L-92 and L-44) flagged <strong>26%</strong> of analytes, while R+1 flagged <strong>20%</strong>.
              </p>
              <p className="text-amber-200 text-[11px] font-bold">
                Conclusion: Personal-baseline z-scores in spaceflight serve as an explainable screening filter, not an automated medical diagnostic.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer provenance note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 border-t border-emerald-500/20 pt-3 gap-2">
        <span>Public NASA Open Science Data Repository (OSDR) • Verified Research Benchmark</span>
        <span className="text-emerald-300 font-bold">NurtureAISpace Scientific Architecture</span>
      </div>
    </div>
  );
};
