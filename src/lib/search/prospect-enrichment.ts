import * as cheerio from 'cheerio';
import { getAnthropic, CLAUDE_HAIKU, extractTextContent } from '@/lib/ai/client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  linkedin_url: string | null;
  linkedin_confidence: number; // 0-100
  email: string | null;
  email_confidence: number; // 0-100
  sources: string[];
  reasoning: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LINKEDIN_URL_REGEX = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CONFIDENCE_THRESHOLD = 75; // Only save if confidence >= 75%

const FETCH_TIMEOUT = 8000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

// ─── Web Search via DuckDuckGo ──────────────────────────────────────────────

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

      // DuckDuckGo wraps URLs - extract the actual URL
      let actualUrl = href;
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        actualUrl = decodeURIComponent(uddgMatch[1]);
      }

      if (actualUrl) {
        results.push({
          title: titleEl.text().trim(),
          url: actualUrl,
          snippet: snippetEl.text().trim(),
        });
      }
    });

    return results.slice(0, 10);
  } catch (error) {
    console.error('[Enrichment] DuckDuckGo search error:', error);
    return [];
  }
}

// ─── Website Scraping ───────────────────────────────────────────────────────

async function scrapeWebsiteForContacts(websiteUrl: string): Promise<{
  linkedinUrls: string[];
  emails: string[];
}> {
  const linkedinUrls: string[] = [];
  const emails: string[] = [];

  try {
    // Normalize URL
    let url = websiteUrl;
    if (!url.startsWith('http')) url = `https://${url}`;

    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });

    if (!response.ok) return { linkedinUrls, emails };

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find LinkedIn URLs in links
    $('a[href*="linkedin.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const matches = href.match(LINKEDIN_URL_REGEX);
        if (matches) linkedinUrls.push(...matches);
      }
    });

    // Find LinkedIn URLs in page text
    const pageText = $.html();
    const textMatches = pageText.match(LINKEDIN_URL_REGEX);
    if (textMatches) linkedinUrls.push(...textMatches);

    // Find emails
    const bodyText = $('body').text();
    const emailMatches = bodyText.match(EMAIL_REGEX);
    if (emailMatches) {
      emails.push(
        ...emailMatches.filter(
          (e) => !e.includes('example.com') && !e.includes('sentry') && !e.includes('webpack')
        )
      );
    }

    // Also check mailto links
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0];
        if (email && email.includes('@')) emails.push(email);
      }
    });

    // Also try common pages for contact info
    const contactPages = ['/contact', '/about', '/team', '/equipe', '/a-propos'];
    const baseDomain = new URL(url).origin;

    for (const page of contactPages) {
      try {
        const contactRes = await fetch(`${baseDomain}${page}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(5000),
          redirect: 'follow',
        });
        if (contactRes.ok) {
          const contactHtml = await contactRes.text();
          const linkedinMatches = contactHtml.match(LINKEDIN_URL_REGEX);
          if (linkedinMatches) linkedinUrls.push(...linkedinMatches);
          const contactEmails = contactHtml.match(EMAIL_REGEX);
          if (contactEmails) {
            emails.push(
              ...contactEmails.filter(
                (e) => !e.includes('example.com') && !e.includes('sentry') && !e.includes('webpack')
              )
            );
          }
        }
      } catch {
        // Skip failed pages
      }
    }
  } catch (error) {
    console.error('[Enrichment] Website scraping error:', error);
  }

  // Deduplicate
  return {
    linkedinUrls: [...new Set(linkedinUrls)],
    emails: [...new Set(emails)],
  };
}

// ─── LinkedIn URL Verification ──────────────────────────────────────────────

async function verifyLinkedInUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: HEADERS,
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    // LinkedIn returns 200 for valid profiles, redirects for invalid ones
    return response.ok && !response.url.includes('/404');
  } catch {
    return false;
  }
}

// ─── AI Validation ──────────────────────────────────────────────────────────

async function validateWithAI(
  prospect: {
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    location?: string | null;
    existingEmail?: string | null;
    existingLinkedin?: string | null;
  },
  candidates: {
    linkedinUrls: string[];
    emails: string[];
    searchResults: SearchResult[];
    websiteContacts: { linkedinUrls: string[]; emails: string[] };
  }
): Promise<EnrichmentResult> {
  const prompt = `Tu es un expert en verification de donnees de prospection B2B.

Tu dois analyser les resultats de recherche et determiner avec CERTITUDE si les LinkedIn et emails trouves correspondent bien au prospect.

REGLES STRICTES :
- Confiance 90-100% : le profil LinkedIn correspond EXACTEMENT au nom + entreprise + poste
- Confiance 70-89% : le nom correspond et l'entreprise ou le poste semble correct
- Confiance < 70% : pas assez d'elements pour confirmer → NE PAS UTILISER
- Pour les emails : prefere les emails professionnels (domaine entreprise) aux emails generiques
- Si le prospect a deja un email ou LinkedIn, ne le remplace PAS sauf si tu es SUR que le nouveau est meilleur
- JAMAIS inventer ou deviner un email ou LinkedIn

PROSPECT :
- Prenom : ${prospect.firstName || 'Inconnu'}
- Nom : ${prospect.lastName || 'Inconnu'}
- Entreprise : ${prospect.company || 'Inconnue'}
- Poste : ${prospect.jobTitle || 'Inconnu'}
- Localisation : ${prospect.location || 'Inconnue'}
- Email actuel : ${prospect.existingEmail || 'Aucun'}
- LinkedIn actuel : ${prospect.existingLinkedin || 'Aucun'}

RESULTATS DE RECHERCHE WEB :
${candidates.searchResults.map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`).join('\n\n')}

LINKEDIN TROUVES SUR LE SITE WEB :
${candidates.websiteContacts.linkedinUrls.join('\n') || 'Aucun'}

EMAILS TROUVES SUR LE SITE WEB :
${candidates.websiteContacts.emails.join('\n') || 'Aucun'}

URLS LINKEDIN CANDIDATS (toutes sources) :
${candidates.linkedinUrls.join('\n') || 'Aucun'}

EMAILS CANDIDATS (toutes sources) :
${candidates.emails.join('\n') || 'Aucun'}

Reponds en JSON strict :
{
  "linkedin_url": "url_linkedin_la_plus_probable_ou_null",
  "linkedin_confidence": 0-100,
  "linkedin_reasoning": "explication courte",
  "email": "email_le_plus_probable_ou_null",
  "email_confidence": 0-100,
  "email_reasoning": "explication courte",
  "overall_reasoning": "resume de l'analyse"
}`;

  try {
    const response = await getAnthropic().messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 512,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = extractTextContent(response);
    let cleanJson = text.trim();
    const fenceMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) cleanJson = fenceMatch[1].trim();

    const result = JSON.parse(cleanJson);

    return {
      linkedin_url: result.linkedin_confidence >= CONFIDENCE_THRESHOLD ? result.linkedin_url : null,
      linkedin_confidence: result.linkedin_confidence || 0,
      email: result.email_confidence >= CONFIDENCE_THRESHOLD ? result.email : null,
      email_confidence: result.email_confidence || 0,
      sources: ['duckduckgo', 'website_scraping', 'ai_validation'],
      reasoning: result.overall_reasoning || '',
    };
  } catch (error) {
    console.error('[Enrichment] AI validation error:', error);
    return {
      linkedin_url: null,
      linkedin_confidence: 0,
      email: null,
      email_confidence: 0,
      sources: [],
      reasoning: 'Erreur lors de la validation IA',
    };
  }
}

// ─── Main Enrichment Function ───────────────────────────────────────────────

export async function enrichProspectFromWeb(prospect: {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  website?: string | null;
  existingEmail?: string | null;
  existingLinkedin?: string | null;
}): Promise<EnrichmentResult> {
  const { firstName, lastName, company } = prospect;

  // If we already have both email and LinkedIn, skip enrichment
  if (prospect.existingEmail && prospect.existingLinkedin) {
    return {
      linkedin_url: null,
      linkedin_confidence: 0,
      email: null,
      email_confidence: 0,
      sources: [],
      reasoning: 'Le prospect a deja un email et un LinkedIn renseignes.',
    };
  }

  const allLinkedInUrls: string[] = [];
  const allEmails: string[] = [];
  const allSearchResults: SearchResult[] = [];
  let websiteContacts = { linkedinUrls: [] as string[], emails: [] as string[] };

  // Build search queries
  const nameParts = [firstName, lastName].filter(Boolean).join(' ');
  const searchQueries: string[] = [];

  if (nameParts && company) {
    // Search for LinkedIn
    if (!prospect.existingLinkedin) {
      searchQueries.push(`"${nameParts}" "${company}" site:linkedin.com/in`);
      searchQueries.push(`"${nameParts}" "${company}" linkedin`);
    }
    // Search for email
    if (!prospect.existingEmail) {
      searchQueries.push(`"${nameParts}" "${company}" email`);
      searchQueries.push(`"${nameParts}" "@${extractDomain(prospect.website || company)}"`);
    }
  } else if (nameParts) {
    if (!prospect.existingLinkedin) {
      searchQueries.push(`"${nameParts}" ${prospect.jobTitle || ''} site:linkedin.com/in`);
    }
  }

  // Run web searches in parallel (max 3 to avoid rate limiting)
  const searchPromises = searchQueries.slice(0, 3).map((q) => searchDuckDuckGo(q));

  // Scrape company website in parallel
  const websitePromise = prospect.website
    ? scrapeWebsiteForContacts(prospect.website)
    : Promise.resolve({ linkedinUrls: [] as string[], emails: [] as string[] });

  const [searchResultsArrays, websiteResult] = await Promise.all([
    Promise.all(searchPromises),
    websitePromise,
  ]);

  websiteContacts = websiteResult;

  // Collect all results
  for (const results of searchResultsArrays) {
    allSearchResults.push(...results);
    for (const result of results) {
      const linkedinMatches = result.url.match(LINKEDIN_URL_REGEX);
      if (linkedinMatches) allLinkedInUrls.push(...linkedinMatches);
      const snippetLinkedin = result.snippet.match(LINKEDIN_URL_REGEX);
      if (snippetLinkedin) allLinkedInUrls.push(...snippetLinkedin);
      const emailMatches = result.snippet.match(EMAIL_REGEX);
      if (emailMatches) allEmails.push(...emailMatches.filter(e => !e.includes('example.')));
    }
  }

  // Add website results
  allLinkedInUrls.push(...websiteContacts.linkedinUrls);
  allEmails.push(...websiteContacts.emails);

  // Deduplicate
  const uniqueLinkedIn = [...new Set(allLinkedInUrls)];
  const uniqueEmails = [...new Set(allEmails)];

  // If nothing found, return early
  if (uniqueLinkedIn.length === 0 && uniqueEmails.length === 0 && allSearchResults.length === 0) {
    return {
      linkedin_url: null,
      linkedin_confidence: 0,
      email: null,
      email_confidence: 0,
      sources: ['duckduckgo', 'website_scraping'],
      reasoning: 'Aucun resultat pertinent trouve lors de la recherche web.',
    };
  }

  // Verify top LinkedIn URLs
  const linkedinToVerify = uniqueLinkedIn.slice(0, 3);
  const verificationResults = await Promise.all(
    linkedinToVerify.map(async (url) => ({
      url,
      valid: await verifyLinkedInUrl(url),
    }))
  );
  const verifiedLinkedIn = verificationResults.filter((r) => r.valid).map((r) => r.url);

  // AI validation for final selection
  const enrichment = await validateWithAI(prospect, {
    linkedinUrls: verifiedLinkedIn.length > 0 ? verifiedLinkedIn : uniqueLinkedIn,
    emails: uniqueEmails,
    searchResults: allSearchResults.slice(0, 8),
    websiteContacts,
  });

  return enrichment;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractDomain(input: string): string {
  try {
    let url = input;
    if (!url.startsWith('http')) url = `https://${url}`;
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return input.replace(/\s+/g, '').toLowerCase();
  }
}

export { CONFIDENCE_THRESHOLD };
