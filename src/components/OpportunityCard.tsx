'use client';

import { OpportunityItem, OpportunityType } from '@/types';
import {
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  DollarSign,
  UserCheck,
  Building,
  Flame,
} from 'lucide-react';

interface OpportunityCardProps {
  item: OpportunityItem;
  todayIso: string;
}

const TYPE_STYLES: Record<OpportunityType, { bg: string; text: string; border: string }> = {
  Internship: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  Hackathon: {
    bg: 'bg-violet-50 dark:bg-violet-950/50',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800',
  },
  Competition: {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  Scholarship: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/50',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
  Fellowship: {
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  },
  'Open Source': {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
};

export default function OpportunityCard({ item, todayIso }: OpportunityCardProps) {
  const typeStyle = TYPE_STYLES[item.type] || TYPE_STYLES['Internship'];

  // Deadline calculation
  let isClosingSoon = false;
  let daysLeft: number | null = null;
  let formattedDeadline = item.deadline_text || 'Deadline not listed';

  if (item.deadline_iso) {
    const today = new Date(todayIso);
    const deadline = new Date(item.deadline_iso);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysLeft = diffDays;

    if (diffDays >= 0 && diffDays <= 7) {
      isClosingSoon = true;
    }

    try {
      formattedDeadline = new Date(item.deadline_iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      formattedDeadline = item.deadline_iso;
    }
  }

  // Fit score color
  const score = item.fit_score;
  const scoreColors =
    score >= 8
      ? {
          circle: 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
          badge: 'text-emerald-700 dark:text-emerald-300',
          dot: 'bg-emerald-500',
        }
      : score >= 5
      ? {
          circle: 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
          badge: 'text-amber-700 dark:text-amber-300',
          dot: 'bg-amber-500',
        }
      : {
          circle: 'border-slate-400 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800',
          badge: 'text-slate-600 dark:text-slate-400',
          dot: 'bg-slate-400',
        };

  return (
    <div className="group relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-800/80 transition-all duration-300 flex flex-col justify-between">
      {/* Top Header: Badges & Fit Score Gauge */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category / Type badge */}
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
            >
              {item.type}
            </span>

            {/* Mode & Location badge */}
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{item.mode}</span>
              {item.location && item.location !== 'Unknown' && (
                <span className="text-slate-400 dark:text-slate-500">• {item.location}</span>
              )}
            </span>
          </div>

          {/* Fit Score Circle */}
          <div
            className={`w-11 h-11 rounded-full border-2 flex flex-col items-center justify-center shrink-0 shadow-sm ${scoreColors.circle}`}
            title={`Fit Score: ${score}/10`}
          >
            <span className="text-xs font-black leading-none">{score}</span>
            <span className="text-[9px] font-bold uppercase tracking-tighter opacity-80 leading-none mt-0.5">
              FIT
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
          {item.title}
        </h3>

        {/* Organization & Source info */}
        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600 dark:text-slate-400">
          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
            {item.organization}
          </span>
          <span>•</span>
          <span className="text-slate-400 dark:text-slate-500 truncate">
            via {item.source_name}
          </span>
        </div>

        {/* Key Info Strip: Deadline & Stipend */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {/* Deadline */}
          <div className="flex items-center gap-2 text-xs">
            {isClosingSoon ? (
              <span className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-1 rounded-md border border-rose-200 dark:border-rose-900 animate-pulse">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Closing in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}! ({formattedDeadline})
              </span>
            ) : item.deadline_iso ? (
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Deadline: {formattedDeadline}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-slate-400 dark:text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Deadline not listed - check link</span>
              </span>
            )}
          </div>

          {/* Stipend or Prize */}
          {item.stipend_or_prize && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-200/80 dark:border-emerald-900 truncate">
              <DollarSign className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.stipend_or_prize}</span>
            </div>
          )}
        </div>

        {/* Eligibility Line */}
        {item.eligibility && (
          <div className="flex items-start gap-1.5 mt-3 text-xs text-slate-600 dark:text-slate-400">
            <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Eligibility:</span>{' '}
              {item.eligibility}
            </span>
          </div>
        )}

        {/* Why it fits (Direct AI advice to student) */}
        {item.why_it_fits && (
          <div className="mt-3.5 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100/80 dark:border-indigo-900/40">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 mb-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Why this matches you</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
              &ldquo;{item.why_it_fits}&rdquo;
            </p>
          </div>
        )}

        {/* Keyword matches */}
        {item.keyword_matches && item.keyword_matches.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {item.keyword_matches.map((kw, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer: Apply / View button */}
      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[150px]">
          {item.source_domain || item.source_name}
        </span>

        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-sm shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all duration-200 shrink-0 group/btn"
        >
          <span>Apply / View</span>
          <ExternalLink className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </a>
      </div>
    </div>
  );
}
