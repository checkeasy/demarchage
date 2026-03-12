/**
 * Bulk prospect enrichment script
 *
 * Searches the web for email and LinkedIn URLs for prospects that have none.
 * Uses DuckDuckGo search + website scraping + Claude Haiku validation.
 *
 * Usage: npx tsx scripts/enrich-prospects.ts [--dry-run] [--batch-size=5] [--limit=100]
 *
 * --dry-run    : Show what would be found without updating DB
 * --batch-size : Number of prospects to process concurrently (default: 5)
 * --limit      : Max number of prospects to process (default: all)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';

// ─── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '5');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '999999');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const CONFIDENCE_THRESHOLD = 75;
const FETCH_TIMEOUT = 8000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

const LINKEDIN_URL_REGEX = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// ─── Search & Scrape Functions ──────────────────────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    $('.result').each((_, el) => {
      const titleEl = $(el).find('.result__a');
      const snippetEl = $(el).find('.result__snippet');
      const href = titleEl.attr('href') || '';
      let actualUrl = href;
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) actualUrl = decodeURIComponent(uddgMatch[1]);
      if (actualUrl) {
        results.push({ title: titleEl.text().trim(), url: actualUrl, snippet: snippetEl.text().trim() });
      }
    });
    return results.slice(0, 10);
  } catch {
    return [];
  }
}

async function scrapeWebsite(websiteUrl: string): Promise<{ linkedinUrls: string[]; emails: string[] }> {
  const linkedinUrls: string[] = [];
  const emails: string[] = [];
  try {
    let url = websiteUrl;
    if (!url.startsWith('http')) url = `https://${url}`;
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT), redirect: 'follow' });
    if (!response.ok) return { linkedinUrls, emails };
    const html = await response.text();
    const $ = cheerio.load(html);
    // LinkedIn from links
    $('a[href*="linkedin.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) { const m = href.match(LINKEDIN_URL_REGEX); if (m) linkedinUrls.push(...m); }
    });
    // LinkedIn from page text
    const textMatches = $.html().match(LINKEDIN_URL_REGEX);
    if (textMatches) linkedinUrls.push(...textMatches);
    // Emails from body
    const bodyEmails = $('body').text().match(EMAIL_REGEX);
    if (bodyEmails) emails.push(...bodyEmails.filter(e => !e.includes('example.com') && !e.includes('sentry') && !e.includes('webpack')));
    // Mailto links
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) { const e = href.replace('mailto:', '').split('?')[0]; if (e.includes('@')) emails.push(e); }
    });
    // Contact pages
    const baseDomain = new URL(url).origin;
    for (const page of ['/contact', '/about', '/equipe', '/a-propos']) {
      try {
        const r = await fetch(`${baseDomain}${page}`, { headers: HEADERS, signal: AbortSignal.timeout(5000), redirect: 'follow' });
        if (r.ok) {
          const h = await r.text();
          const lm = h.match(LINKEDIN_URL_REGEX); if (lm) linkedinUrls.push(...lm);
          const em = h.match(EMAIL_REGEX); if (em) emails.push(...em.filter(e => !e.includes('example.com') && !e.includes('sentry')));
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return { linkedinUrls: [...new Set(linkedinUrls)], emails: [...new Set(emails)] };
}

function extractDomain(input: string): string {
  try {
    let url = input;
    if (!url.startsWith('http')) url = `https://${url}`;
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return input.replace(/\s+/g, '').toLowerCase();
  }
}

// ─── AI Validation ──────────────────────────────────────────────────────────

async function validateWithAI(
  prospect: { firstName?: string | null; lastName?: string | null; company?: string | null; jobTitle?: string | null; location?: string | null },
  candidates: { linkedinUrls: string[]; emails: string[]; searchResults: SearchResult[]; websiteContacts: { linkedinUrls: string[]; emails: string[] } }
): Promise<{ linkedin_url: string | null; linkedin_confidence: number; email: string | null; email_confidence: number; reasoning: string }> {
  const prompt = `Tu es un expert en verification de donnees de prospection B2B.
Analyse les resultats et determine si les LinkedIn et emails trouves correspondent au prospect. Confiance 90-100% = correspondance exacte nom+entreprise+poste. 70-89% = nom + entreprise probable. <70% = pas assez d'elements, NE PAS UTILISER. JAMAIS inventer.

PROSPECT :
- Nom : ${[prospect.firstName, prospect.lastName].filter(Boolean).join(' ') || 'Inconnu'}
- Entreprise : ${prospect.company || 'Inconnue'}
- Poste : ${prospect.jobTitle || 'Inconnu'}
- Localisation : ${prospect.location || 'Inconnue'}

RESULTATS WEB :
${candidates.searchResults.slice(0, 5).map((r, i) => `[${i}] ${r.title} | ${r.url} | ${r.snippet}`).join('\n')}

LINKEDIN CANDIDATS : ${candidates.linkedinUrls.join(', ') || 'Aucun'}
EMAILS CANDIDATS : ${candidates.emails.join(', ') || 'Aucun'}
EMAILS DU SITE : ${candidates.websiteContacts.emails.join(', ') || 'Aucun'}

JSON strict :
{"linkedin_url":"url_ou_null","linkedin_confidence":0,"email":"email_ou_null","email_confidence":0,"reasoning":"explication courte"}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const parsed = JSON.parse((jsonMatch[1] || text).trim());
    return {
      linkedin_url: (parsed.linkedin_confidence || 0) >= CONFIDENCE_THRESHOLD ? parsed.linkedin_url : null,
      linkedin_confidence: parsed.linkedin_confidence || 0,
      email: (parsed.email_confidence || 0) >= CONFIDENCE_THRESHOLD ? parsed.email : null,
      email_confidence: parsed.email_confidence || 0,
      reasoning: parsed.reasoning || '',
    };
  } catch (e: any) {
    return { linkedin_url: null, linkedin_confidence: 0, email: null, email_confidence: 0, reasoning: `AI error: ${e.message}` };
  }
}

// ─── Enrich Single Prospect ─────────────────────────────────────────────────

async function enrichOne(prospect: any): Promise<{ linkedin_url: string | null; email: string | null; linkedin_confidence: number; email_confidence: number; reasoning: string }> {
  const { first_name, last_name, company, job_title, city, website } = prospect;
  const nameParts = [first_name, last_name].filter(Boolean).join(' ');

  const allLinkedIn: string[] = [];
  const allEmails: string[] = [];
  const allSearchResults: SearchResult[] = [];

  // Build search queries
  const queries: string[] = [];
  if (nameParts && company) {
    queries.push(`"${nameParts}" "${company}" site:linkedin.com/in`);
    queries.push(`"${nameParts}" "${company}" email`);
  } else if (company) {
    queries.push(`"${company}" conciergerie email contact`);
    if (website) queries.push(`site:${extractDomain(website)} email contact`);
  } else if (nameParts) {
    queries.push(`"${nameParts}" ${job_title || ''} site:linkedin.com/in`);
  }

  // Run searches (max 2 to be respectful of DDG)
  const searchPromises = queries.slice(0, 2).map(q => searchDuckDuckGo(q));
  const websitePromise = website ? scrapeWebsite(website) : Promise.resolve({ linkedinUrls: [] as string[], emails: [] as string[] });

  const [searchArrays, websiteResult] = await Promise.all([Promise.all(searchPromises), websitePromise]);

  for (const results of searchArrays) {
    allSearchResults.push(...results);
    for (const r of results) {
      const lm = r.url.match(LINKEDIN_URL_REGEX); if (lm) allLinkedIn.push(...lm);
      const slm = r.snippet.match(LINKEDIN_URL_REGEX); if (slm) allLinkedIn.push(...slm);
      const em = r.snippet.match(EMAIL_REGEX); if (em) allEmails.push(...em.filter(e => !e.includes('example.')));
    }
  }

  allLinkedIn.push(...websiteResult.linkedinUrls);
  allEmails.push(...websiteResult.emails);

  const uniqueLinkedIn = [...new Set(allLinkedIn)];
  const uniqueEmails = [...new Set(allEmails)];

  // If nothing found at all, skip AI call
  if (uniqueLinkedIn.length === 0 && uniqueEmails.length === 0 && allSearchResults.length === 0) {
    return { linkedin_url: null, email: null, linkedin_confidence: 0, email_confidence: 0, reasoning: 'Aucun resultat trouve' };
  }

  // If we found emails on the website directly (no name needed for generic contact emails)
  // Still validate with AI
  return validateWithAI(
    { firstName: first_name, lastName: last_name, company, jobTitle: job_title, location: city },
    { linkedinUrls: uniqueLinkedIn, emails: uniqueEmails, searchResults: allSearchResults.slice(0, 5), websiteContacts: websiteResult }
  );
}

// ─── Fetch Prospects ────────────────────────────────────────────────────────

async function fetchProspectsToEnrich(): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('prospects')
      .select('id, first_name, last_name, email, linkedin_url, company, website, job_title, city, contact_type')
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  // Filter: no real email AND no LinkedIn, and not mauvaise_cible
  return all.filter(p => {
    const hasRealEmail = p.email && !p.email.endsWith('@crm-import.local') && !p.email.endsWith('@directory-import.local') && !p.email.endsWith('@linkedin-prospect.local');
    const hasLinkedin = !!p.linkedin_url;
    const excluded = ['mauvaise_cible', 'concurrent'].includes(p.contact_type || '');
    return !excluded && !hasRealEmail && !hasLinkedin && (p.company || p.website);
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Enrichissement des prospects ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'REEL'}`);
  console.log(`Concurrence: ${BATCH_SIZE} prospects en parallele`);
  console.log(`Limite: ${LIMIT === 999999 ? 'tous' : LIMIT}`);
  console.log('');

  let prospects = await fetchProspectsToEnrich();
  console.log(`${prospects.length} prospects a enrichir (sans email ni LinkedIn, avec entreprise ou site)`);

  if (LIMIT < prospects.length) {
    prospects = prospects.slice(0, LIMIT);
    console.log(`Limite a ${LIMIT} prospects`);
  }

  if (prospects.length === 0) {
    console.log('Rien a faire.');
    return;
  }

  let totalProcessed = 0;
  let emailsFound = 0;
  let linkedinFound = 0;
  let nothingFound = 0;
  let errors = 0;
  const startTime = Date.now();

  // Process in concurrent batches
  for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
    const batch = prospects.slice(i, i + BATCH_SIZE);
    const pct = Math.round(((i + batch.length) / prospects.length) * 100);

    const results = await Promise.allSettled(
      batch.map(async (p) => {
        try {
          const result = await enrichOne(p);
          return { prospect: p, result };
        } catch (e: any) {
          return { prospect: p, result: null, error: e.message };
        }
      })
    );

    for (const r of results) {
      totalProcessed++;
      if (r.status === 'rejected' || !(r.value as any)?.result) {
        errors++;
        continue;
      }

      const { prospect: p, result } = r.value as any;
      if (!result) { errors++; continue; }

      const foundEmail = result.email;
      const foundLinkedin = result.linkedin_url;

      if (foundEmail) emailsFound++;
      if (foundLinkedin) linkedinFound++;
      if (!foundEmail && !foundLinkedin) nothingFound++;

      // Update DB
      if (!DRY_RUN && (foundEmail || foundLinkedin)) {
        const updates: any = {};
        if (foundEmail) updates.email = foundEmail;
        if (foundLinkedin) updates.linkedin_url = foundLinkedin;

        const { error } = await supabase
          .from('prospects')
          .update(updates)
          .eq('id', p.id);

        if (error) {
          console.error(`  [!] DB error for ${p.company}: ${error.message}`);
        }
      }

      if (foundEmail || foundLinkedin) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.company || '?';
        const parts = [];
        if (foundEmail) parts.push(`email: ${foundEmail}`);
        if (foundLinkedin) parts.push(`linkedin: ${foundLinkedin}`);
        console.log(`  [+] ${name} → ${parts.join(' | ')}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const remaining = prospects.length - i - batch.length;
    const avgPerProspect = (Date.now() - startTime) / (i + batch.length);
    const eta = Math.round((remaining * avgPerProspect) / 60000);
    process.stdout.write(`  [${pct}%] ${totalProcessed}/${prospects.length} traites | ${emailsFound} emails | ${linkedinFound} linkedin | ${elapsed}s elapsed | ~${eta}min restant\r`);

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < prospects.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n\n=== RESULTATS ===');
  console.log(`Total traites: ${totalProcessed}`);
  console.log(`Emails trouves: ${emailsFound} (${(emailsFound / totalProcessed * 100).toFixed(1)}%)`);
  console.log(`LinkedIn trouves: ${linkedinFound} (${(linkedinFound / totalProcessed * 100).toFixed(1)}%)`);
  console.log(`Rien trouve: ${nothingFound}`);
  console.log(`Erreurs: ${errors}`);
  console.log(`Duree: ${((Date.now() - startTime) / 60000).toFixed(1)} minutes`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Aucune modification. Relancez sans --dry-run pour appliquer.');
  }
}

main().catch(console.error);
