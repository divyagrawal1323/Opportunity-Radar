import { executeTinyFishRequest } from './limiter';
import { SearchResultItem, FetchedPage } from '@/types';

// In-memory cache for fetched pages (30 minutes TTL)
interface CacheEntry {
  page: FetchedPage;
  cachedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const pageCache = new Map<string, CacheEntry>();

let hasLoggedFirstSearch = false;

export class TinyFishError extends Error {
  constructor(
    message: string,
    public status?: number,
    public userFriendlyMessage?: string
  ) {
    super(message);
    this.name = 'TinyFishError';
  }
}

function mapStatusToFriendlyMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Your API key looks wrong';
    case 429:
      return 'Too many requests, wait a minute';
    case 402:
      return 'Daily free limit reached';
    default:
      if (status >= 500) {
        return "TinyFish service is temporarily unavailable";
      }
      return 'An error occurred while connecting to TinyFish';
  }
}

import fs from 'fs';
import path from 'path';

function loadKeyFromEnvLocal(name: string): string | undefined {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const k = trimmed.slice(0, idx).trim();
          if (k === name) {
            let v = trimmed.slice(idx + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            return v.trim();
          }
        }
      }
    }
  } catch {}
  return undefined;
}

export function getTinyFishApiKey(): string {
  const localKey = loadKeyFromEnvLocal('TINYFISH_API_KEY');
  const key = localKey || process.env.TINYFISH_API_KEY;
  if (!key || key.trim() === '') {
    throw new TinyFishError(
      'Missing TINYFISH_API_KEY environment variable',
      401,
      'Your API key looks wrong'
    );
  }
  return key.trim();
}

export interface SearchOptions {
  location?: string;
  language?: string;
  afterDate?: string; // YYYY-MM-DD
  includeDomains?: string[];
  excludeDomains?: string[];
}

/**
 * TinyFish Search API: GET https://api.search.tinyfish.ai
 */
export async function tinyfishSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResultItem[]> {
  const apiKey = getTinyFishApiKey();
  const url = new URL('https://api.search.tinyfish.ai');

  url.searchParams.set('query', query);
  url.searchParams.set('location', options.location || 'IN');
  url.searchParams.set('language', options.language || 'en');

  if (options.afterDate) {
    url.searchParams.set('after_date', options.afterDate);
  }

  if (options.includeDomains && options.includeDomains.length > 0) {
    url.searchParams.set('include_domains', options.includeDomains.join(','));
  }

  if (options.excludeDomains && options.excludeDomains.length > 0) {
    url.searchParams.set('exclude_domains', options.excludeDomains.join(','));
  }

  return executeTinyFishRequest(async () => {
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
      });
    } catch (err: unknown) {
      console.error('[TinyFish Search] Network/Timeout error:', err);
      throw new TinyFishError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        0,
        "Couldn't reach TinyFish"
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[TinyFish Search] HTTP ${res.status}: ${errText}`);
      throw new TinyFishError(
        `TinyFish Search failed with status ${res.status}: ${errText}`,
        res.status,
        mapStatusToFriendlyMessage(res.status)
      );
    }

    const data = await res.json();

    // Log the raw response of the first call as required by specs
    if (!hasLoggedFirstSearch) {
      console.log('=== [TinyFish Search] RAW RESPONSE OF FIRST CALL ===');
      console.log(JSON.stringify(data, null, 2));
      console.log('====================================================');
      hasLoggedFirstSearch = true;
    }

    interface RawSearchResult {
      position?: number;
      title?: string;
      snippet?: string;
      url?: string;
      site_name?: string;
      date?: string;
    }

    const rawResults = (Array.isArray(data?.results) ? data.results : []) as RawSearchResult[];
    return rawResults.map((r) => ({
      position: r.position,
      title: r.title || '',
      snippet: r.snippet || '',
      url: r.url || '',
      site_name: r.site_name || '',
      date: r.date || '',
    }));
  });
}

/**
 * TinyFish Fetch API: POST https://api.fetch.tinyfish.ai
 * Handles caching (30 min), batching (max 10 URLs), errors array without crashing
 */
export async function tinyfishFetch(
  urls: string[],
  onProgress?: (progress: { url: string; status: 'ok' | 'thin' | 'failed'; chars: number; cached: boolean }) => void
): Promise<FetchedPage[]> {
  const apiKey = getTinyFishApiKey();
  const results: FetchedPage[] = [];
  const uncachedUrls: string[] = [];
  const now = Date.now();

  // 1. Check in-memory cache first
  for (const rawUrl of urls) {
    const cached = pageCache.get(rawUrl);
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      results.push({ ...cached.page, cached: true });
      if (onProgress) {
        onProgress({
          url: rawUrl,
          status: cached.page.status,
          chars: cached.page.chars,
          cached: true,
        });
      }
    } else {
      uncachedUrls.push(rawUrl);
    }
  }

  if (uncachedUrls.length === 0) {
    return results;
  }

  // 2. Chunk uncached URLs in batches of max 10
  const BATCH_SIZE = 10;
  const batches: string[][] = [];
  for (let i = 0; i < uncachedUrls.length; i += BATCH_SIZE) {
    batches.push(uncachedUrls.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    await executeTinyFishRequest(async () => {
      let res: Response;
      try {
        res = await fetch('https://api.fetch.tinyfish.ai', {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ urls: batch }),
          signal: AbortSignal.timeout(150000), // 150s timeout
        });
      } catch (err: unknown) {
        console.error('[TinyFish Fetch] Network/Timeout error on batch:', batch, err);
        // Do not crash, mark these URLs as failed
        for (const u of batch) {
          const failedPage: FetchedPage = {
            url: u,
            title: '',
            text: '',
            status: 'failed',
            chars: 0,
            cached: false,
          };
          results.push(failedPage);
          if (onProgress) {
            onProgress({ url: u, status: 'failed', chars: 0, cached: false });
          }
        }
        return;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[TinyFish Fetch] HTTP ${res.status}: ${errText}`);
        // If 401 or 402 or 429, throw so caller can display friendly error
        if (res.status === 401 || res.status === 402 || res.status === 429) {
          throw new TinyFishError(
            `TinyFish Fetch failed with status ${res.status}: ${errText}`,
            res.status,
            mapStatusToFriendlyMessage(res.status)
          );
        }
        // Otherwise treat batch as failed without crashing pipeline
        for (const u of batch) {
          const failedPage: FetchedPage = {
            url: u,
            title: '',
            text: '',
            status: 'failed',
            chars: 0,
            cached: false,
          };
          results.push(failedPage);
          if (onProgress) {
            onProgress({ url: u, status: 'failed', chars: 0, cached: false });
          }
        }
        return;
      }

      const data = await res.json().catch(() => ({}));
      interface FetchResultItem {
        url?: string;
        title?: string;
        text?: string;
      }
      interface FetchErrorItem {
        url?: string;
        error?: string;
      }

      const returnedResults = (Array.isArray(data?.results) ? data.results : []) as FetchResultItem[];
      const returnedErrors = (Array.isArray(data?.errors) ? data.errors : []) as FetchErrorItem[];

      const resultMap = new Map<string, FetchResultItem>();
      for (const item of returnedResults) {
        if (item?.url) {
          resultMap.set(item.url, item);
        }
      }

      for (const u of batch) {
        const item = resultMap.get(u);
        if (item && item.text) {
          const text = String(item.text);
          const chars = text.length;
          const status: 'ok' | 'thin' = chars >= 500 ? 'ok' : 'thin';
          const page: FetchedPage = {
            url: u,
            title: item.title || '',
            text,
            status,
            chars,
            cached: false,
          };

          // Cache in memory for 30 minutes
          pageCache.set(u, { page, cachedAt: Date.now() });
          results.push(page);

          if (onProgress) {
            onProgress({ url: u, status, chars, cached: false });
          }
        } else {
          // Check if in errors or missing
          const errorEntry = returnedErrors.find((e) => e?.url === u);
          console.warn(`[TinyFish Fetch] URL failed or returned empty: ${u}`, errorEntry || '');
          const failedPage: FetchedPage = {
            url: u,
            title: '',
            text: '',
            status: 'failed',
            chars: 0,
            cached: false,
          };
          results.push(failedPage);

          if (onProgress) {
            onProgress({ url: u, status: 'failed', chars: 0, cached: false });
          }
        }
      }
    });
  }

  return results;
}

/**
 * Clear the in-memory cache (useful for testing)
 */
export function clearFetchCache(): void {
  pageCache.clear();
}
