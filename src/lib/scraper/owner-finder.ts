import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_OWNER_FINDER } from '@/lib/ai/prompts';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OwnerFinderResult {
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerRole: string | null;
  confidence: number;
  evidence: string | null;
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

const OPENAI_MODEL = 'gpt-5-mini-2025-08-07';

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
      console.log(`[OwnerFinder] Crawling ${pageUrl}...`);

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
      console.log('[OwnerFinder] No content found on any page');
      return defaultResult;
    }

    // Combine all text (limit total)
    const combinedText = allTexts.join('\n\n').slice(0, 15000);

    // Call AI to extract owner name
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: SYSTEM_PROMPT_OWNER_FINDER },
        {
          role: 'user',
          content: `Entreprise : "${businessName}"\nSite web : ${websiteUrl}\n\nContenu scrape des pages du site :\n\n${combinedText}`,
        },
      ],
      text: {
        format: { type: 'json_object' },
      },
    });

    // Parse AI response - handle the response object format
    let responseText = '';
    if (response.output && Array.isArray(response.output)) {
      for (const item of response.output) {
        if (item.type === 'message' && item.content) {
          for (const block of item.content) {
            if (block.type === 'output_text') {
              responseText = block.text;
            }
          }
        }
      }
    }

    if (!responseText) {
      console.error('[OwnerFinder] No text in AI response');
      return defaultResult;
    }

    const parsed = JSON.parse(responseText);

    return {
      ownerFirstName: parsed.owner_first_name || null,
      ownerLastName: parsed.owner_last_name || null,
      ownerRole: parsed.owner_role || null,
      confidence: parsed.confidence || 0,
      evidence: parsed.evidence || null,
    };
  } catch (err) {
    console.error('[OwnerFinder] Error:', err);
    return defaultResult;
  }
}
