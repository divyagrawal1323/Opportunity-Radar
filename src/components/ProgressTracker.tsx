'use client';

import { Check, Loader2, Sparkles, Globe, AlertCircle } from 'lucide-react';
import { UnderstandOutput } from '@/types';

interface PagePill {
  url: string;
  sourceName: string;
  status: 'reading' | 'ok' | 'thin' | 'failed';
  chars?: number;
}

interface ProgressTrackerProps {
  currentStep: number; // 1 to 6
  stepMessage?: string;
  understoodData: UnderstandOutput | null;
  pagePills: PagePill[];
  isSearching?: boolean;
}

const STEPS = [
  { id: 1, label: 'Understanding you' },
  { id: 2, label: 'Searching trusted sites' },
  { id: 3, label: 'Reading pages' },
  { id: 4, label: 'Matching' },
  { id: 5, label: 'Done' },
];

export default function ProgressTracker({
  currentStep,
  stepMessage,
  understoodData,
  pagePills,
}: ProgressTrackerProps) {
  // Map step numbers 1-6 to visual stepper 1-5:
  // Step 1: Understanding you
  // Step 2: Searching trusted sites
  // Step 3 & 4: Reading pages (triage + fetch)
  // Step 5: Matching
  // Step 6: Done
  const getVisualStepStatus = (stepId: number) => {
    let effectiveStep = currentStep;
    if (currentStep === 3 || currentStep === 4) effectiveStep = 3;
    if (currentStep === 5) effectiveStep = 4;
    if (currentStep >= 6) effectiveStep = 5;

    if (effectiveStep > stepId) return 'completed';
    if (effectiveStep === stepId) return 'active';
    return 'pending';
  };

  return (
    <section aria-label="Search Progress Tracker" className="w-full bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/60 rounded-3xl p-6 shadow-md shadow-indigo-500/5 space-y-6">
      {/* Visual Stepper */}
      <div className="relative">
        <div className="flex items-center justify-between max-w-3xl mx-auto relative z-10">
          {STEPS.map((step) => {
            const status = getVisualStepStatus(step.id);
            return (
              <div key={step.id} className="flex flex-col items-center group">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm ${
                    status === 'completed'
                      ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                      : status === 'active'
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/60 shadow-indigo-600/40 animate-pulse'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {status === 'completed' ? (
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  ) : status === 'active' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>

                <span
                  className={`mt-2 text-xs font-semibold tracking-tight text-center max-w-[90px] sm:max-w-none transition-colors ${
                    status === 'completed'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : status === 'active'
                      ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Connecting Progress Line */}
        <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500 transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  ((Math.min(5, currentStep === 3 || currentStep === 4 ? 3 : currentStep === 5 ? 4 : currentStep >= 6 ? 5 : currentStep) - 1) /
                    4) *
                    100
                )
              )}%`,
            }}
          />
        </div>
      </div>

      {/* Step Status Message */}
      {stepMessage && (
        <div className="text-center py-1">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping inline-block" />
            {stepMessage}
          </p>
        </div>
      )}

      {/* Extracted Keywords Chips (What AI understood) */}
      {understoodData && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Extracted Understanding &amp; Focus Keywords</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {understoodData.keywords.map((kw, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 shadow-sm animate-in zoom-in-95 duration-200"
              >
                #{kw}
              </span>
            ))}
            {understoodData.level && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Year: {understoodData.level}
              </span>
            )}
            {understoodData.location_preference && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Mode: {understoodData.location_preference}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Page Pills (Live scanning feedback) */}
      {pagePills.length > 0 && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>Scanning Web Pages ({pagePills.length})</span>
            </div>
            <span className="text-[11px] font-normal lowercase">
              live tinyfish fetch &amp; gemini extraction
            </span>
          </div>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
            {pagePills.map((pill, idx) => {
              let domain = pill.sourceName;
              try {
                domain = new URL(pill.url).hostname.replace(/^www\./, '');
              } catch {}

              const isReading = pill.status === 'reading';
              const isOk = pill.status === 'ok';
              const isThin = pill.status === 'thin';
              const isFailed = pill.status === 'failed';

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                    isReading
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 animate-pulse'
                      : isOk
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300'
                      : isThin
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300'
                      : 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                  }`}
                  title={pill.url}
                >
                  {isReading && <Loader2 className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-400" />}
                  {isOk && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                  {isThin && <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                  {isFailed && <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}

                  <span className="truncate max-w-[140px] font-semibold">{pill.sourceName}</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                    {domain}
                  </span>

                  {pill.chars !== undefined && pill.chars > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-white/70 dark:bg-black/40">
                      {(pill.chars / 1000).toFixed(1)}k chars
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
