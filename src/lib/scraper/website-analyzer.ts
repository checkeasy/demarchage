import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT_WEBSITE } from '@/lib/ai/prompts';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScrapedWebsiteData {
  url: string;
  title: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  h1Headings: string[];
  h2Headings: string[];
  mainContentText: string;
  techStackIndicators: string[];
  socialLinks: SocialLinks;
  contactInfo: ContactInfo;
  language: string | null;
  fetchedAt: string;
  statusCode: number;
}

export interface SocialLinks {
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  other: string[];
}

export interface ContactInfo {
  emails: string[];
  phones: string[];
  address: string | null;
}

export interface WebsiteAnalysis {
  scrapedData: ScrapedWebsiteData;
  aiAnalysis: {
    company_description: string;
    products_services: string[];
    industry: {
      primary: string;
      secondary: string[];
    };
    pain_points: Array<{
      pain_point: string;
      severity: 'high' | 'medium' | 'low';
      solution: string;
    }>;
    relevance: {
      score: number;
      use_cases: string[];
      potential_roi: string;
    };
    company_info: {
      estimated_size: string;
      digital_maturity: string;
      target_decision_makers: string[];
    };
  };
}

export interface EnrichedProspect {
  originalData: Record<string, unknown>;
  websiteAnalysis: WebsiteAnalysis | null;
  enrichedAt: string;
  enrichmentSource: string[];
}

// ─── Anthropic Client (lazy to avoid crash during next build) ────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// ─── Constants ──────────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FETCH_TIMEOUT = 15000; // 15 seconds

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  linkedin: /linkedin\.com/i,
  twitter: /(?:twitter\.com|x\.com)/i,
  facebook: /facebook\.com/i,
  instagram: /instagram\.com/i,
  youtube: /youtube\.com/i,
};

const TECH_INDICATORS: Record<string, RegExp> = {
  WordPress: /wp-content|wp-includes|wordpress/i,
  Shopify: /cdn\.shopify\.com|shopify/i,
  React: /react|__next|_next/i,
  Vue: /vue\.js|vuejs/i,
  Angular: /angular/i,
  Bootstrap: /bootstrap/i,
  Tailwind: /tailwindcss|tailwind/i,
  jQuery: /jquery/i,
  'Google Analytics': /google-analytics|gtag|ga\.js/i,
  'Google Tag Manager': /googletagmanager/i,
  HubSpot: /hubspot/i,
  Intercom: /intercom/i,
  Crisp: /crisp\.chat/i,
  Stripe: /stripe\.com|js\.stripe/i,
  Matomo: /matomo|piwik/i,
};

// ─── Scraping Functions ─────────────────────────────────────────────────────

/**
 * Scrape a website and extract structured data
 */
export async function scrapeWebsite(url: string): Promise<ScrapedWebsiteData> {
  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style elements for cleaner text extraction
    $('script, style, noscript, iframe').remove();

    // Extract structured data
    const title = $('title').first().text().trim() || null;
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() || null;
    const metaKeywords =
      $('meta[name="keywords"]').attr('content')?.trim() || null;
    const ogTitle =
      $('meta[property="og:title"]').attr('content')?.trim() || null;
    const ogDescription =
      $('meta[property="og:description"]').attr('content')?.trim() || null;
    const ogImage =
      $('meta[property="og:image"]').attr('content')?.trim() || null;
    const language =
      $('html').attr('lang')?.trim() ||
      $('meta[http-equiv="content-language"]').attr('content')?.trim() ||
      null;

    // Extract headings
    const h1Headings: string[] = [];
    $('h1').each((_: number, el: cheerio.Element) => {
      const text = $(el).text().trim();
      if (text) h1Headings.push(text);
    });

    const h2Headings: string[] = [];
    $('h2').each((_: number, el: cheerio.Element) => {
      const text = $(el).text().trim();
      if (text) h2Headings.push(text);
    });

    // Extract main content text (limited to avoid token overflow)
    const mainContent = extractMainContent($);
    const mainContentText = mainContent.substring(0, 5000);

    // Detect tech stack
    const fullHtml = $.html();
    const techStackIndicators = detectTechStack(fullHtml);

    // Extract social links
    const socialLinks = extractSocialLinks($);

    // Extract contact info
    const contactInfo = extractContactInfo($, mainContentText);

    return {
      url: normalizedUrl,
      title,
      metaDescription,
      metaKeywords,
      ogTitle,
      ogDescription,
      ogImage,
      h1Headings,
      h2Headings,
      mainContentText,
      techStackIndicators,
      socialLinks,
      contactInfo,
      language,
      fetchedAt: new Date().toISOString(),
      statusCode: response.status,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timeout: le site ${normalizedUrl} n'a pas repondu dans les ${FETCH_TIMEOUT / 1000} secondes`);
    }
    throw error;
  }
}

/**
 * Extract the main textual content from a page
 */
function extractMainContent($: ReturnType<typeof cheerio.load>): string {
  // Try common main content selectors
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '#main-content',
    '.content',
    '#content',
    '.page-content',
  ];

  for (const selector of mainSelectors) {
    const content = $(selector).first().text().trim();
    if (content && content.length > 100) {
      return cleanText(content);
    }
  }

  // Fallback: get body text
  const bodyText = $('body').text().trim();
  return cleanText(bodyText);
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Detect technology stack from HTML
 */
function detectTechStack(html: string): string[] {
  const detected: string[] = [];
  for (const [tech, pattern] of Object.entries(TECH_INDICATORS)) {
    if (pattern.test(html)) {
      detected.push(tech);
    }
  }
  return detected;
}

/**
 * Extract social media links
 */
function extractSocialLinks($: ReturnType<typeof cheerio.load>): SocialLinks {
  const links: SocialLinks = {
    linkedin: null,
    twitter: null,
    facebook: null,
    instagram: null,
    youtube: null,
    other: [],
  };

  $('a[href]').each((_: number, el: cheerio.Element) => {
    const href = $(el).attr('href');
    if (!href) return;

    for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
      if (pattern.test(href)) {
        if (platform in links && platform !== 'other') {
          (links as unknown as Record<string, string | null>)[platform] = href;
        }
        return;
      }
    }
  });

  return links;
}

/**
 * Extract contact information
 */
function extractContactInfo(
  $: ReturnType<typeof cheerio.load>,
  textContent: string
): ContactInfo {
  const emails: string[] = [];
  const phones: string[] = [];

  // Extract emails from mailto links
  $('a[href^="mailto:"]').each((_: number, el: cheerio.Element) => {
    const href = $(el).attr('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0].trim();
      if (email && !emails.includes(email)) {
        emails.push(email);
      }
    }
  });

  // Extract emails from text using regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const textEmails = textContent.match(emailRegex) || [];
  for (const email of textEmails) {
    if (!emails.includes(email) && !email.includes('example.com')) {
      emails.push(email);
    }
  }

  // Extract phone numbers from tel links
  $('a[href^="tel:"]').each((_: number, el: cheerio.Element) => {
    const href = $(el).attr('href');
    if (href) {
      const phone = href.replace('tel:', '').trim();
      if (phone && !phones.includes(phone)) {
        phones.push(phone);
      }
    }
  });

  // Extract French phone numbers from text
  const phoneRegex =
    /(?:\+33|0033|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g;
  const textPhones = textContent.match(phoneRegex) || [];
  for (const phone of textPhones) {
    const cleaned = phone.replace(/[\s.-]/g, '');
    if (!phones.includes(cleaned)) {
      phones.push(cleaned);
    }
  }

  // Extract address (simplified - look for common patterns)
  let address: string | null = null;
  const addressEl = $('[itemprop="address"], .address, .adresse').first();
  if (addressEl.length) {
    address = addressEl.text().trim().substring(0, 300) || null;
  }

  return {
    emails: emails.slice(0, 5),
    phones: phones.slice(0, 5),
    address,
  };
}

// ─── Analysis Functions ─────────────────────────────────────────────────────

/**
 * Full website analysis: scrape + AI analysis
 */
export async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  // Step 1: Scrape the website
  const scrapedData = await scrapeWebsite(url);

  // Step 2: Prepare content summary for AI
  const contentSummary = buildContentSummary(scrapedData);

  // Step 3: Call Claude for analysis
  const response = await getAnthropic().messages.create({
    model: CLAUDE_MODEL,
    system: SYSTEM_PROMPT_WEBSITE,
    messages: [
      {
        role: 'user',
        content: `Analyse le site web suivant et fournis ton analyse complete en JSON :\n\n${contentSummary}`,
      },
    ],
    max_tokens: 4096,
  });

  const responseText =
    response.content[0]?.type === 'text' ? response.content[0].text : '';

  const aiAnalysis = JSON.parse(responseText);

  return {
    scrapedData,
    aiAnalysis,
  };
}

/**
 * Build a text summary of scraped data for the AI
 */
function buildContentSummary(data: ScrapedWebsiteData): string {
  const parts: string[] = [];

  parts.push(`URL: ${data.url}`);

  if (data.title) {
    parts.push(`Titre de la page: ${data.title}`);
  }

  if (data.metaDescription) {
    parts.push(`Meta description: ${data.metaDescription}`);
  }

  if (data.metaKeywords) {
    parts.push(`Meta keywords: ${data.metaKeywords}`);
  }

  if (data.h1Headings.length > 0) {
    parts.push(`Titres H1: ${data.h1Headings.join(' | ')}`);
  }

  if (data.h2Headings.length > 0) {
    parts.push(`Titres H2: ${data.h2Headings.slice(0, 10).join(' | ')}`);
  }

  if (data.mainContentText) {
    parts.push(`Contenu principal:\n${data.mainContentText.substring(0, 3000)}`);
  }

  if (data.techStackIndicators.length > 0) {
    parts.push(`Technologies detectees: ${data.techStackIndicators.join(', ')}`);
  }

  if (data.contactInfo.emails.length > 0) {
    parts.push(`Emails de contact: ${data.contactInfo.emails.join(', ')}`);
  }

  if (data.socialLinks.linkedin) {
    parts.push(`LinkedIn: ${data.socialLinks.linkedin}`);
  }

  if (data.language) {
    parts.push(`Langue du site: ${data.language}`);
  }

  return parts.join('\n\n');
}

/**
 * Enrich a prospect with website data
 */
export async function enrichProspect(
  prospect: Record<string, unknown>,
  websiteUrl?: string
): Promise<EnrichedProspect> {
  const enrichmentSources: string[] = ['profile_data'];
  let websiteAnalysis: WebsiteAnalysis | null = null;

  // Determine the URL to analyze
  const urlToAnalyze =
    websiteUrl ||
    (prospect.website as string) ||
    null;

  if (urlToAnalyze) {
    try {
      websiteAnalysis = await analyzeWebsite(urlToAnalyze);
      enrichmentSources.push('website_analysis');
    } catch (error) {
      console.error(
        `Erreur lors de l'analyse du site ${urlToAnalyze}:`,
        error
      );
      // Continue without website data
    }
  }

  return {
    originalData: prospect,
    websiteAnalysis,
    enrichedAt: new Date().toISOString(),
    enrichmentSource: enrichmentSources,
  };
}
