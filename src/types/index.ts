export type OpportunityCategory =
  | 'Internships'
  | 'Hackathons'
  | 'Competitions'
  | 'Scholarships'
  | 'Fellowships'
  | 'Open Source';

export type OpportunityType =
  | 'Internship'
  | 'Hackathon'
  | 'Competition'
  | 'Scholarship'
  | 'Fellowship'
  | 'Open Source';

export type OpportunityMode =
  | 'Online'
  | 'In-person'
  | 'Hybrid'
  | 'Remote'
  | 'Unknown';

export interface SourceConfig {
  name: string;
  url: string;
  domain: string;
  category: OpportunityCategory;
  jsHeavy?: boolean;
}

export type SourceStatus = 'ok' | 'thin' | 'failed' | 'idle' | 'reading';

export interface SourceStatusMap {
  [sourceName: string]: {
    name: string;
    domain: string;
    category: OpportunityCategory;
    status: SourceStatus;
    chars: number;
    count: number;
  };
}

export interface OpportunityItem {
  id: string;
  title: string;
  organization: string;
  type: OpportunityType;
  mode: OpportunityMode;
  location: string;
  deadline_text: string;
  deadline_iso: string | null;
  eligibility: string;
  stipend_or_prize: string | null;
  link: string;
  evidence: string;
  keyword_matches: string[];
  fit_score: number; // 1 - 10
  why_it_fits: string;
  source_name: string;
  source_domain?: string;
}

export interface UnderstandOutput {
  categories: OpportunityCategory[];
  keywords: string[];
  skills: string[];
  level: string;
  location_preference: string;
  search_queries: string[];
}

export interface SearchResultItem {
  position?: number;
  title: string;
  snippet: string;
  url: string;
  site_name?: string;
  date?: string;
}

export interface TriagedUrl {
  url: string;
  reason: string;
}

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  status: 'ok' | 'thin' | 'failed';
  chars: number;
  cached?: boolean;
}

export type RadarStepNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type RadarEvent =
  | { type: 'step'; step: RadarStepNumber; name: string; message: string }
  | { type: 'understand'; data: UnderstandOutput }
  | { type: 'search_queries'; queries: string[]; domains: string[] }
  | { type: 'search_results'; count: number; urls: string[] }
  | { type: 'triage'; selected: TriagedUrl[] }
  | { type: 'fetch_page'; url: string; sourceName: string; status: 'reading' | 'ok' | 'thin' | 'failed'; chars?: number }
  | { type: 'sources_update'; sources: SourceStatusMap }
  | { type: 'opportunities'; items: OpportunityItem[] }
  | {
      type: 'done';
      items: OpportunityItem[];
      sources: SourceStatusMap;
      stats: {
        totalSearched: number;
        totalFetched: number;
        totalExtracted: number;
        totalValid: number;
        durationMs: number;
      };
    }
  | { type: 'error'; message: string; code?: string };
