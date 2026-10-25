import { GoogleGenAI } from '@google/genai';
import { geminiConcurrencyLimiter } from './limiter';
import { UnderstandOutput, TriagedUrl, OpportunityItem, SearchResultItem } from '@/types';

export class GeminiError extends Error {
  constructor(
    message: string,
    public userFriendlyMessage?: string
  ) {
    super(message);
    this.name = 'GeminiError';
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

function getGeminiClient(): GoogleGenAI {
  const localKey = loadKeyFromEnvLocal('GEMINI_API_KEY');
  const apiKey = localKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new GeminiError(
      'Missing GEMINI_API_KEY environment variable',
      'Your Gemini API key looks wrong or is missing'
    );
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

const MODELS_CASCADE = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

export async function callGeminiWithFallback(prompt: string, jsonMode = true): Promise<string> {
  const ai = getGeminiClient();
  const configured = loadKeyFromEnvLocal('GEMINI_MODEL') || process.env.GEMINI_MODEL?.trim();
  const modelsToTry = configured ? [configured, ...MODELS_CASCADE.filter((m) => m !== configured)] : MODELS_CASCADE;

  let lastError: unknown = null;

  for (const model of modelsToTry) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: jsonMode ? { responseMimeType: 'application/json' } : undefined,
      });

      if (res && res.text) {
        return res.text;
      }
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini Fallback] Model "${model}" failed: ${errMsg.slice(0, 100)}. Trying fallback model...`);
    }
  }

  throw lastError || new Error('All Gemini models exhausted');
}

function cleanJsonText(rawText: string): string {
  let text = rawText.trim();
  if (text.startsWith('```json')) {
    text = text.slice(7);
  } else if (text.startsWith('```')) {
    text = text.slice(3);
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

/**
 * Step 1: Understand user's lookingFor and profile
 */
export async function understandStudentProfile(
  lookingFor: string,
  profile: string,
  selectedCategory: string,
  todayIso: string
): Promise<UnderstandOutput> {
  const prompt = `You are an AI advisor for Indian college students finding live student opportunities.
Today's date is: ${todayIso}.
The 6 allowed categories are:
- "Internships"
- "Hackathons"
- "Competitions"
- "Scholarships"
- "Fellowships"
- "Open Source"

Selected Category Filter by user: "${selectedCategory || 'All'}"
User Looking For: "${lookingFor}"
User Profile: "${profile}"

Analyze the student's request, skills, academic level, and preferences.
Return a single JSON object with EXACTLY this structure:
{
  "categories": ["Internships", "Hackathons"],
  "keywords": ["machine learning", "NLP", "Python", "stipend"],
  "skills": ["Python", "Machine Learning"],
  "level": "3rd year",
  "location_preference": "remote",
  "search_queries": [
    "internship apply 2026",
    "hackathon open 2026"
  ]
}`;

  console.log('[Gemini] Step 1: Understanding profile with model cascade...');
  try {
    const rawText = await callGeminiWithFallback(prompt, true);
    const text = cleanJsonText(rawText || '{}');
    const parsed = JSON.parse(text);

    return {
      categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : ['Internships', 'Hackathons'],
      keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 ? parsed.keywords : ['internship', 'student', 'opportunity'],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      level: parsed.level || 'college student',
      location_preference: parsed.location_preference || 'any',
      search_queries: Array.isArray(parsed.search_queries) && parsed.search_queries.length > 0
        ? parsed.search_queries.slice(0, 5)
        : [`${lookingFor} apply open 2026`, `${profile} opportunities 2026`],
    };
  } catch (err: unknown) {
    console.warn('[Gemini Understand Fallback]: Model unavailable, using intelligent heuristic fallback:', err);
    // Intelligent heuristic fallback so Step 1 NEVER crashes the search pipeline
    const words = `${lookingFor} ${profile}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const detectedKeywords = Array.from(new Set(words)).slice(0, 6);
    let detectedCategory: UnderstandOutput['categories'] = ['Internships', 'Hackathons'];
    if (selectedCategory && selectedCategory !== 'All') {
      detectedCategory = [selectedCategory as UnderstandOutput['categories'][number]];
    }

    return {
      categories: detectedCategory,
      keywords: detectedKeywords.length > 0 ? detectedKeywords : ['tech', 'internship', 'hackathon'],
      skills: ['Software Development'],
      level: 'College student',
      location_preference: 'India / Remote',
      search_queries: [
        `${lookingFor || 'internships hackathons'} open 2026 apply`,
        `${detectedKeywords.slice(0, 3).join(' ')} college students 2026`,
        `devfolio unstop ${detectedKeywords[0] || 'hackathons'} 2026`,
      ],
    };
  }
}

/**
 * Step 3: Triage search results to pick top specific URLs
 */
export async function triageSearchResults(
  results: Array<{ title: string; snippet: string; url: string; date?: string; site_name?: string }>,
  keywords: string[],
  profile: string
): Promise<TriagedUrl[]> {
  if (!results || results.length === 0) {
    return [];
  }

  const prompt = `You are a search triage filter.
Given these search results and target keywords: ${JSON.stringify(keywords)}
Student Profile: "${profile}"

Search Results:
${JSON.stringify(
  results.map((r, i) => ({
    id: i,
    title: r.title,
    snippet: r.snippet,
    url: r.url,
    site_name: r.site_name,
  })),
  null,
  2
)}

Select up to 8 of the best, most specific opportunity portals or event pages (exclude generic homepages and news listicles).
Return a JSON array of objects:
[
  {
    "url": "https://example.com/item",
    "reason": "Specific hackathon registration page with prizes"
  }
]`;

  try {
    const rawText = await callGeminiWithFallback(prompt, true);
    const text = cleanJsonText(rawText || '[]');
    const parsed = JSON.parse(text);
    const selected: TriagedUrl[] = Array.isArray(parsed) ? parsed : [];
    return selected.slice(0, 8);
  } catch (err: unknown) {
    console.warn('[Gemini Triage Error] Using heuristic fallback selection:', err);
    return results.slice(0, 8).map((r) => ({
      url: r.url,
      reason: 'Relevant student portal match',
    }));
  }
}

/**
 * Step 5A: Extract opportunities directly from high-signal search snippets
 */
export async function extractOpportunitiesFromSnippets(
  searchResults: SearchResultItem[],
  todayIso: string,
  keywords: string[],
  profile: string
): Promise<OpportunityItem[]> {
  if (!searchResults || searchResults.length === 0) return [];

  const prompt = `You are an AI opportunity extractor for Indian college students.
Today's date is: ${todayIso}.
Student Profile: "${profile}"
Keywords: ${JSON.stringify(keywords)}

Here are live search results from verified portals and search engines:
${JSON.stringify(
  searchResults.slice(0, 10).map((r) => ({
    title: r.title,
    snippet: r.snippet,
    url: r.url,
    site_name: r.site_name,
    date: r.date,
  })),
  null,
  2
)}

Extract ONLY real, active, or upcoming opportunities (internships, hackathons, competitions, scholarships, fellowships, open-source programs) mentioned in these snippets.
Return a valid JSON array:
[
  {
    "title": "Opportunity Title",
    "organization": "Organizer / Platform",
    "type": "Internship | Hackathon | Competition | Scholarship | Fellowship | Open Source",
    "mode": "Online | In-person | Hybrid | Remote | Unknown",
    "location": "City or Remote",
    "deadline_text": "e.g. 15 Nov 2026 or Rolling",
    "deadline_iso": "YYYY-MM-DD or null",
    "eligibility": "Brief eligibility",
    "stipend_or_prize": "e.g. ₹50,000 or null",
    "link": "Specific URL",
    "evidence": "Quote from snippet",
    "keyword_matches": ["match1"],
    "fit_score": 8,
    "why_it_fits": "Direct explanation of why this fits the student"
  }
]`;

  try {
    const rawText = await callGeminiWithFallback(prompt, true);
    const text = cleanJsonText(rawText || '[]');
    const items = JSON.parse(text);
    if (!Array.isArray(items)) return [];

    return items.map((item, index: number) => {
      let domain = 'portal';
      try {
        domain = new URL(item.link || searchResults[0]?.url || 'https://opportunity.in').hostname.replace(/^www\./, '');
      } catch {}

      return {
        id: `snip-${index}-${Date.now().toString().slice(-4)}`,
        title: String(item.title || 'Live Opportunity').trim(),
        organization: String(item.organization || domain).trim(),
        type: item.type || 'Internship',
        mode: item.mode || 'Online',
        location: item.location || 'India / Remote',
        deadline_text: item.deadline_text || 'Open for registration',
        deadline_iso: item.deadline_iso ? String(item.deadline_iso).slice(0, 10) : null,
        eligibility: item.eligibility || 'College students in India',
        stipend_or_prize: item.stipend_or_prize || null,
        link: item.link && item.link.startsWith('http') ? item.link : searchResults[index]?.url || 'https://unstop.com',
        evidence: item.evidence || item.title || '',
        keyword_matches: Array.isArray(item.keyword_matches) ? item.keyword_matches : keywords.slice(0, 2),
        fit_score: typeof item.fit_score === 'number' ? Math.min(10, Math.max(1, item.fit_score)) : 8,
        why_it_fits: item.why_it_fits || 'Matches your target skills and college profile.',
        source_name: item.organization || domain,
        source_domain: domain,
      };
    });
  } catch (err) {
    console.warn('[Extract From Snippets Error]:', err);
    return [];
  }
}

/**
 * Step 5B: Extract and match opportunities from a single page's text
 */
export async function extractOpportunitiesFromPage(
  pageText: string,
  url: string,
  sourceName: string,
  todayIso: string,
  keywords: string[],
  profile: string
): Promise<OpportunityItem[]> {
  return geminiConcurrencyLimiter.run(async () => {
    const truncatedText = pageText.slice(0, 15000);
    if (!truncatedText || truncatedText.length < 150) {
      return [];
    }

    const prompt = `You are an AI opportunity extractor analyzing live web page text for Indian college students.
Today's date is: ${todayIso}.
Page URL: ${url}
Source Name: ${sourceName}
Student Profile: "${profile}"
Target Keywords: ${JSON.stringify(keywords)}

Page Content (first 15,000 chars):
---
${truncatedText}
---

Instruction:
Extract real, specific student opportunities currently open or upcoming (including rolling or active registrations). Ignore ads, navigation menus, and past expired items.
Return a valid JSON array, max 8 items:
[
  {
    "title": "Title of Program/Internship/Hackathon",
    "organization": "Company or Institute name",
    "type": "Internship | Hackathon | Competition | Scholarship | Fellowship | Open Source",
    "mode": "Online | In-person | Hybrid | Remote | Unknown",
    "location": "Location or Remote",
    "deadline_text": "Deadline or event start date",
    "deadline_iso": "YYYY-MM-DD or null",
    "eligibility": "Eligibility criteria",
    "stipend_or_prize": "Stipend amount or prize pool or null",
    "link": "Specific link if in page, otherwise ${url}",
    "evidence": "Short quote from page verifying this opening",
    "keyword_matches": ["match1", "match2"],
    "fit_score": 8,
    "why_it_fits": "Why this aligns with the student profile"
  }
]`;

    try {
      const rawText = await callGeminiWithFallback(prompt, true);
      const text = cleanJsonText(rawText || '[]');
      const items = JSON.parse(text);

      if (!Array.isArray(items)) {
        return [];
      }

      console.log(`[Gemini Extract] ${sourceName} (${url}) extracted ${items.length} opportunities`);

      return items.map((item, index: number) => ({
        id: `${Buffer.from(url).toString('base64').slice(0, 8)}-${index}-${Date.now().toString().slice(-4)}`,
        title: String(item.title || 'Untitled Opportunity').trim(),
        organization: String(item.organization || sourceName).trim(),
        type: item.type || 'Internship',
        mode: item.mode || 'Unknown',
        location: item.location || 'India / Remote',
        deadline_text: item.deadline_text || 'Active / Open',
        deadline_iso: item.deadline_iso ? String(item.deadline_iso).slice(0, 10) : null,
        eligibility: item.eligibility || 'College students',
        stipend_or_prize: item.stipend_or_prize || null,
        link: item.link && item.link.startsWith('http') ? item.link : url,
        evidence: item.evidence || '',
        keyword_matches: Array.isArray(item.keyword_matches) ? item.keyword_matches : [],
        fit_score: typeof item.fit_score === 'number' ? Math.min(10, Math.max(1, item.fit_score)) : 8,
        why_it_fits: item.why_it_fits || 'Matches your profile and interests.',
        source_name: sourceName,
        source_domain: new URL(url).hostname.replace(/^www\./, ''),
      }));
    } catch (err: unknown) {
      console.warn(`[Gemini Extract Error] Failed for ${url}:`, err);
      return [];
    }
  });
}
