import { NextRequest } from 'next/server';
import {
  TRUSTED_SOURCES,
  getSourcesForCategories,
  getSourceByDomain,
} from '@/config/sources';
import { tinyfishSearch, tinyfishFetch, TinyFishError } from '@/lib/tinyfish';
import {
  understandStudentProfile,
  triageSearchResults,
  extractOpportunitiesFromSnippets,
  extractOpportunitiesFromPage,
  GeminiError,
} from '@/lib/gemini';
import { validateAndRankOpportunities } from '@/lib/validate-and-rank';
import {
  RadarEvent,
  OpportunityCategory,
  SourceStatusMap,
  OpportunityItem,
  SearchResultItem,
  FetchedPage,
} from '@/types';

export const maxDuration = 300; // allow long-running searches

const OPEN_WEB_EXCLUDE_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'linkedin.com',
  'youtube.com',
  'reddit.com',
  'pinterest.com',
  'quora.com',
  'medium.com',
];

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const lookingFor = String(body.lookingFor || '').trim();
  const profile = String(body.profile || '').trim();
  const selectedCategoryChip = String(body.category || 'All').trim();

  const customStream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();

      function sendEvent(data: RadarEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.error('[SSE] Failed to enqueue event:', e);
        }
      }

      // Initialize all 20 sources in idle state
      const sourceStatusMap: SourceStatusMap = {};
      for (const s of TRUSTED_SOURCES) {
        sourceStatusMap[s.name] = {
          name: s.name,
          domain: s.domain,
          category: s.category,
          status: 'idle',
          chars: 0,
          count: 0,
        };
      }

      try {
        console.log('====================================================');
        console.log('[Opportunity Radar] STARTING PIPELINE');
        console.log('Looking for:', lookingFor);
        console.log('Profile:', profile);
        console.log('Category Filter:', selectedCategoryChip);
        console.log('====================================================');

        const now = new Date();
        const todayIso = now.toISOString().slice(0, 10);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const afterDateStr = sixtyDaysAgo.toISOString().slice(0, 10);

        // ------------------------------------------------------------------
        // STEP 1 - UNDERSTAND (Gemini)
        // ------------------------------------------------------------------
        sendEvent({
          type: 'step',
          step: 1,
          name: 'Understanding you',
          message: 'Analyzing your profile, skills, and target opportunities with Gemini...',
        });

        const understood = await understandStudentProfile(
          lookingFor || 'internships, hackathons and tech opportunities',
          profile || 'College student in India seeking tech roles',
          selectedCategoryChip,
          todayIso
        );

        console.log('[Step 1 Complete] Understood:', {
          categories: understood.categories,
          keywords: understood.keywords,
          skills: understood.skills,
          search_queries: understood.search_queries,
        });

        sendEvent({
          type: 'understand',
          data: understood,
        });

        // Determine target categories
        let targetCategories: OpportunityCategory[] = understood.categories;
        if (selectedCategoryChip && selectedCategoryChip !== 'All') {
          targetCategories = [selectedCategoryChip as OpportunityCategory];
        }

        const relevantSources = getSourcesForCategories(targetCategories);
        const trustedDomains = Array.from(new Set(relevantSources.map((s) => s.domain)));

        // ------------------------------------------------------------------
        // STEP 2 - GATHER (Run A and B in parallel)
        // ------------------------------------------------------------------
        sendEvent({
          type: 'step',
          step: 2,
          name: 'Searching trusted sites',
          message: `Executing live TinyFish searches across ${trustedDomains.length} portals and open web...`,
        });

        sendEvent({
          type: 'search_queries',
          queries: understood.search_queries,
          domains: trustedDomains,
        });

        console.log('[Step 2 Gather] Starting searches across domains:', trustedDomains);

        // Sub-task A: Keyword search on trusted sites + 1 open web search
        const searchPromises: Promise<SearchResultItem[]>[] = [];

        // 1. Run each search query with include_domains = trusted source domains
        for (const query of understood.search_queries) {
          searchPromises.push(
            tinyfishSearch(query, {
              location: 'IN',
              language: 'en',
              includeDomains: trustedDomains,
            }).catch((err) => {
              console.error(`[TinyFish Search Error] Query "${query}" failed:`, err.message);
              return [];
            })
          );
        }

        // 2. Run ONE extra open-web search with best query and exclude_domains
        const bestQuery = understood.search_queries[0] || `${lookingFor} college students India 2026`;
        searchPromises.push(
          tinyfishSearch(bestQuery, {
            location: 'IN',
            language: 'en',
            excludeDomains: OPEN_WEB_EXCLUDE_DOMAINS,
          }).catch((err) => {
            console.error(`[TinyFish Open Web Search Error] failed:`, err.message);
            return [];
          })
        );

        // Sub-task B: Source listing pages
        const listingUrls: string[] = relevantSources.map((s) => s.url);

        // For Internshala, also try keyword URL for top 2 keywords
        if (targetCategories.includes('Internships') || selectedCategoryChip === 'All') {
          const topKeywords = understood.keywords.slice(0, 2);
          for (const kw of topKeywords) {
            const slug = kw
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '');
            if (slug && slug.length > 2) {
              const internshalaKeywordUrl = `https://internshala.com/internships/${slug}-internship/`;
              listingUrls.push(internshalaKeywordUrl);
              console.log('[Internshala] Added keyword listing URL:', internshalaKeywordUrl);
            }
          }
        }

        // Await search results
        const searchResultsArrays = await Promise.all(searchPromises);
        const allSearchResults: SearchResultItem[] = [];
        for (const arr of searchResultsArrays) {
          allSearchResults.push(...arr);
        }

        // Merge, dedupe by URL, max 3 URLs per domain
        const domainCounts = new Map<string, number>();
        const seenUrls = new Set<string>();
        const filteredSearchResults: SearchResultItem[] = [];

        for (const r of allSearchResults) {
          if (!r.url || seenUrls.has(r.url)) continue;
          seenUrls.add(r.url);

          let domain = '';
          try {
            domain = new URL(r.url).hostname.replace(/^www\./, '');
          } catch {
            continue;
          }

          const count = domainCounts.get(domain) || 0;
          if (count < 3) {
            domainCounts.set(domain, count + 1);
            filteredSearchResults.push(r);
          }
        }

        console.log(
          `[Step 2 Complete] Found ${allSearchResults.length} total raw results, filtered to ${filteredSearchResults.length} unique URLs (max 3/domain)`
        );

        sendEvent({
          type: 'search_results',
          count: filteredSearchResults.length,
          urls: filteredSearchResults.map((r) => r.url),
        });

        // ------------------------------------------------------------------
        // STEP 3 - TRIAGE SEARCH RESULTS (Gemini)
        // ------------------------------------------------------------------
        sendEvent({
          type: 'step',
          step: 3,
          name: 'Reading pages',
          message: 'Triaging top specific opportunity URLs and filtering listicles/news...',
        });

        const triaged = await triageSearchResults(
          filteredSearchResults,
          understood.keywords,
          profile
        );

        sendEvent({
          type: 'triage',
          selected: triaged,
        });

        // ------------------------------------------------------------------
        // STEP 4 - FETCH (TinyFish Fetch, batches of max 10)
        // ------------------------------------------------------------------
        // URLs to fetch = listing pages + triaged URLs
        const urlsToFetchSet = new Set<string>();
        listingUrls.forEach((u) => urlsToFetchSet.add(u));
        triaged.forEach((t) => urlsToFetchSet.add(t.url));
        const allUrlsToFetch = Array.from(urlsToFetchSet);

        console.log(`[Step 4 Fetch] Fetching ${allUrlsToFetch.length} total URLs with TinyFish Fetch...`);

        // Emit initial reading state for UI pills
        for (const u of allUrlsToFetch) {
          let sourceName = 'Web Portal';
          try {
            const domain = new URL(u).hostname.replace(/^www\./, '');
            const matched = getSourceByDomain(domain);
            if (matched) sourceName = matched.name;
          } catch {}

          sendEvent({
            type: 'fetch_page',
            url: u,
            sourceName,
            status: 'reading',
          });
        }

        const fetchedPages: FetchedPage[] = await tinyfishFetch(
          allUrlsToFetch,
          (prog) => {
            let sourceName = 'Web Portal';
            let matchedDomain = '';
            try {
              matchedDomain = new URL(prog.url).hostname.replace(/^www\./, '');
              const matched = getSourceByDomain(matchedDomain);
              if (matched) {
                sourceName = matched.name;
                // Update source status
                const current = sourceStatusMap[matched.name];
                if (current) {
                  // Keep ok if already ok
                  if (current.status !== 'ok') {
                    current.status = prog.status;
                  }
                  current.chars += prog.chars;
                }
              }
            } catch {}

            sendEvent({
              type: 'fetch_page',
              url: prog.url,
              sourceName,
              status: prog.status,
              chars: prog.chars,
            });

            sendEvent({
              type: 'sources_update',
              sources: sourceStatusMap,
            });
          }
        );

        console.log(
          `[Step 4 Complete] Fetched ${fetchedPages.length} pages. OK: ${
            fetchedPages.filter((p) => p.status === 'ok').length
          }, Thin: ${fetchedPages.filter((p) => p.status === 'thin').length}, Failed: ${
            fetchedPages.filter((p) => p.status === 'failed').length
          }`
        );

        // ------------------------------------------------------------------
        // STEP 5 - EXTRACT AND MATCH (Gemini, max 4 at a time)
        // ------------------------------------------------------------------
        sendEvent({
          type: 'step',
          step: 5,
          name: 'Matching',
          message: 'Extracting live opportunities, checking deadlines and computing fit scores...',
        });

        const rawExtractedItems: OpportunityItem[] = [];

        // 5A: Extract directly from high-signal search snippets (captures direct listings on Unstop, Devfolio, GSoC, etc.)
        try {
          const snippetItems = await extractOpportunitiesFromSnippets(
            filteredSearchResults.slice(0, 10),
            todayIso,
            understood.keywords,
            profile
          );
          console.log(`[Step 5 Snippets] Extracted ${snippetItems.length} opportunities from search results`);
          rawExtractedItems.push(...snippetItems);
        } catch (snipErr) {
          console.warn('[Step 5 Snippets Warning]:', snipErr);
        }

        // 5B: Extract from top fetched pages (limit to top 4 valid pages with rich content)
        const validPages = fetchedPages
          .filter((p) => p.chars >= 150)
          .sort((a, b) => b.chars - a.chars)
          .slice(0, 4);

        console.log(`[Step 5 Extract] Running Gemini extraction on ${validPages.length} top fetched pages...`);

        const extractionPromises = validPages.map((page) => {
          let sourceName = 'Live Portal';
          try {
            const domain = new URL(page.url).hostname.replace(/^www\./, '');
            const matched = getSourceByDomain(domain);
            if (matched) sourceName = matched.name;
          } catch {}

          return extractOpportunitiesFromPage(
            page.text,
            page.url,
            sourceName,
            todayIso,
            understood.keywords,
            profile
          ).catch((e) => {
            console.warn(`[Page extract error] ${page.url}:`, e);
            return [];
          });
        });

        const extractionBatches = await Promise.all(extractionPromises);
        for (const items of extractionBatches) {
          rawExtractedItems.push(...items);
        }

        // Update source opportunity counts
        for (const item of rawExtractedItems) {
          const matched =
            TRUSTED_SOURCES.find((s) => s.name.toLowerCase() === item.source_name.toLowerCase()) ||
            getSourceByDomain(item.source_domain || '');

          if (matched && sourceStatusMap[matched.name]) {
            sourceStatusMap[matched.name].count += 1;
          }
        }

        console.log(`[Step 5 Complete] Extracted ${rawExtractedItems.length} total raw opportunity items`);

        // ------------------------------------------------------------------
        // STEP 6 - VALIDATE AND RANK (in code, not AI)
        // ------------------------------------------------------------------
        sendEvent({
          type: 'step',
          step: 6,
          name: 'Done',
          message: 'Finalizing live validated opportunities...',
        });

        const { validItems, droppedExpiredCount, dedupedCount } =
          validateAndRankOpportunities(rawExtractedItems, todayIso);

        console.log(
          `[Pipeline Complete] Dropped expired: ${droppedExpiredCount}, Deduped: ${dedupedCount}, Final: ${validItems.length} opportunities`
        );

        const durationMs = Date.now() - startTime;

        sendEvent({
          type: 'sources_update',
          sources: sourceStatusMap,
        });

        sendEvent({
          type: 'opportunities',
          items: validItems,
        });

        sendEvent({
          type: 'done',
          items: validItems,
          sources: sourceStatusMap,
          stats: {
            totalSearched: filteredSearchResults.length,
            totalFetched: fetchedPages.length,
            totalExtracted: rawExtractedItems.length,
            totalValid: validItems.length,
            durationMs,
          },
        });
      } catch (err: unknown) {
        console.error('[Pipeline Fatal Error]:', err);

        let userFriendly = 'An unexpected error occurred while processing opportunities.';
        let code = 'UNKNOWN';

        if (err instanceof TinyFishError) {
          userFriendly = err.userFriendlyMessage || err.message;
          code = `TINYFISH_${err.status || 'ERROR'}`;
        } else if (err instanceof GeminiError) {
          userFriendly = err.userFriendlyMessage || err.message;
          code = 'GEMINI_ERROR';
        } else if (err instanceof Error) {
          if (err.message.includes('401') || err.message.toLowerCase().includes('api key')) {
            userFriendly = 'Your API key looks wrong';
            code = 'AUTH_401';
          } else if (err.message.includes('429')) {
            userFriendly = 'Too many requests, wait a minute';
            code = 'RATE_LIMIT_429';
          } else if (err.message.includes('402')) {
            userFriendly = 'Daily free limit reached';
            code = 'LIMIT_402';
          } else if (
            err.message.toLowerCase().includes('fetch') ||
            err.message.toLowerCase().includes('econnrefused')
          ) {
            userFriendly = "Couldn't reach TinyFish";
            code = 'NETWORK_ERROR';
          }
        }

        sendEvent({
          type: 'error',
          message: userFriendly,
          code,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(customStream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
