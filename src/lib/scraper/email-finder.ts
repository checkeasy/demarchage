import * as cheerio from 'cheerio';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FoundEmail {
  email: string;
  source: 'page_crawl' | 'google_dork' | 'mailto';
  pageUrl: string;
  score: number;
  category: 'personal' | 'role' | 'generic';
}

export interface EmailFinderResult {
  domain: string;
  emails: FoundEmail[];
  pagesScraped: number;
  totalEmailsFound: number;
  uniqueEmailsFound: number;
  scrapedAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 10000;
const CRAWL_DELAY_MS = 800;
const MAX_PAGES = 10;

const CONTACT_PATHS = [
  '/', '/contact', '/contact-us', '/contactez-nous', '/nous-contacter',
  '/about', '/about-us', '/a-propos', '/qui-sommes-nous',
  '/team', '/equipe', '/notre-equipe',
  '/mentions-legales', '/legal', '/legals',
  '/impressum', '/imprint',
];

const GENERIC_PREFIXES = [
  'info', 'contact', 'hello', 'support', 'admin', 'webmaster',
  'noreply', 'no-reply', 'communication', 'accueil', 'bonjour',
  'bienvenue', 'postmaster', 'abuse', 'root', 'mailer-daemon',
];

const ROLE_PREFIXES = [
  'direction', 'compta', 'comptabilite', 'rh', 'commercial',
  'vente', 'ventes', 'marketing', 'technique', 'service',
  'secretariat', 'facturation', 'devis', 'commande', 'commandes',
  'recrutement', 'formation', 'juridique', 'presse',
];

const BLACKLISTED_DOMAINS = [
  'example.com', 'sentry.io', 'wixpress.com', 'googleapis.com',
  'w3.org', 'schema.org', 'gravatar.com', 'wordpress.org',
  'wp.com', 'cloudflare.com', 'placeholder.com',
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function isValidEmail(email: string): boolean {
  if (email.length > 100) return false;
  if (email.includes('..')) return false;
  // Filter out image-like patterns
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)$/i.test(email)) return false;
  // Filter out version numbers like image@2x
  if (/@\dx/i.test(email)) return false;
  // Filter out blacklisted domains
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  if (BLACKLISTED_DOMAINS.some((b) => domain.includes(b))) return false;
  // Domain must end with a valid TLD (2-6 chars only) — rejects "company.froffre"
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2 || tld.length > 6) return false;
  // Domain part before TLD shouldn't be too short
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;
  // Reject emails where the local part starts with a number followed by 'h.' (time patterns)
  const localPart = email.split('@')[0];
  if (/^\d+h\./.test(localPart)) return false;
  // Reject if local part contains suspicious concatenated words (3+ consonants in sequence after the dot in domain)
  if (/[a-z]@[a-z]+\.[a-z]{7,}$/i.test(email)) return false;
  return true;
}

// ─── Email Scoring ──────────────────────────────────────────────────────────

function scoreEmail(
  email: string,
  domain: string,
  companyName?: string,
  contactName?: string
): { score: number; category: 'personal' | 'role' | 'generic' } {
  const prefix = email.split('@')[0].toLowerCase();
  const emailDomain = email.split('@')[1]?.toLowerCase();

  // Bonus if email domain matches the company domain
  const domainMatch = emailDomain === domain || emailDomain === `www.${domain}`;
  const domainBonus = domainMatch ? 10 : -20;

  // Check if contact name matches the email
  if (contactName) {
    const nameParts = contactName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter((p) => p.length > 2);

    const matchCount = nameParts.filter((part) => prefix.includes(part)).length;
    if (matchCount >= 2) {
      return { score: Math.min(95 + domainBonus, 100), category: 'personal' };
    }
    if (matchCount >= 1) {
      return { score: Math.min(80 + domainBonus, 100), category: 'personal' };
    }
  }

  // Generic
  if (GENERIC_PREFIXES.some((g) => prefix === g || prefix.startsWith(g + '.'))) {
    return { score: Math.max(15 + domainBonus, 5), category: 'generic' };
  }

  // Role-based
  if (ROLE_PREFIXES.some((r) => prefix === r || prefix.startsWith(r + '.'))) {
    return { score: Math.max(45 + domainBonus, 10), category: 'role' };
  }

  // Personal pattern detection (firstname.lastname, f.lastname, etc.)
  if (/^[a-z]+[.\-_][a-z]+$/.test(prefix) || /^[a-z]{2,}\.[a-z]{2,}$/.test(prefix)) {
    return { score: Math.max(70 + domainBonus, 20), category: 'personal' };
  }

  // Single name
  if (/^[a-z]{3,}$/.test(prefix) && !GENERIC_PREFIXES.includes(prefix)) {
    return { score: Math.max(50 + domainBonus, 15), category: 'personal' };
  }

  // Default
  return { score: Math.max(30 + domainBonus, 5), category: 'generic' };
}

// ─── Page Crawler ───────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}

function extractEmailsFromHtml(html: string, pageUrl: string): FoundEmail[] {
  const $ = cheerio.load(html);
  const emails = new Set<string>();
  const results: FoundEmail[] = [];

  // 1. Extract from mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && isValidEmail(email) && !emails.has(email)) {
        emails.add(email);
        results.push({
          email,
          source: 'mailto',
          pageUrl,
          score: 0,
          category: 'generic',
        });
      }
    }
  });

  // 2. Extract from text content
  const textContent = ($ as unknown as { text: () => string }).text();
  const matches = textContent.match(EMAIL_REGEX) || [];
  for (const match of matches) {
    const email = match.toLowerCase();
    if (isValidEmail(email) && !emails.has(email)) {
      emails.add(email);
      results.push({
        email,
        source: 'page_crawl',
        pageUrl,
        score: 0,
        category: 'generic',
      });
    }
  }

  // 3. Also check meta content, titles, etc.
  $('meta[content]').each((_, el) => {
    const content = $(el).attr('content') || '';
    const metaEmails = content.match(EMAIL_REGEX) || [];
    for (const match of metaEmails) {
      const email = match.toLowerCase();
      if (isValidEmail(email) && !emails.has(email)) {
        emails.add(email);
        results.push({
          email,
          source: 'page_crawl',
          pageUrl,
          score: 0,
          category: 'generic',
        });
      }
    }
  });

  return results;
}

async function crawlKeyPages(
  baseUrl: string
): Promise<{ pagesScraped: number; emails: FoundEmail[] }> {
  const base = new URL(baseUrl);
  const origin = base.origin;
  const allEmails: FoundEmail[] = [];
  let pagesScraped = 0;

  for (const path of CONTACT_PATHS.slice(0, MAX_PAGES)) {
    const pageUrl = `${origin}${path}`;
    const html = await fetchPage(pageUrl);
    if (html) {
      pagesScraped++;
      const emails = extractEmailsFromHtml(html, pageUrl);
      allEmails.push(...emails);
    }

    await sleep(CRAWL_DELAY_MS);
  }

  return { pagesScraped, emails: allEmails };
}

// ─── Google Dorking via DuckDuckGo ──────────────────────────────────────────

async function googleDork(domain: string): Promise<FoundEmail[]> {
  try {
    const query = encodeURIComponent(`site:${domain} "@${domain}"`);
    const url = `https://html.duckduckgo.com/html/?q=${query}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const emails: FoundEmail[] = [];
    const seen = new Set<string>();

    // Extract emails from search result snippets
    $('.result__snippet, .result__title').each((_, el) => {
      const text = $(el).text();
      const matches = text.match(EMAIL_REGEX) || [];
      for (const match of matches) {
        const email = match.toLowerCase();
        if (isValidEmail(email) && !seen.has(email) && email.endsWith(`@${domain}`)) {
          seen.add(email);
          emails.push({
            email,
            source: 'google_dork',
            pageUrl: 'duckduckgo search',
            score: 0,
            category: 'generic',
          });
        }
      }
    });

    return emails;
  } catch (err) {
    console.error('[EmailFinder] DuckDuckGo dork error:', err);
    return [];
  }
}

// ─── Main Orchestrator ──────────────────────────────────────────────────────

export async function findEmailsForDomain(
  websiteUrl: string,
  companyName?: string,
  contactName?: string
): Promise<EmailFinderResult> {
  const domain = extractDomain(websiteUrl);

  // 1. Crawl key pages
  const crawlResult = await crawlKeyPages(websiteUrl);

  // 2. Google dorking
  await sleep(1500);
  const dorkEmails = await googleDork(domain);

  // 3. Combine all emails
  const allEmails = [...crawlResult.emails, ...dorkEmails];

  // 4. Score and deduplicate
  const emailMap = new Map<string, FoundEmail>();

  for (const found of allEmails) {
    const scored = scoreEmail(found.email, domain, companyName, contactName);
    found.score = scored.score;
    found.category = scored.category;

    const existing = emailMap.get(found.email);
    if (!existing || found.score > existing.score) {
      emailMap.set(found.email, found);
    }
  }

  // Sort by score descending
  const uniqueEmails = Array.from(emailMap.values()).sort((a, b) => b.score - a.score);

  return {
    domain,
    emails: uniqueEmails,
    pagesScraped: crawlResult.pagesScraped,
    totalEmailsFound: allEmails.length,
    uniqueEmailsFound: uniqueEmails.length,
    scrapedAt: new Date().toISOString(),
  };
}
