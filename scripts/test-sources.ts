import fs from 'fs';
import path from 'path';

// Helper to load .env.local if present
function loadEnvLocal() {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        // Remove surrounding quotes if any
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvLocal();

interface SourceEntry {
  name: string;
  url: string;
  domain: string;
  category: string;
  jsHeavy?: boolean;
}

const SOURCES: SourceEntry[] = [
  // Internships
  { name: 'Internshala', url: 'https://internshala.com/internships/', domain: 'internshala.com', category: 'Internships' },
  { name: 'AICTE Internship Portal', url: 'https://internship.aicte-india.org/internships', domain: 'internship.aicte-india.org', category: 'Internships' },
  { name: 'PM Internship Scheme', url: 'https://pminternship.mca.gov.in', domain: 'pminternship.mca.gov.in', category: 'Internships' },

  // Hackathons
  { name: 'Devfolio', url: 'https://devfolio.co/hackathons', domain: 'devfolio.co', category: 'Hackathons' },
  { name: 'Hack2skill', url: 'https://hack2skill.com/hackathons-listing', domain: 'hack2skill.com', category: 'Hackathons', jsHeavy: true },
  { name: 'HackCulture', url: 'https://www.hackculture.io', domain: 'hackculture.io', category: 'Hackathons' },
  { name: 'MLH', url: 'https://www.mlh.com/events', domain: 'mlh.com', category: 'Hackathons' },
  { name: 'lablab.ai', url: 'https://lablab.ai/ai-hackathons', domain: 'lablab.ai', category: 'Hackathons' },
  { name: 'DoraHacks', url: 'https://dorahacks.io/hackathon', domain: 'dorahacks.io', category: 'Hackathons', jsHeavy: true },

  // Competitions
  { name: 'Unstop', url: 'https://unstop.com/competitions', domain: 'unstop.com', category: 'Competitions', jsHeavy: true },
  { name: 'Kaggle', url: 'https://www.kaggle.com/competitions', domain: 'kaggle.com', category: 'Competitions', jsHeavy: true },
  { name: 'MyGov Innovate India', url: 'https://innovateindia.mygov.in/', domain: 'innovateindia.mygov.in', category: 'Competitions' },

  // Scholarships
  { name: 'Buddy4Study', url: 'https://www.buddy4study.com/online-application-form', domain: 'buddy4study.com', category: 'Scholarships', jsHeavy: true },
  { name: 'National Scholarship Portal', url: 'https://scholarships.gov.in/Students', domain: 'scholarships.gov.in', category: 'Scholarships' },
  { name: 'DAAD India', url: 'https://www.daad.in/en/find-funding/scholarship-database/', domain: 'daad.in', category: 'Scholarships' },

  // Fellowships
  { name: 'IASc Summer Research Fellowship', url: 'https://webjapps.ias.ac.in/fellowship2027/index.html', domain: 'ias.ac.in', category: 'Fellowships' },
  { name: 'Teach For India', url: 'https://teachforindia.org/how-to-be-a-fellow', domain: 'teachforindia.org', category: 'Fellowships' },

  // Open Source
  { name: 'Google Summer of Code', url: 'https://developers.google.com/open-source/gsoc/timeline', domain: 'developers.google.com', category: 'Open Source' },
  { name: 'GirlScript Summer of Code', url: 'https://gssoc.girlscript.org', domain: 'gssoc.girlscript.org', category: 'Open Source' },
  { name: 'Outreachy', url: 'https://www.outreachy.org/apply/project-selection/', domain: 'outreachy.org', category: 'Open Source' },
];

async function runTest() {
  console.log('========================================================================');
  console.log('  OPPORTUNITY RADAR — TINYFISH SOURCE VERIFICATION TEST');
  console.log('========================================================================');

  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.error('ERROR: TINYFISH_API_KEY is not set.');
    console.error('Please add your key to .env.local:');
    console.error('  TINYFISH_API_KEY=your_key_here');
    console.error('Then run: npm run test:sources\n');
    process.exit(1);
  }

  console.log(`Testing all ${SOURCES.length} trusted sources via TinyFish Fetch API (POST https://api.fetch.tinyfish.ai)...\n`);

  // Batch URLs in chunks of 10
  const BATCH_SIZE = 10;
  const urlToSource = new Map<string, SourceEntry>();
  for (const s of SOURCES) {
    urlToSource.set(s.url, s);
  }

  const allUrls = SOURCES.map((s) => s.url);
  const batches: string[][] = [];
  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    batches.push(allUrls.slice(i, i + BATCH_SIZE));
  }

  interface RowResult {
    name: string;
    status: 'OK' | 'THIN' | 'FAILED';
    chars: number;
    preview: string;
    jsHeavy: boolean;
  }

  const results: RowResult[] = [];

  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    const batch = batches[bIndex];
    console.log(`[Batch ${bIndex + 1}/${batches.length}] Fetching ${batch.length} URLs...`);

    try {
      const res = await fetch('https://api.fetch.tinyfish.ai', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ urls: batch }),
        signal: AbortSignal.timeout(150000), // 150s timeout
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`Batch ${bIndex + 1} HTTP Error ${res.status}: ${errText}`);
        for (const u of batch) {
          const s = urlToSource.get(u)!;
          results.push({
            name: s.name,
            status: 'FAILED',
            chars: 0,
            preview: `HTTP ${res.status}: ${errText.slice(0, 60)}`,
            jsHeavy: !!s.jsHeavy,
          });
        }
        continue;
      }

      interface FetchResultItem {
        url?: string;
        text?: string;
      }
      const data = await res.json().catch(() => ({}));
      const returnedResults = (Array.isArray(data?.results) ? data.results : []) as FetchResultItem[];
      const resultMap = new Map<string, FetchResultItem>();
      for (const item of returnedResults) {
        if (item?.url) resultMap.set(item.url, item);
      }

      for (const u of batch) {
        const s = urlToSource.get(u)!;
        const item = resultMap.get(u);
        if (item && item.text) {
          const rawText = String(item.text).replace(/[\r\n\t]+/g, ' ').trim();
          const chars = rawText.length;
          const status = chars >= 500 ? 'OK' : 'THIN';
          const preview = rawText.slice(0, 120);
          results.push({
            name: s.name,
            status,
            chars,
            preview,
            jsHeavy: !!s.jsHeavy,
          });
        } else {
          results.push({
            name: s.name,
            status: 'FAILED',
            chars: 0,
            preview: 'No text returned / failed by fetch service',
            jsHeavy: !!s.jsHeavy,
          });
        }
      }
    } catch (err: unknown) {
      console.error(`Batch ${bIndex + 1} network exception:`, err);
      for (const u of batch) {
        const s = urlToSource.get(u)!;
        results.push({
          name: s.name,
          status: 'FAILED',
          chars: 0,
          preview: `Fetch error: ${err instanceof Error ? err.message : String(err)}`,
          jsHeavy: !!s.jsHeavy,
        });
      }
    }
  }

  // Print results table
  console.log('\n========================================================================================================================');
  console.log(
    'NAME'.padEnd(34) +
      'STATUS'.padEnd(10) +
      'CHARS'.padEnd(10) +
      'FIRST 120 CHARACTERS PREVIEW'
  );
  console.log('------------------------------------------------------------------------------------------------------------------------');

  let okCount = 0;
  let thinCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.status === 'OK') okCount++;
    else if (r.status === 'THIN') thinCount++;
    else failedCount++;

    const statusStr =
      r.status === 'OK'
        ? '\x1b[32mOK\x1b[0m'
        : r.status === 'THIN'
        ? '\x1b[33mTHIN\x1b[0m'
        : '\x1b[31mFAILED\x1b[0m';

    const flagStr = r.jsHeavy ? ' (jsHeavy)' : '';
    const nameCol = (r.name + flagStr).padEnd(34);
    const charsCol = String(r.chars).padEnd(10);
    const previewCol = r.preview.length > 70 ? r.preview.slice(0, 70) + '...' : r.preview;

    console.log(`${nameCol}${statusStr.padEnd(19)}${charsCol}${previewCol}`);
  }

  console.log('========================================================================================================================');
  console.log(`SUMMARY: Tested ${results.length} sources`);
  console.log(`✓ OK (>= 500 chars):     ${okCount}`);
  console.log(`⚠ THIN (< 500 chars):    ${thinCount} (Note: jsHeavy sources may benefit from TinyFish Agent API)`);
  console.log(`✕ FAILED (errors/0 char): ${failedCount}`);
  console.log('========================================================================================================================\n');
}

runTest().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
