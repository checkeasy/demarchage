// Dynamic imports to avoid blocking compilation
async function getPuppeteer() {
  return (await import('puppeteer-core')).default;
}
async function getChromium() {
  return (await import('@sparticuz/chromium')).default;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GoogleMapsBusinessResult {
  placeId: string;
  businessName: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  googleMapsUrl: string | null;
}

export interface MapsSearchResult {
  query: string;
  location: string;
  businesses: GoogleMapsBusinessResult[];
  totalFound: number;
  scrapedAt: string;
  source: 'puppeteer';
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SCROLL_PAUSE_MS = 2000;
const MAX_SCROLLS = 5;
const MAX_RESULTS = 20;
const PAGE_TIMEOUT = 30000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generatePlaceId(name: string, address: string | null): string {
  const raw = `${name}-${address || 'unknown'}`.toLowerCase().replace(/\s+/g, '-');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `maps_${Math.abs(hash).toString(36)}`;
}

// ─── Main Scraper ───────────────────────────────────────────────────────────

export async function searchGoogleMaps(
  query: string,
  location?: string
): Promise<MapsSearchResult> {
  const fullQuery = location ? `${query} ${location}` : query;
  const encodedQuery = encodeURIComponent(fullQuery);
  const mapsUrl = `https://www.google.com/maps/search/${encodedQuery}`;

  console.log(`[GoogleMapsScraper] Searching: "${fullQuery}"`);
  console.log(`[GoogleMapsScraper] URL: ${mapsUrl}`);

  let browser;
  try {
    const puppeteer = await getPuppeteer();
    const chromium = await getChromium();
    const executablePath = process.env.CHROMIUM_PATH || await chromium.executablePath();

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
      ],
      defaultViewport: { width: 1280, height: 900 },
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Block images/fonts/media to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate to Google Maps search
    await page.goto(mapsUrl, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });

    // Handle Google cookie consent dialog
    try {
      const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="Accepter"], form[action*="consent"] button');
      if (consentBtn) {
        await consentBtn.click();
        await sleep(1500);
      }
    } catch {
      // No consent dialog, continue
    }

    // Wait for results feed to appear
    await page.waitForSelector('[role="feed"], .Nv2PK, [role="article"]', { timeout: 15000 }).catch(() => {
      console.log('[GoogleMapsScraper] Results feed not found, trying alternative selectors...');
    });

    // Scroll the results panel to load more businesses
    const feedSelector = '[role="feed"]';
    const feedElement = await page.$(feedSelector);

    if (feedElement) {
      for (let i = 0; i < MAX_SCROLLS; i++) {
        await page.evaluate((selector) => {
          const feed = document.querySelector(selector);
          if (feed) {
            feed.scrollBy(0, 1000);
          }
        }, feedSelector);
        await sleep(SCROLL_PAUSE_MS);
      }
    }

    // Extract business data from result cards
    const businesses = await page.evaluate((maxResults) => {
      const results: Array<{
        businessName: string;
        address: string | null;
        phone: string | null;
        website: string | null;
        rating: number | null;
        reviewCount: number | null;
        category: string | null;
        googleMapsUrl: string | null;
      }> = [];

      // Try multiple selector strategies for business cards
      const cards = document.querySelectorAll('[role="feed"] > div > div > a, .Nv2PK');

      cards.forEach((card) => {
        if (results.length >= maxResults) return;

        // Business name - try multiple approaches
        let name = '';
        const ariaLabel = card.getAttribute('aria-label');
        if (ariaLabel) {
          name = ariaLabel;
        } else {
          const nameEl = card.querySelector('.qBF1Pd, .fontHeadlineSmall');
          if (nameEl) name = nameEl.textContent?.trim() || '';
        }

        if (!name) return;

        // Rating
        let rating: number | null = null;
        const ratingEl = card.querySelector('.MW4etd, span[role="img"]');
        if (ratingEl) {
          const ratingText = ratingEl.textContent?.trim().replace(',', '.');
          if (ratingText) rating = parseFloat(ratingText) || null;
        }

        // Review count
        let reviewCount: number | null = null;
        const reviewEl = card.querySelector('.UY7F9');
        if (reviewEl) {
          const text = reviewEl.textContent?.replace(/[^\d]/g, '');
          if (text) reviewCount = parseInt(text, 10) || null;
        }

        // Category and address from info spans
        let category: string | null = null;
        let address: string | null = null;
        const infoSpans = card.querySelectorAll('.W4Efsd span, .W4Efsd');
        const infoTexts: string[] = [];
        infoSpans.forEach((span) => {
          const text = span.textContent?.trim();
          if (text && text.length > 2 && !text.includes('·')) {
            infoTexts.push(text);
          }
        });

        // Usually: category · price · address
        if (infoTexts.length >= 1) category = infoTexts[0] || null;
        if (infoTexts.length >= 2) address = infoTexts[infoTexts.length - 1] || null;

        // Google Maps URL
        let googleMapsUrl: string | null = null;
        const linkEl = card.closest('a') || card.querySelector('a');
        if (linkEl) {
          googleMapsUrl = (linkEl as HTMLAnchorElement).href || null;
        }

        results.push({
          businessName: name,
          address,
          phone: null, // Will be enriched in detail pass
          website: null, // Will be enriched in detail pass
          rating,
          reviewCount,
          category,
          googleMapsUrl,
        });
      });

      return results;
    }, MAX_RESULTS);

    // Second pass: click each business to get phone and website from details panel
    const enrichedBusinesses: GoogleMapsBusinessResult[] = [];

    for (const biz of businesses) {
      if (enrichedBusinesses.length >= MAX_RESULTS) break;

      // Try to get details by clicking on the business
      try {
        if (biz.googleMapsUrl) {
          await page.goto(biz.googleMapsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          await sleep(1000);

          const details = await page.evaluate(() => {
            let phone: string | null = null;
            let website: string | null = null;
            let address: string | null = null;

            // Phone - look for phone button/link
            const phoneEl = document.querySelector('button[data-tooltip*="phone"], button[data-tooltip*="elephone"], a[href^="tel:"], [data-item-id*="phone"]');
            if (phoneEl) {
              const ariaLabel = phoneEl.getAttribute('aria-label') || phoneEl.textContent;
              if (ariaLabel) {
                const phoneMatch = ariaLabel.match(/[\d\s+().,-]{8,}/);
                if (phoneMatch) phone = phoneMatch[0].trim();
              }
            }

            // Also try to find phone in the info section
            if (!phone) {
              const allButtons = document.querySelectorAll('button[data-item-id]');
              allButtons.forEach((btn) => {
                const itemId = btn.getAttribute('data-item-id') || '';
                if (itemId.startsWith('phone:')) {
                  phone = itemId.replace('phone:tel:', '').replace('phone:', '');
                }
              });
            }

            // Website
            const websiteEl = document.querySelector('a[data-item-id="authority"], a[data-tooltip*="site"], a[data-tooltip*="website"]');
            if (websiteEl) {
              website = (websiteEl as HTMLAnchorElement).href || null;
              // Clean Google redirect URLs
              if (website && website.includes('google.com/url')) {
                try {
                  const url = new URL(website);
                  website = url.searchParams.get('q') || url.searchParams.get('url') || website;
                } catch { /* keep original */ }
              }
            }

            // Also check for website in data-item-id
            if (!website) {
              const allLinks = document.querySelectorAll('a[data-item-id]');
              allLinks.forEach((link) => {
                const itemId = link.getAttribute('data-item-id') || '';
                if (itemId === 'authority') {
                  website = (link as HTMLAnchorElement).href || null;
                }
              });
            }

            // Address
            const addressEl = document.querySelector('button[data-item-id="address"], [data-item-id*="address"]');
            if (addressEl) {
              address = addressEl.getAttribute('aria-label')?.replace('Adresse:', '').replace('Address:', '').trim() || addressEl.textContent?.trim() || null;
            }

            return { phone, website, address };
          });

          enrichedBusinesses.push({
            placeId: generatePlaceId(biz.businessName, details.address || biz.address),
            businessName: biz.businessName,
            address: details.address || biz.address,
            phone: details.phone,
            website: details.website,
            rating: biz.rating,
            reviewCount: biz.reviewCount,
            category: biz.category,
            googleMapsUrl: biz.googleMapsUrl,
          });
        } else {
          enrichedBusinesses.push({
            placeId: generatePlaceId(biz.businessName, biz.address),
            ...biz,
          });
        }
      } catch (err) {
        console.error(`[GoogleMapsScraper] Error enriching "${biz.businessName}":`, err);
        enrichedBusinesses.push({
          placeId: generatePlaceId(biz.businessName, biz.address),
          ...biz,
        });
      }
    }

    // If detail pass yielded nothing, go back to results and try a simpler extraction
    if (enrichedBusinesses.length === 0 && businesses.length === 0) {
      // Final attempt: simple text extraction from the page
      console.log('[GoogleMapsScraper] Trying simplified extraction...');
      await page.goto(mapsUrl, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });
      await sleep(3000);

      const simpleResults = await page.evaluate((max) => {
        const items: Array<{
          businessName: string;
          address: string | null;
          phone: string | null;
          website: string | null;
          rating: number | null;
          reviewCount: number | null;
          category: string | null;
          googleMapsUrl: string | null;
        }> = [];

        // Try aria-label on links which often contain business names
        const links = document.querySelectorAll('a[aria-label]');
        links.forEach((link) => {
          if (items.length >= max) return;
          const label = link.getAttribute('aria-label');
          if (label && label.length > 3 && label.length < 100) {
            const href = (link as HTMLAnchorElement).href;
            if (href && href.includes('/maps/place/')) {
              items.push({
                businessName: label,
                address: null,
                phone: null,
                website: null,
                rating: null,
                reviewCount: null,
                category: null,
                googleMapsUrl: href,
              });
            }
          }
        });

        return items;
      }, MAX_RESULTS);

      for (const biz of simpleResults) {
        enrichedBusinesses.push({
          placeId: generatePlaceId(biz.businessName, biz.address),
          ...biz,
        });
      }
    }

    console.log(`[GoogleMapsScraper] Found ${enrichedBusinesses.length} businesses`);

    return {
      query,
      location: location || '',
      businesses: enrichedBusinesses,
      totalFound: enrichedBusinesses.length,
      scrapedAt: new Date().toISOString(),
      source: 'puppeteer',
    };
  } catch (err) {
    console.error('[GoogleMapsScraper] Fatal error:', err);
    return {
      query,
      location: location || '',
      businesses: [],
      totalFound: 0,
      scrapedAt: new Date().toISOString(),
      source: 'puppeteer',
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Browser already closed
      }
    }
  }
}
