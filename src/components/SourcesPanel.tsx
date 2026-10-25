'use client';

import { useState } from 'react';
import { TRUSTED_SOURCES } from '@/config/sources';
import { SourceStatusMap, OpportunityCategory } from '@/types';
import { ChevronDown, ChevronUp, ExternalLink, Layers } from 'lucide-react';

interface SourcesPanelProps {
  sourcesMap: SourceStatusMap;
  selectedCategories?: OpportunityCategory[];
}

export default function SourcesPanel({ sourcesMap }: SourcesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Group trusted sources by category
  const categories: OpportunityCategory[] = [
    'Internships',
    'Hackathons',
    'Competitions',
    'Scholarships',
    'Fellowships',
    'Open Source',
  ];

  let totalFound = 0;
  for (const s of TRUSTED_SOURCES) {
    const statusObj = sourcesMap[s.name];
    if (statusObj && statusObj.status !== 'idle') {
      totalFound += statusObj.count;
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return {
          dot: 'bg-emerald-500 shadow-emerald-500/50',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          label: 'OK',
        };
      case 'thin':
        return {
          dot: 'bg-amber-500 shadow-amber-500/50',
          badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          label: 'Thin',
        };
      case 'failed':
        return {
          dot: 'bg-rose-500 shadow-rose-500/50',
          badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
          label: 'Failed',
        };
      case 'reading':
        return {
          dot: 'bg-indigo-500 animate-pulse',
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
          label: 'Reading...',
        };
      default:
        return {
          dot: 'bg-slate-300 dark:bg-slate-700',
          badge: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800',
          label: 'Idle',
        };
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm transition-all duration-200 overflow-hidden">
      <button
        id="sources-panel-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Trusted Indian & Global Portals
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                20 Sources
              </span>
              {totalFound > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {totalFound} live opportunities found
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live status, crawl health, and extraction counts for all 20 verified student directories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span className="text-xs hidden sm:inline-block">
            {isOpen ? 'Collapse panel' : 'Inspect sources & health'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-5 animate-in fade-in duration-200">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 py-2 border-b border-slate-100 dark:border-slate-800/40">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Status Legend:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> OK (≥ 500 chars)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Thin (&lt; 500 chars)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Failed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 inline-block" /> Not Used
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const catSources = TRUSTED_SOURCES.filter((s) => s.category === cat);
              return (
                <div
                  key={cat}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {cat}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {catSources.length} sources
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {catSources.map((source) => {
                      const statusObj = sourcesMap[source.name];
                      const status = statusObj?.status || 'idle';
                      const count = statusObj?.count || 0;
                      const style = getStatusColor(status);

                      return (
                        <div
                          key={source.name}
                          className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs transition-colors hover:border-slate-300 dark:hover:border-slate-600"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}
                              title={`Status: ${style.label}`}
                            />
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate flex items-center gap-1"
                              title={source.url}
                            >
                              <span className="truncate">{source.name}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-40 hover:opacity-100" />
                            </a>
                            {source.jsHeavy && (
                              <span
                                className="text-[10px] px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono"
                                title="Client-side JS rendered site"
                              >
                                JS
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {count > 0 ? (
                              <span className="px-1.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[11px]">
                                {count} found
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                {status === 'idle' ? 'idle' : style.label}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
