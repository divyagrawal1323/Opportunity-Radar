'use client';

import { ArrowUpDown, Flame, Check } from 'lucide-react';

interface FilterSortBarProps {
  totalCount: number;
  selectedType: string;
  onSelectType: (type: string) => void;
  closingSoonOnly: boolean;
  onToggleClosingSoon: () => void;
  sortBy: 'best' | 'deadline';
  onChangeSort: (sort: 'best' | 'deadline') => void;
  typeCounts: Record<string, number>;
}

const TYPES: { label: string; value: string }[] = [
  { label: 'All', value: 'All' },
  { label: 'Internships', value: 'Internship' },
  { label: 'Hackathons', value: 'Hackathon' },
  { label: 'Competitions', value: 'Competition' },
  { label: 'Scholarships', value: 'Scholarship' },
  { label: 'Fellowships', value: 'Fellowship' },
  { label: 'Open Source', value: 'Open Source' },
];

export default function FilterSortBar({
  totalCount,
  selectedType,
  onSelectType,
  closingSoonOnly,
  onToggleClosingSoon,
  sortBy,
  onChangeSort,
  typeCounts,
}: FilterSortBarProps) {
  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Results summary */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {totalCount} Opportunities Found
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Filtered &amp; Live
          </span>
        </div>

        {/* Controls: Closing Soon & Sort */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Closing soon toggle */}
          <button
            id="closing-soon-toggle-btn"
            onClick={onToggleClosingSoon}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              closingSoonOnly
                ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${closingSoonOnly ? 'text-rose-500' : 'text-slate-400'}`} />
            <span>Closing soon (≤ 7 days)</span>
            {closingSoonOnly && <Check className="w-3 h-3" />}
          </button>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Sort:</span>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => onChangeSort(e.target.value as 'best' | 'deadline')}
              className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="best" className="dark:bg-slate-900">
                Best Match (Fit Score)
              </option>
              <option value="deadline" className="dark:bg-slate-900">
                Nearest Deadline
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Type filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
        {TYPES.map((t) => {
          const isSelected = selectedType === t.value;
          const count = t.value === 'All' ? totalCount : typeCounts[t.value] || 0;

          return (
            <button
              key={t.value}
              id={`filter-type-${t.value.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => onSelectType(t.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 border ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/30'
                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-800'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
