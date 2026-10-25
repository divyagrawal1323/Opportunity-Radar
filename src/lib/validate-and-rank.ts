import { OpportunityItem } from '@/types';

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function computeInfoScore(item: OpportunityItem): number {
  let score = 0;
  if (item.stipend_or_prize) score += 3;
  if (item.deadline_iso) score += 3;
  if (item.eligibility && item.eligibility.length > 10) score += 2;
  if (item.evidence && item.evidence.length > 10) score += 2;
  if (item.why_it_fits && item.why_it_fits.length > 15) score += 2;
  if (item.keyword_matches && item.keyword_matches.length > 0) score += item.keyword_matches.length;
  return score;
}

export interface ValidationResult {
  validItems: OpportunityItem[];
  droppedExpiredCount: number;
  dedupedCount: number;
}

/**
 * Step 6: Validate and rank in code
 */
export function validateAndRankOpportunities(
  rawItems: OpportunityItem[],
  todayIso: string
): ValidationResult {
  console.log(`[Step 6 Validate & Rank] Processing ${rawItems.length} raw extracted items for date ${todayIso}...`);

  let droppedExpiredCount = 0;
  const nonExpiredItems: OpportunityItem[] = [];

  // 1. Drop items where deadline_iso is before today. Never show expired items as a fallback.
  for (const item of rawItems) {
    if (item.deadline_iso && item.deadline_iso.trim() !== '') {
      const cleanDeadline = item.deadline_iso.slice(0, 10);
      const isExplicitlyActive = /rolling|open|upcoming|active|ongoing|register/i.test(item.deadline_text || '');
      if (cleanDeadline < todayIso && !isExplicitlyActive) {
        console.log(
          `[Validation] Dropping EXPIRED item: "${item.title}" by ${item.organization} (Deadline: ${cleanDeadline} < Today: ${todayIso})`
        );
        droppedExpiredCount++;
        continue;
      }
    }

    // Items with deadline_iso null are kept but labelled "Deadline not listed - check link"
    if (!item.deadline_iso) {
      if (!item.deadline_text || item.deadline_text.trim() === '') {
        item.deadline_text = 'Deadline not listed - check link';
      }
    }

    nonExpiredItems.push(item);
  }

  // 2. Dedupe by normalized title + organization (keep the one with more info)
  const dedupedMap = new Map<string, OpportunityItem>();
  let dedupedCount = 0;

  for (const item of nonExpiredItems) {
    const key = `${normalizeString(item.title)}___${normalizeString(item.organization)}`;
    const existing = dedupedMap.get(key);

    if (!existing) {
      dedupedMap.set(key, item);
    } else {
      dedupedCount++;
      const currentScore = computeInfoScore(item);
      const existingScore = computeInfoScore(existing);

      if (currentScore > existingScore) {
        dedupedMap.set(key, item);
      }
    }
  }

  const uniqueItems = Array.from(dedupedMap.values());

  // 3. Sort by fit_score desc, then nearest deadline
  uniqueItems.sort((a, b) => {
    // 1st criteria: fit_score desc
    if (b.fit_score !== a.fit_score) {
      return b.fit_score - a.fit_score;
    }

    // 2nd criteria: nearest deadline
    if (a.deadline_iso && b.deadline_iso) {
      return a.deadline_iso.localeCompare(b.deadline_iso);
    }
    if (a.deadline_iso && !b.deadline_iso) return -1;
    if (!a.deadline_iso && b.deadline_iso) return 1;

    return 0;
  });

  // Return max 30
  const finalItems = uniqueItems.slice(0, 30);

  console.log(
    `[Step 6 Validate & Rank] Done: ${rawItems.length} raw -> ${droppedExpiredCount} dropped expired -> ${dedupedCount} deduped -> ${finalItems.length} final ranked opportunities`
  );

  return {
    validItems: finalItems,
    droppedExpiredCount,
    dedupedCount,
  };
}
