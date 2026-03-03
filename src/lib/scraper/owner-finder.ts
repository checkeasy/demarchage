import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT_OWNER_FINDER } from '@/lib/ai/prompts';
import { getLinkedInClient, LinkedInError } from '@/lib/linkedin';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OwnerFinderResult {
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerRole: string | null;
  confidence: number;
  evidence: string | null;
  linkedinUrl: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 10000;
const CRAWL_DELAY_MS = 800;
const MAX_CONTENT_LENGTH = 8000;

const OWNER_PAGES = [
  '/a-propos', '/about', '/about-us', '/qui-sommes-nous',
  '/equipe', '/team', '/notre-equipe', '/our-team',
  '/mentions-legales', '/legal', '/mentions-legale',
  '/cgv', '/cgu',
  '/',
];

const CLAUDE_MODEL = 'claude-opus-4-6';

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function extractTextContent(html: string): string {
  const $ = cheerio.load(html);
  // Remove scripts, styles, nav, footer
  $('script, style, nav, footer, header, noscript, iframe').remove();

  // Get text from main content areas
  const mainContent = $('main, article, .content, .about, .team, #content, #main, body').text();
  // Clean up whitespace
  return mainContent
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
    .slice(0, MAX_CONTENT_LENGTH);
}

// ─── Main Function ──────────────────────────────────────────────────────────

export async function findOwner(
  websiteUrl: string,
  businessName: string
): Promise<OwnerFinderResult> {
  const defaultResult: OwnerFinderResult = {
    ownerFirstName: null,
    ownerLastName: null,
    ownerRole: null,
    confidence: 0,
    evidence: null,
    linkedinUrl: null,
  };

  if (!websiteUrl) return defaultResult;

  try {
    const base = new URL(websiteUrl);
    const origin = base.origin;
    const allTexts: string[] = [];

    // Crawl relevant pages
    let pagesFound = 0;
    for (const path of OWNER_PAGES) {
      if (pagesFound >= 5) break; // Limit to 5 pages

      const pageUrl = `${origin}${path}`;
      const html = await fetchPage(pageUrl);
      if (html) {
        const text = extractTextContent(html);
        if (text.length > 50) {
          allTexts.push(`--- Page: ${path} ---\n${text}`);
          pagesFound++;
        }
      }

      await sleep(CRAWL_DELAY_MS);
    }

    if (allTexts.length === 0) {
      return defaultResult;
    }

    // Combine all text (limit total)
    const combinedText = allTexts.join('\n\n').slice(0, 15000);

    // Call AI to extract owner name
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      system: SYSTEM_PROMPT_OWNER_FINDER,
      messages: [
        {
          role: 'user',
          content: `Entreprise : "${businessName}"\nSite web : ${websiteUrl}\n\nContenu scrape des pages du site :\n\n${combinedText}`,
        },
      ],
      max_tokens: 1024,
    });

    const responseText =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    if (!responseText) {
      console.error('[OwnerFinder] No text in AI response');
      return defaultResult;
    }

    const parsed = JSON.parse(responseText);

    const ownerFirstName: string | null = parsed.owner_first_name || null;
    const ownerLastName: string | null = parsed.owner_last_name || null;
    const ownerRole: string | null = parsed.owner_role || null;
    const confidence: number = parsed.confidence || 0;
    const evidence: string | null = parsed.evidence || null;

    // Step 2: Search LinkedIn for the owner profile
    let linkedinUrl: string | null = null;

    if (ownerFirstName && ownerLastName) {
      try {
        const linkedinClient = getLinkedInClient();
        const searchResponse = await linkedinClient.searchPeople({
          keywords: `${ownerFirstName} ${ownerLastName} ${businessName}`,
          count: 5,
        });

        if (searchResponse.results.length > 0) {
          // Find the best match: check if first name and last name match (case-insensitive)
          const normalizedFirst = ownerFirstName.toLowerCase().trim();
          const normalizedLast = ownerLastName.toLowerCase().trim();

          const bestMatch = searchResponse.results.find((r) => {
            const rFirst = r.firstName.toLowerCase().trim();
            const rLast = r.lastName.toLowerCase().trim();
            return rFirst === normalizedFirst && rLast === normalizedLast;
          });

          if (bestMatch) {
            linkedinUrl = bestMatch.profileUrl;
          } else {
          }
        } else {
        }
      } catch (err) {
        // Don't fail the whole enrichment if LinkedIn search fails
        if (err instanceof LinkedInError) {
          console.warn(`[OwnerFinder] LinkedIn search failed: ${err.message}`);
        } else {
          console.warn('[OwnerFinder] LinkedIn search error:', err);
        }
      }
    }

    return {
      ownerFirstName,
      ownerLastName,
      ownerRole,
      confidence,
      evidence,
      linkedinUrl,
    };
  } catch (err) {
    console.error('[OwnerFinder] Error:', err);
    return defaultResult;
  }
}
