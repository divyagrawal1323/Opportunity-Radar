'use client';

import { useState, useMemo, useSyncExternalStore } from 'react';
import {
  Search,
  Sparkles,
  Compass,
  ArrowRight,
  Globe,
  Radio,
  CheckCircle,
  RotateCcw,
} from 'lucide-react';

import ThemeToggle from '@/components/ThemeToggle';
import ProgressTracker from '@/components/ProgressTracker';
import SourcesPanel from '@/components/SourcesPanel';
import OpportunityCard from '@/components/OpportunityCard';
import FilterSortBar from '@/components/FilterSortBar';
import ErrorBanner from '@/components/ErrorBanner';

import { TRUSTED_SOURCES, ALL_CATEGORIES } from '@/config/sources';
import {
  OpportunityItem,
  UnderstandOutput,
  SourceStatusMap,
  RadarEvent,
} from '@/types';

interface PagePill {
  url: string;
  sourceName: string;
  status: 'reading' | 'ok' | 'thin' | 'failed';
  chars?: number;
}

const CATEGORIES_WITH_ALL = ['All', ...ALL_CATEGORIES];

const PRESETS = [
  {
    label: 'Paid AI/ML internship, 3rd year B.Tech',
    category: 'Internships',
    lookingFor: 'Paid machine learning / AI internship, remote or Bengaluru with stipend',
    profile:
      '3rd year B.Tech CSE, VIT Vellore. Skills: Python, PyTorch, Scikit-learn, React, SQL. Looking for summer 2026 or immediate internship.',
  },
  {
    label: 'Hackathons for beginners in web dev',
    category: 'Hackathons',
    lookingFor: 'Open hackathons and coding competitions with cash prizes and mentorship',
    profile:
      '2nd year B.Tech, Delhi Technological University. Skills: JavaScript, TypeScript, Next.js, Tailwind CSS, REST APIs. Enthusiastic team player.',
  },
  {
    label: 'Scholarships for engineering students',
    category: 'Scholarships',
    lookingFor: 'Merit and STEM scholarships for Indian undergraduate students 2026-27',
    profile:
      '1st year B.Tech student at Indian engineering institute. Eligible for STEM grants, merit aid and technology fellowship funding.',
  },
];

export default function HomePage() {
  const [lookingFor, setLookingFor] = useState('');
  const [profile, setProfile] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Search execution state
  const [isSearching, setIsSearching] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [understoodData, setUnderstoodData] = useState<UnderstandOutput | null>(null);
  const [pagePills, setPagePills] = useState<PagePill[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

  // Results state
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchStats, setSearchStats] = useState<{
    totalSearched: number;
    totalFetched: number;
    totalExtracted: number;
    totalValid: number;
    durationMs: number;
  } | null>(null);

  // Filters & Sorting state
  const [filterType, setFilterType] = useState<string>('All');
  const [closingSoonOnly, setClosingSoonOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'best' | 'deadline'>('best');

  // Initialize Sources Map
  const [sourcesMap, setSourcesMap] = useState<SourceStatusMap>(() => {
    const initial: SourceStatusMap = {};
    for (const s of TRUSTED_SOURCES) {
      initial[s.name] = {
        name: s.name,
        domain: s.domain,
        category: s.category,
        status: 'idle',
        chars: 0,
        count: 0,
      };
    }
    return initial;
  });

  const todayIso = useSyncExternalStore(
    () => () => {},
    () => new Date().toISOString().slice(0, 10),
    () => '2026-10-24'
  );

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setLookingFor(preset.lookingFor);
    setProfile(preset.profile);
    setSelectedCategory(preset.category);
  };

  const handleStartSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!lookingFor.trim() && !profile.trim()) {
      // Set sensible defaults if user leaves empty and clicks search
      setLookingFor('Paid AI/ML internship or web development hackathon');
      setProfile('3rd year B.Tech student, skilled in Python, React, JavaScript, seeking summer 2026 roles');
    }

    setIsSearching(true);
    setHasSearched(true);
    setErrorMessage(null);
    setErrorCode(undefined);
    setCurrentStep(1);
    setStepMessage('Connecting to Opportunity Radar pipeline...');
    setUnderstoodData(null);
    setPagePills([]);
    setOpportunities([]);
    setSearchStats(null);

    // Reset source statuses to idle
    setSourcesMap((prev) => {
      const next: SourceStatusMap = {};
      for (const key of Object.keys(prev)) {
        next[key] = { ...prev[key], status: 'idle', chars: 0, count: 0 };
      }
      return next;
    });

    try {
      const response = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookingFor: lookingFor.trim() || 'Paid tech internships and hackathons',
          profile: profile.trim() || 'College student in India seeking tech roles',
          category: selectedCategory,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const errBody = await response.text().catch(() => '');
        console.error(`[Search HTTP ${status}]:`, errBody);
        let friendly = 'An error occurred while connecting to the search service.';
        if (status === 401) friendly = 'Your API key looks wrong';
        else if (status === 429) friendly = 'Too many requests, wait a minute';
        else if (status === 402) friendly = 'Daily free limit reached';
        setErrorMessage(friendly);
        setErrorCode(`HTTP_${status}`);
        setIsSearching(false);
        return;
      }

      if (!response.body) {
        throw new Error('No response body returned from server');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep last partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const event: RadarEvent = JSON.parse(jsonStr);

              switch (event.type) {
                case 'step':
                  setCurrentStep(event.step);
                  setStepMessage(event.message);
                  break;

                case 'understand':
                  setUnderstoodData(event.data);
                  break;

                case 'fetch_page':
                  setPagePills((prev) => {
                    const existingIdx = prev.findIndex((p) => p.url === event.url);
                    if (existingIdx !== -1) {
                      const updated = [...prev];
                      updated[existingIdx] = {
                        url: event.url,
                        sourceName: event.sourceName,
                        status: event.status,
                        chars: event.chars,
                      };
                      return updated;
                    }
                    return [
                      ...prev,
                      {
                        url: event.url,
                        sourceName: event.sourceName,
                        status: event.status,
                        chars: event.chars,
                      },
                    ];
                  });
                  break;

                case 'sources_update':
                  setSourcesMap(event.sources);
                  break;

                case 'opportunities':
                  setOpportunities(event.items);
                  break;

                case 'done':
                  setOpportunities(event.items);
                  setSourcesMap(event.sources);
                  setSearchStats(event.stats);
                  setCurrentStep(6);
                  setStepMessage('Search completed successfully!');
                  setIsSearching(false);
                  break;

                case 'error':
                  setErrorMessage(event.message);
                  setErrorCode(event.code);
                  setIsSearching(false);
                  break;
              }
            } catch (parseErr) {
              console.warn('[SSE Parse Error]:', parseErr, jsonStr);
            }
          }
        }
      }
    } catch (err: unknown) {
      console.error('[Client Search Error]:', err);
      setErrorMessage("Couldn't reach TinyFish or server connection lost");
      setErrorCode('NETWORK_CLIENT_ERROR');
    } finally {
      setIsSearching(false);
    }
  };

  // Filtered and sorted opportunities for display
  const displayedOpportunities = useMemo(() => {
    let list = [...opportunities];

    // Filter by type
    if (filterType !== 'All') {
      list = list.filter((item) => item.type === filterType);
    }

    // Filter by closing soon (within 7 days)
    if (closingSoonOnly) {
      list = list.filter((item) => {
        if (!item.deadline_iso) return false;
        const today = new Date(todayIso);
        const deadline = new Date(item.deadline_iso);
        const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'best') {
        if (b.fit_score !== a.fit_score) {
          return b.fit_score - a.fit_score;
        }
        if (a.deadline_iso && b.deadline_iso) {
          return a.deadline_iso.localeCompare(b.deadline_iso);
        }
        return 0;
      } else {
        // Nearest deadline
        if (a.deadline_iso && b.deadline_iso) {
          return a.deadline_iso.localeCompare(b.deadline_iso);
        }
        if (a.deadline_iso && !b.deadline_iso) return -1;
        if (!a.deadline_iso && b.deadline_iso) return 1;
        return b.fit_score - a.fit_score;
      }
    });

    return list;
  }, [opportunities, filterType, closingSoonOnly, sortBy, todayIso]);

  // Compute counts per type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of opportunities) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return counts;
  }, [opportunities]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#070b14]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-md shadow-indigo-500/20">
              <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
                <Radio className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-900 dark:from-indigo-400 dark:via-indigo-300 dark:to-emerald-300 bg-clip-text text-transparent">
                  Opportunity Radar
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Web
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Powered by TinyFish Search &amp; Gemini 2.5 Flash
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              20 Indian Portals
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* HERO SECTION */}
        <section aria-label="Search and Filter Opportunities" className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Zero stale or expired listings • Real-time live web extraction</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
            Opportunity Radar
          </h1>

          <p className="text-base sm:text-xl font-medium text-slate-600 dark:text-slate-300">
            Live opportunities from 20 trusted sources, matched to you.
          </p>
        </section>

        {/* SEARCH FORM CARD */}
        <section aria-label="Search Parameters Form" className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-indigo-500/5 space-y-6">
          <form onSubmit={handleStartSearch} className="space-y-6">
            {/* Input 1: What are you looking for? */}
            <div className="space-y-2">
              <label
                htmlFor="looking-for-input"
                className="block text-sm font-bold text-slate-900 dark:text-slate-200"
              >
                What are you looking for?
              </label>
              <div className="relative">
                <input
                  id="looking-for-input"
                  type="text"
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value)}
                  placeholder="e.g. Paid AI/ML internship, remote, or AI hackathons with cash prizes"
                  className="w-full px-4 py-3.5 pl-11 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Input 2: About you */}
            <div className="space-y-2">
              <label
                htmlFor="profile-input"
                className="block text-sm font-bold text-slate-900 dark:text-slate-200"
              >
                About you (Course, Year, College/City, Skills, Interests)
              </label>
              <textarea
                id="profile-input"
                rows={3}
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="e.g. 3rd year B.Tech CSE, VIT Vellore. Skills: Python, PyTorch, React, SQL. Interested in NLP and Computer Vision."
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
              />
            </div>

            {/* Category Chips */}
            <div className="space-y-2.5">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Filter by Category (Default &apos;All&apos; lets AI decide)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {CATEGORIES_WITH_ALL.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      id={`category-chip-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3 Example Preset Buttons */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Quick Start Examples:
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    id={`example-preset-btn-${idx + 1}`}
                    onClick={() => handleApplyPreset(preset)}
                    className="text-xs font-medium px-3 py-1.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 transition-colors text-left flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span>&ldquo;{preset.label}&rdquo;</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Big Find Opportunities Button */}
            <div className="pt-2">
              <button
                id="find-opportunities-btn"
                type="submit"
                disabled={isSearching}
                className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 dark:from-indigo-600 dark:to-indigo-500 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 disabled:opacity-60 transition-all duration-200 flex items-center justify-center gap-3 text-base group cursor-pointer"
              >
                {isSearching ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Scanning live web across 20 portals...</span>
                  </>
                ) : (
                  <>
                    <Compass className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
                    <span>Find Opportunities</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ERROR BANNER */}
        {errorMessage && (
          <div className="max-w-4xl mx-auto">
            <ErrorBanner
              message={errorMessage}
              code={errorCode}
              onDismiss={() => {
                setErrorMessage(null);
                setErrorCode(undefined);
              }}
            />
          </div>
        )}

        {/* LIVE PROGRESS TRACKER (When searching or just searched) */}
        {(isSearching || currentStep > 0) && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
            <ProgressTracker
              currentStep={currentStep}
              stepMessage={stepMessage}
              understoodData={understoodData}
              pagePills={pagePills}
              isSearching={isSearching}
            />
          </div>
        )}

        {/* COLLAPSIBLE SOURCES PANEL */}
        <div className="max-w-4xl mx-auto">
          <SourcesPanel sourcesMap={sourcesMap} />
        </div>

        {/* RESULTS SECTION */}
        {hasSearched && !isSearching && (
          <section aria-label="Search Results" className="max-w-6xl mx-auto space-y-6">
            {/* Search Statistics Summary */}
            {searchStats && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    Scanned <strong>{searchStats.totalSearched}</strong> queries across 20 portals • Fetched{' '}
                    <strong>{searchStats.totalFetched}</strong> pages • Found{' '}
                    <strong>{searchStats.totalValid}</strong> verified open opportunities
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 bg-white/70 dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                  {(searchStats.durationMs / 1000).toFixed(1)}s elapsed
                </span>
              </div>
            )}

            {/* Filter and Sort Bar */}
            {opportunities.length > 0 && (
              <FilterSortBar
                totalCount={displayedOpportunities.length}
                selectedType={filterType}
                onSelectType={setFilterType}
                closingSoonOnly={closingSoonOnly}
                onToggleClosingSoon={() => setClosingSoonOnly(!closingSoonOnly)}
                sortBy={sortBy}
                onChangeSort={setSortBy}
                typeCounts={typeCounts}
              />
            )}

            {/* Results Grid */}
            {displayedOpportunities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedOpportunities.map((item) => (
                  <OpportunityCard key={item.id} item={item} todayIso={todayIso} />
                ))}
              </div>
            ) : !errorMessage ? (
              /* Friendly Empty State when genuinely zero opportunities found */
              <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-xl mx-auto space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center mx-auto text-indigo-500">
                  <Compass className="w-8 h-8 opacity-80" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  No active open opportunities found
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  We checked 20 live sources and filtered out all expired deadlines.
                  Try broadening your search terms, selecting &quot;All&quot; categories, or clearing active filters.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  {closingSoonOnly && (
                    <button
                      onClick={() => setClosingSoonOnly(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                    >
                      Turn off &quot;Closing soon&quot;
                    </button>
                  )}
                  {filterType !== 'All' && (
                    <button
                      onClick={() => setFilterType('All')}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors"
                    >
                      Show All Types
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setLookingFor('');
                      setProfile('');
                      setSelectedCategory('All');
                      setFilterType('All');
                      setClosingSoonOnly(false);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Search
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 py-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Opportunity Radar — Empowering Indian College Students with Real-Time Web Intelligence
          </p>
          <p>
            Scans Internshala, Devfolio, Unstop, Buddy4Study, GSoC, AICTE &amp; 14 more verified portals.
            All deadlines validated in real-time.
          </p>
        </div>
      </footer>
    </div>
  );
}
