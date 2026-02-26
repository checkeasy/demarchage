/**
 * Enrichissement Google des conciergeries
 * Recherche le site web, email, telephone de chaque conciergerie via DuckDuckGo
 * Usage: node scripts/enrich-google.mjs [--skip N] [--batch N]
 */

import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const WS = '83da732a-a933-4ed4-a815-3f975c8ff0c6';

// Parse CLI args
const args = process.argv.slice(2);
const skipIndex = args.indexOf('--skip');
const SKIP = skipIndex >= 0 ? parseInt(args[skipIndex + 1]) || 0 : 0;
const batchIndex = args.indexOf('--batch');
const BATCH = batchIndex >= 0 ? parseInt(args[batchIndex + 1]) || 50 : 999;

// Rotate user agents to avoid blocking
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function getHeaders() {
  return {
    "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  };
}

const EXCLUDED_DOMAINS = /cocoonr\.fr|facebook\.com|instagram\.com|twitter\.com|linkedin\.com|google\.com|youtube\.com|tiktok\.com|pinterest\.com|tripadvisor|airbnb|booking\.com|pagesjaunes|societe\.com|sirene|infogreffe|verif\.com|pappers|manageo|wikipedia|yelp|annuairefrancais/i;

// =========================================================================
// 1. Search DuckDuckGo HTML for a query
// =========================================================================
async function searchDuckDuckGo(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      if (res.status === 429 || res.status === 403) {
        console.log(' [DDG BLOCKED]');
        return { urls: [], blocked: true };
      }
      return { urls: [], blocked: false };
    }

    const html = await res.text();

    // Check for CAPTCHA/block
    if (html.includes('captcha') || html.includes('blocked') || html.length < 500) {
      return { urls: [], blocked: true };
    }

    const results = [];
    const linkRegex = /class="result__a"[^>]*href="([^"]+)"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let href = match[1];
      if (href.includes('uddg=')) {
        const decoded = decodeURIComponent(href.split('uddg=')[1]?.split('&')[0] || '');
        if (decoded) href = decoded;
      }
      if (href.startsWith('http') && !EXCLUDED_DOMAINS.test(href)) {
        results.push(href);
      }
    }

    // Alternative patterns
    if (results.length === 0) {
      const altRegex = /class="result__url"[^>]*href="([^"]+)"/g;
      while ((match = altRegex.exec(html)) !== null) {
        let href = match[1];
        if (href.startsWith('//')) href = 'https:' + href;
        if (href.startsWith('http') && !EXCLUDED_DOMAINS.test(href)) {
          results.push(href);
        }
      }
    }

    if (results.length === 0) {
      const snippetRegex = /href="(https?:\/\/[^"]+)"[^>]*class="result/g;
      while ((match = snippetRegex.exec(html)) !== null) {
        if (!EXCLUDED_DOMAINS.test(match[1])) {
          results.push(match[1]);
        }
      }
    }

    return { urls: results.slice(0, 5), blocked: false };
  } catch {
    return { urls: [], blocked: false };
  }
}

// =========================================================================
// 2. Search Google via scraping (fallback)
// =========================================================================
async function searchGoogle(query) {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=fr&num=5`;
    const res = await fetch(url, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const results = [];
    // Google search result links pattern
    const linkRegex = /href="\/url\?q=(https?[^&"]+)/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = decodeURIComponent(match[1]);
      if (!EXCLUDED_DOMAINS.test(href)) {
        results.push(href);
      }
    }
    // Alternative: direct links
    if (results.length === 0) {
      const directRegex = /href="(https?:\/\/(?!www\.google)[^"]+)"/g;
      while ((match = directRegex.exec(html)) !== null) {
        if (!EXCLUDED_DOMAINS.test(match[1]) && !match[1].includes('google.com')) {
          results.push(match[1]);
        }
      }
    }
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

// =========================================================================
// 3. Scrape a website for contact info
// =========================================================================
async function scrapeWebsite(url) {
  try {
    const res = await fetch(url, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return {};
    const html = await res.text();
    const info = { url: res.url || url };

    // Email - from mailto links first, then regex
    const mailtoMatch = html.match(/href="mailto:([^"?]+)/i);
    if (mailtoMatch) {
      const e = mailtoMatch[1].toLowerCase().trim();
      if (!e.includes('exemple') && !e.includes('example')) {
        info.email = e;
      }
    }
    if (!info.email) {
      const emailMatch = html.match(/([\w.+-]+@[\w-]+\.(?:fr|com|net|org|eu|io))/i);
      if (emailMatch) {
        const e = emailMatch[1].toLowerCase();
        if (!e.includes('wix') && !e.includes('sentry') && !e.includes('wordpress') && !e.includes('example') && !e.includes('exemple')) {
          info.email = e;
        }
      }
    }

    // Phone - from tel: links first, then regex
    const telMatch = html.match(/href="tel:([^"]+)"/i);
    if (telMatch) {
      const phone = telMatch[1].replace(/[\s.\-()]/g, '');
      if (phone !== '0928389844' && phone !== '+33928389844') { // Cocoonr corporate
        info.phone = phone;
      }
    }
    if (!info.phone) {
      const phoneRegex = /((?:\+33|0)[1-9](?:[\s.\-]?\d{2}){4})/;
      const phoneMatch = html.match(phoneRegex);
      if (phoneMatch) {
        const phone = phoneMatch[1].replace(/[\s.\-]/g, '');
        if (phone !== '0928389844' && phone !== '0434782610') {
          info.phone = phone;
        }
      }
    }

    // Description
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (descMatch) info.description = descMatch[1].slice(0, 500);

    // Title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) info.siteTitle = titleMatch[1].trim().slice(0, 200);

    // Social media
    const socials = {};
    const fbMatch = html.match(/href="(https?:\/\/(?:www\.)?facebook\.com\/[^"]+)"/i);
    if (fbMatch) socials.facebook = fbMatch[1];
    const instaMatch = html.match(/href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]+)"/i);
    if (instaMatch) socials.instagram = instaMatch[1];
    if (Object.keys(socials).length > 0) info.socials = socials;

    return info;
  } catch {
    return {};
  }
}

// =========================================================================
// 4. Try contact pages for more info
// =========================================================================
async function scrapeContactPages(baseUrl, existingInfo) {
  const info = { ...existingInfo };
  try {
    const base = new URL(baseUrl).origin;
    for (const path of ['/contact', '/nous-contacter', '/contactez-nous', '/contact-us', '/a-propos']) {
      if (info.email && info.phone) break;
      try {
        const res = await fetch(`${base}${path}`, {
          headers: getHeaders(),
          signal: AbortSignal.timeout(8000),
          redirect: "follow",
        });
        if (!res.ok) continue;
        const html = await res.text();

        if (!info.email) {
          const cMailto = html.match(/href="mailto:([^"?]+)/i);
          const cEmail = html.match(/([\w.+-]+@[\w-]+\.(?:fr|com|net|org|eu|io))/i);
          const found = cMailto?.[1] || cEmail?.[1];
          if (found) {
            const e = found.toLowerCase();
            if (!e.includes('wix') && !e.includes('sentry') && !e.includes('wordpress') && !e.includes('example') && !e.includes('exemple')) {
              info.email = e;
            }
          }
        }
        if (!info.phone) {
          const cTel = html.match(/href="tel:([^"]+)"/i);
          const cPhone = html.match(/((?:\+33|0)[1-9](?:[\s.\-]?\d{2}){4})/);
          const phone = (cTel?.[1] || cPhone?.[1] || '').replace(/[\s.\-()]/g, '');
          if (phone && phone !== '0928389844' && phone !== '0434782610') {
            info.phone = phone;
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return info;
}

// =========================================================================
// 5. Main enrichment loop
// =========================================================================
async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  ENRICHISSEMENT GOOGLE → CRM v2         ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Fetch conciergeries that need enrichment (no google_enriched_at)
  const { data: prospects } = await sb.from('prospects')
    .select('id, company, email, phone, website, location, custom_fields')
    .eq('workspace_id', WS)
    .eq('job_title', 'Conciergerie')
    .order('company')
    .range(0, 999);

  if (!prospects?.length) {
    console.log("Aucune conciergerie trouvée");
    return;
  }

  // Filter to those needing enrichment
  const toEnrich = prospects.filter(p => {
    // Skip already enriched by Google
    if (p.custom_fields?.google_enriched_at) return false;
    // Need enrichment if: no phone, or website is cocoonr, or email looks auto-generated
    const emailIsGenerated = p.email?.startsWith('contact@') || p.email?.includes('@crm-import') || p.email?.includes('@directory-import');
    const websiteIsCocoonr = !p.website || p.website.includes('cocoonr');
    return !p.phone || websiteIsCocoonr || emailIsGenerated;
  });

  // Apply skip and batch
  const batch = toEnrich.slice(SKIP, SKIP + BATCH);

  console.log(`Conciergeries totales: ${prospects.length}`);
  console.log(`A enrichir: ${toEnrich.length}`);
  console.log(`Skip: ${SKIP}, Batch: ${BATCH}`);
  console.log(`Traitement de ${batch.length} conciergeries\n`);

  let enrichedEmail = 0, enrichedPhone = 0, enrichedWebsite = 0, failed = 0, blocked = 0;

  for (let i = 0; i < batch.length; i++) {
    const p = batch[i];
    const city = p.location?.replace(/\s*\(\d+\)\s*$/, '').trim() || '';
    const query = `"${p.company}" conciergerie ${city}`;

    process.stdout.write(`\r[${String(i + 1 + SKIP).padStart(3)}/${toEnrich.length}] ${p.company.slice(0, 40).padEnd(40)}`);

    // Search DuckDuckGo first
    const ddgResult = await searchDuckDuckGo(query);
    let searchResults = ddgResult.urls;

    // Random delay 2-5 seconds
    await sleep(2000 + Math.random() * 3000);

    // If DDG blocked, try Google as fallback
    if (ddgResult.blocked || searchResults.length === 0) {
      if (ddgResult.blocked) {
        blocked++;
        // Longer cooldown on block
        await sleep(10000 + Math.random() * 5000);
      }
      searchResults = await searchGoogle(query);
      await sleep(3000 + Math.random() * 3000);
    }

    if (searchResults.length === 0) {
      // Try a simpler query
      const simpleQuery = `${p.company} ${city}`;
      const ddg2 = await searchDuckDuckGo(simpleQuery);
      searchResults = ddg2.urls;
      await sleep(2000 + Math.random() * 2000);

      if (searchResults.length === 0) {
        failed++;
        // Mark as attempted so we don't retry
        await sb.from('prospects').update({
          custom_fields: {
            ...(p.custom_fields || {}),
            google_enriched_at: new Date().toISOString(),
            google_enrichment_status: 'no_results',
          },
          updated_at: new Date().toISOString(),
        }).eq('id', p.id);
        process.stdout.write(' [---]');
        continue;
      }
    }

    // Try to scrape the top results until we find contact info
    let bestInfo = {};
    for (const resultUrl of searchResults.slice(0, 3)) {
      const info = await scrapeWebsite(resultUrl);
      await sleep(500 + Math.random() * 500);

      // Merge info - keep the best
      if (info.url && !bestInfo.url) bestInfo.url = info.url;
      if (info.email && !bestInfo.email) bestInfo.email = info.email;
      if (info.phone && !bestInfo.phone) bestInfo.phone = info.phone;
      if (info.description && !bestInfo.description) bestInfo.description = info.description;
      if (info.siteTitle && !bestInfo.siteTitle) bestInfo.siteTitle = info.siteTitle;
      if (info.socials) bestInfo.socials = { ...(bestInfo.socials || {}), ...info.socials };

      if (bestInfo.email && bestInfo.phone) break;
    }

    // Try contact pages on the first result
    if (bestInfo.url && (!bestInfo.email || !bestInfo.phone)) {
      bestInfo = await scrapeContactPages(bestInfo.url, bestInfo);
    }

    // Update prospect
    const updates = {};
    const cfUpdates = { ...(p.custom_fields || {}) };
    let didUpdate = false;

    if (bestInfo.url) {
      const websiteIsCocoonr = !p.website || p.website.includes('cocoonr');
      if (websiteIsCocoonr) {
        updates.website = bestInfo.url;
        enrichedWebsite++;
        didUpdate = true;
      }
    }

    if (bestInfo.email) {
      const emailIsGenerated = p.email?.startsWith('contact@') || p.email?.includes('@crm-import') || p.email?.includes('@directory-import');
      if (emailIsGenerated) {
        updates.email = bestInfo.email;
        enrichedEmail++;
        didUpdate = true;
      }
    }

    if (bestInfo.phone && !p.phone) {
      updates.phone = bestInfo.phone;
      enrichedPhone++;
      didUpdate = true;
    }

    // Update custom_fields
    if (bestInfo.description) cfUpdates.description = bestInfo.description;
    if (bestInfo.siteTitle) cfUpdates.site_title = bestInfo.siteTitle;
    if (bestInfo.socials) cfUpdates.socials = bestInfo.socials;
    cfUpdates.google_enriched_at = new Date().toISOString();
    cfUpdates.google_enrichment_status = didUpdate ? 'enriched' : 'no_new_data';

    updates.custom_fields = cfUpdates;
    updates.updated_at = new Date().toISOString();

    await sb.from('prospects').update(updates).eq('id', p.id);

    if (!didUpdate) failed++;

    // Status indicator
    const indicator = bestInfo.email ? 'E' : '-';
    const phoneInd = bestInfo.phone ? 'P' : '-';
    const webInd = bestInfo.url ? 'W' : '-';
    process.stdout.write(` [${indicator}${phoneInd}${webInd}]`);

    // Every 10 entries, report progress
    if ((i + 1) % 10 === 0) {
      console.log(`\n  -> Progress: E=${enrichedEmail} P=${enrichedPhone} W=${enrichedWebsite} fail=${failed} blocked=${blocked}`);
    }
  }

  console.log(`\n\n${"=".repeat(50)}`);
  console.log(`ENRICHISSEMENT TERMINE:`);
  console.log(`  Emails trouves:     ${enrichedEmail}`);
  console.log(`  Telephones trouves: ${enrichedPhone}`);
  console.log(`  Sites web trouves:  ${enrichedWebsite}`);
  console.log(`  Pas de resultat:    ${failed}`);
  console.log(`  Blocages DDG:       ${blocked}`);
  console.log(`  Total traites:      ${batch.length}`);
  console.log(`${"=".repeat(50)}\n`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
