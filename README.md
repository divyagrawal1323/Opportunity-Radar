# Opportunity Radar 📡

> **Live opportunities from 20 trusted sources, matched to Indian college students.**

Opportunity Radar scans, verifies, and matches **currently open** internships, hackathons, competitions, scholarships, fellowships, and open-source programs using real-time live web extraction powered by the **TinyFish Search & Fetch APIs** and **Google Gemini 2.5 Flash**.

---

## What It Does

- **Understands the Student (Step 1)**: Analyzes your target opportunity type and background (course, college year, tech stack, location preference) with Gemini to extract targeted keywords and generate 5 live search queries.
- **Gathers Live Opportunities (Step 2)**: Runs parallel TinyFish searches across India's top student directories and the open web (with social media sites strictly excluded), plus crawls category listing hubs (e.g. Internshala keyword slugs).
- **Triages Search Results (Step 3)**: Filters out clickbait, listicles ("top 10", "how to"), blogs, tutorials, and past results to select up to 8 of the most promising opportunity portals.
- **Live Text Extraction (Step 4)**: Fetches page contents using TinyFish Fetch (up to 10 URLs per batch) with an in-memory 30-minute cache and real-time status reporting (`OK`, `THIN`, `FAILED`).
- **AI Opportunity Extraction (Step 5)**: Uses Gemini in parallel (max 4 concurrency) to extract only *real, active, or upcoming* programs with eligibility, stipend/prize pools, direct application links, evidence quotes, and a 1-10 fit score tailored to your profile.
- **Code-Level Validation & Ranking (Step 6)**: Drops all past/expired deadlines (never serves stale fallbacks), normalizes and deduplicates by organization + title, and ranks by fit score and nearest closing date.
- **Rich Interactive UI**: Features dark/light mode, live Server-Sent Events (SSE) stepper, live page reading feedback pills, category filters, a "Closing soon (≤ 7 days)" toggle, and a collapsible Sources Health panel for all 20 verified portals.

---

## Setup in 4 Steps

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment Keys in `.env.local`

Create or edit `.env.local` in the project root:

```env
# TinyFish API Key (Required for Search & Fetch)
# Obtain from: https://agent.tinyfish.ai/api-keys
TINYFISH_API_KEY=your_tinyfish_api_key_here

# Google Gemini API Key (Required for AI Analysis & Extraction)
# Obtain from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Gemini Model (defaults to gemini-2.5-flash)
GEMINI_MODEL=gemini-2.5-flash
```

*(You can also reference `.env.example`)*

### Step 3: Verify Trusted Sources

Run the source diagnostic script to test live connectivity across all 20 trusted student directories:

```bash
npm run test:sources
```

This outputs a clean table displaying the HTTP status, characters fetched, and a 120-character preview for every source.

### Step 4: Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 20 Trusted Sources Configured

| Category | Source Name | URL / Portal | JS Heavy? |
| :--- | :--- | :--- | :---: |
| **Internships** | Internshala | `https://internshala.com/internships/` | No |
| **Internships** | AICTE Internship Portal | `https://internship.aicte-india.org/internships` | No |
| **Internships** | PM Internship Scheme | `https://pminternship.mca.gov.in` | No |
| **Hackathons** | Devfolio | `https://devfolio.co/hackathons` | No |
| **Hackathons** | Hack2skill | `https://hack2skill.com/hackathons-listing` | Yes |
| **Hackathons** | HackCulture | `https://www.hackculture.io` | No |
| **Hackathons** | MLH (Major League Hacking) | `https://www.mlh.com/events` | No |
| **Hackathons** | lablab.ai | `https://lablab.ai/ai-hackathons` | No |
| **Hackathons** | DoraHacks | `https://dorahacks.io/hackathon` | Yes |
| **Competitions** | Unstop | `https://unstop.com/competitions` | Yes |
| **Competitions** | Kaggle | `https://www.kaggle.com/competitions` | Yes |
| **Competitions** | MyGov Innovate India | `https://innovateindia.mygov.in/` | No |
| **Scholarships** | Buddy4Study | `https://www.buddy4study.com/online-application-form` | Yes |
| **Scholarships** | National Scholarship Portal | `https://scholarships.gov.in/Students` | No |
| **Scholarships** | DAAD India | `https://www.daad.in/en/find-funding/scholarship-database/` | No |
| **Fellowships** | IASc Summer Research Fellowship | `https://webjapps.ias.ac.in/fellowship2027/index.html` | No |
| **Fellowships** | Teach For India | `https://teachforindia.org/how-to-be-a-fellow` | No |
| **Open Source** | Google Summer of Code (GSoC) | `https://developers.google.com/open-source/gsoc/timeline` | No |
| **Open Source** | GirlScript Summer of Code (GSSoC) | `https://gssoc.girlscript.org` | No |
| **Open Source** | Outreachy | `https://www.outreachy.org/apply/project-selection/` | No |

---

## How to Add or Remove Sources

All trusted sources are centrally managed in [`/src/config/sources.ts`](./src/config/sources.ts) (also accessible via `/config/sources.ts`):

To add a new portal, append an object to `TRUSTED_SOURCES`:

```typescript
{
  name: 'Flipkart GRiD',
  url: 'https://unstop.com/competitions/flipkart-grid-60',
  domain: 'unstop.com',
  category: 'Competitions',
  jsHeavy: true,
}
```

To remove or update an existing portal, edit or delete its entry from the array. The UI and backend automatically adapt.

---

## Note on `jsHeavy` Sources & Future TinyFish Agent API

Some portals (such as **Unstop**, **Hack2skill**, **DoraHacks**, **Kaggle**, and **Buddy4Study**) are built as client-rendered Single Page Applications (SPAs).
When scraped via traditional static fetch methods, these URLs may return thin HTML or hydration shells (`< 500 characters`).

- In the current version, Opportunity Radar flags these sources with `jsHeavy: true`, tracks thin returns gracefully, and leverages TinyFish Search to discover direct sub-pages that contain server-rendered content.
- In a future update, these `jsHeavy` sources are prime candidates for the **TinyFish Agent API** (`POST https://agent.tinyfish.ai/v1/automation/run-sse`), which launches a headless browser to render dynamic JavaScript, solve interactions, and extract deep SPA listings.

---

## API Architecture & Reliability

- **Server-Side Security**: All Gemini and TinyFish API keys are stored in `.env.local` and accessed strictly within server-side API routes (`/api/radar`). Keys never touch the client browser.
- **Concurrency Limiter**: TinyFish API requests are throttled through a strict concurrency limiter (max 4 parallel calls) and a sliding window rate limiter (max 30 requests/minute).
- **Auto-Retry**: If a `429 Too Many Requests` is encountered, requests automatically back off and retry once after 3 seconds.
- **In-Memory Cache**: All fetched web pages are cached in memory for 30 minutes, preventing duplicate fetches and conserving API credits.
- **User-Friendly Error Handling**: Friendly error messages replace raw technical stack traces:
  - `401` ➔ *"Your API key looks wrong"*
  - `429` ➔ *"Too many requests, wait a minute"*
  - `402` ➔ *"Daily free limit reached"*
  - Network failure ➔ *"Couldn't reach TinyFish"*

---

## License

MIT
