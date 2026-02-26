import * as cheerio from 'cheerio';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompanySearchResult {
  companyName: string;
  websiteUrl: string | null;
  source: 'duckduckgo' | 'domain_guess' | 'linkedin';
  confidence: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 8000;

const FRENCH_SUFFIXES = [
  'sas', 'sarl', 'sa', 'eurl', 'sci', 'sasu', 'snc', 'sca',
  'scop', 'sem', 'gie', 'ei', 'me', 'auto-entrepreneur',
  'groupe', 'group', 'france', 'paris', 'lyon', 'marseille',
  'international', 'consulting', 'services', 'solutions',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function cleanCompanyName(name: string): string {
  let cleaned = name.toLowerCase().trim();
  // Remove accents
  cleaned = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Remove common suffixes
  for (const suffix of FRENCH_SUFFIXES) {
    const regex = new RegExp(`\\b${suffix}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }
  // Clean up
  cleaned = cleaned.replace(/[^a-z0-9\s-]/g, '').trim();
  cleaned = cleaned.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

// ─── Strategy 1: DuckDuckGo Search ─────────────────────────────────────────

async function findViaDuckDuckGo(companyName: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`"${companyName}" site officiel`);
    const url = `https://html.duckduckgo.com/html/?q=${query}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract first few organic result URLs
    const results: string[] = [];
    $('a.result__a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        // DuckDuckGo wraps URLs in redirects
        const match = href.match(/uddg=([^&]+)/);
        if (match) {
          try {
            results.push(decodeURIComponent(match[1]));
          } catch {
            // ignore malformed URLs
          }
        } else if (href.startsWith('http')) {
          results.push(href);
        }
      }
    });

    // Filter out known non-company sites
    const blacklist = [
      'wikipedia.org', 'linkedin.com', 'facebook.com', 'twitter.com',
      'youtube.com', 'instagram.com', 'societe.com', 'pappers.fr',
      'verif.com', 'infogreffe.fr', 'pagesjaunes.fr', 'indeed.com',
      'glassdoor.', 'tiktok.com',
    ];

    for (const result of results.slice(0, 5)) {
      const domain = new URL(result).hostname.replace('www.', '');
      const isBlacklisted = blacklist.some((b) => domain.includes(b));
      if (!isBlacklisted) {
        return result;
      }
    }

    return null;
  } catch (err) {
    console.error('[CompanyFinder] DuckDuckGo error:', err);
    return null;
  }
}

// ─── Strategy 2: Domain Guessing ────────────────────────────────────────────

async function findViaDomainGuess(companyName: string): Promise<string | null> {
  const slug = cleanCompanyName(companyName);
  if (!slug) return null;

  // Also try without hyphens
  const slugNoHyphen = slug.replace(/-/g, '');

  const candidates = [
    `${slug}.fr`,
    `${slug}.com`,
    `${slugNoHyphen}.fr`,
    `${slugNoHyphen}.com`,
    `${slug}.eu`,
  ];

  for (const domain of candidates) {
    try {
      const res = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(4000),
        redirect: 'follow',
      });
      if (res.ok || res.status === 301 || res.status === 302) {
        return `https://${domain}`;
      }
    } catch {
      // Domain doesn't exist or timeout
    }
  }

  return null;
}

// ─── Main Orchestrator ──────────────────────────────────────────────────────

export async function findCompanyWebsite(
  companyName: string
): Promise<CompanySearchResult> {
  if (!companyName || companyName.trim().length === 0) {
    return { companyName, websiteUrl: null, source: 'duckduckgo', confidence: 0 };
  }

  // Strategy 1: DuckDuckGo
  console.log(`[CompanyFinder] Searching DuckDuckGo for "${companyName}"...`);
  const ddgResult = await findViaDuckDuckGo(companyName);
  if (ddgResult && isValidUrl(ddgResult)) {
    return {
      companyName,
      websiteUrl: ddgResult,
      source: 'duckduckgo',
      confidence: 0.8,
    };
  }

  await sleep(1000);

  // Strategy 2: Domain guessing
  console.log(`[CompanyFinder] Trying domain guessing for "${companyName}"...`);
  const domainResult = await findViaDomainGuess(companyName);
  if (domainResult) {
    return {
      companyName,
      websiteUrl: domainResult,
      source: 'domain_guess',
      confidence: 0.6,
    };
  }

  // Nothing found
  return { companyName, websiteUrl: null, source: 'duckduckgo', confidence: 0 };
}
