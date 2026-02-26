/**
 * Scraper Cocoonr - Extrait toutes les conciergeries et les insere/enrichit dans le CRM
 * Usage: node scripts/scrape-cocoonr.mjs
 *
 * - Upsert: si la conciergerie existe deja (meme company), on enrichit ses données
 * - Scrape chaque page detail + site web pour trouver email, telephone, infos
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "https://cocoonr.fr";
const PAGE_URL = `${BASE_URL}/conciergeries/`;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

// =========================================================================
// 1. FETCH & PARSE - Extract all conciergeries from the main page
// =========================================================================
async function fetchConciergeries() {
  console.log("Fetching:", PAGE_URL);
  const res = await fetch(PAGE_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  console.log(`Page: ${html.length} chars\n`);

  const results = [];

  // --- Parse the JS "concierges" array (200+ partner entries) ---
  // Format: concierges = [ [{ lat: X, lng: Y }, "Name", "Address", "/url/"], ... ]
  const conciergesStart = html.indexOf("concierges = [");
  if (conciergesStart !== -1) {
    // Find the matching closing bracket
    let depth = 0;
    let arrayStart = html.indexOf("[", conciergesStart);
    let i = arrayStart;
    for (; i < html.length; i++) {
      if (html[i] === "[") depth++;
      if (html[i] === "]") depth--;
      if (depth === 0) break;
    }
    const arrayStr = html.slice(arrayStart, i + 1);

    // Parse each entry using regex since it's not valid JSON (uses { lat:, lng: })
    const entryRegex = /\{\s*lat:\s*([-\d.]+)\s*,\s*lng:\s*([-\d.]+)\s*\}\s*,\s*"([^"]*?)"\s*,\s*"([^"]*?)"\s*,\s*"([^"]*?)"/g;
    let match;
    while ((match = entryRegex.exec(arrayStr)) !== null) {
      const [, lat, lng, name, address, urlPath] = match;
      const postalMatch = address.match(/(\d{5})/);
      const postalCode = postalMatch ? postalMatch[1] : "";
      let city = address.replace(/^\d{5}\s*/, "").trim();

      results.push({
        name: decodeHTML(name),
        city,
        postalCode,
        address: address.trim(),
        url: urlPath.startsWith("http") ? urlPath : `${BASE_URL}${urlPath}`,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        type: "partenaire",
      });
    }
    console.log(`Partenaires extraits du JS: ${results.length}`);
  }

  // --- Parse Cocoonr own agencies from HTML ---
  const agencyRegex = /href="(\/conciergerie-bnb-[^"]+)"[^>]*>\s*(?:Cocoonr\s+)?([^<]+)/g;
  let agencyMatch;
  const seenUrls = new Set(results.map(r => r.url));

  while ((agencyMatch = agencyRegex.exec(html)) !== null) {
    const [, urlPath, rawName] = agencyMatch;
    const fullUrl = `${BASE_URL}${urlPath}`;
    if (seenUrls.has(fullUrl)) continue;
    seenUrls.add(fullUrl);

    const name = `Cocoonr ${decodeHTML(rawName.trim())}`;

    // Try to extract address nearby
    const nearbyText = html.slice(agencyMatch.index, agencyMatch.index + 500);
    const addrMatch = nearbyText.match(/(\d{5})\s+([^<,\n]+)/);

    results.push({
      name,
      city: addrMatch ? addrMatch[2].trim() : "",
      postalCode: addrMatch ? addrMatch[1] : "",
      address: addrMatch ? `${addrMatch[1]} ${addrMatch[2].trim()}` : "",
      url: fullUrl,
      lat: 0,
      lng: 0,
      type: "agence",
    });
  }

  console.log(`Agences Cocoonr: ${results.length - results.filter(r => r.type === "partenaire").length}`);
  console.log(`TOTAL: ${results.length} conciergeries\n`);
  return results;
}

// =========================================================================
// 2. SCRAPE DETAIL PAGES - Get contact info from Cocoonr profile pages
// =========================================================================
async function scrapeDetailPage(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return {};
    const html = await res.text();
    const info = {};

    // Email
    const emailMatch = html.match(/href="mailto:([^"]+)"/i)
      || html.match(/([\w.+-]+@[\w-]+\.[\w.]{2,})/);
    if (emailMatch) {
      const email = (emailMatch[1] || emailMatch[0]).toLowerCase().trim();
      if (!email.includes("cocoonr.fr") && !email.includes("example")) {
        info.email = email;
      }
    }

    // Phone
    const phoneMatch = html.match(/href="tel:([^"]+)"/i)
      || html.match(/((?:\+33|0)[1-9](?:[\s.]?\d{2}){4})/);
    if (phoneMatch) {
      info.phone = (phoneMatch[1] || phoneMatch[0]).replace(/[\s.]/g, "");
    }

    // Website - look for external links (not cocoonr, not social media)
    const excludedDomains = /cocoonr\.fr|facebook|instagram|twitter|linkedin|google|youtube|tiktok|apple\.com|play\.google|w3\.org|schema\.org|cloudflare|wp-content|gravatar|googleapis|pinterest|tripadvisor|airbnb|booking\.com|maps\.app/i;
    const allLinks = [...html.matchAll(/<a[^>]*href="(https?:\/\/[^"]+)"/gi)];
    for (const [, href] of allLinks) {
      if (!excludedDomains.test(href) && !href.includes("cocoonr")) {
        info.website = href.replace(/\/+$/, "");
        break;
      }
    }
    // Also try explicit "Site web" labels
    const siteWebMatch = html.match(
      /(?:site\s*(?:web|internet)|website)\s*:?\s*(?:<[^>]*>)*\s*(?:<a[^>]*href=")(https?:\/\/[^"]+)/i
    );
    if (siteWebMatch && !excludedDomains.test(siteWebMatch[1])) {
      info.website = siteWebMatch[1].replace(/\/+$/, "");
    }

    // Description
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
      || html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (descMatch) {
      info.description = decodeHTML(descMatch[1]).slice(0, 500);
    }

    // Services
    const servicesSection = html.match(/services?\s*(?:propos[ée]s?|inclus)\s*:?\s*<\/[^>]+>\s*<[^>]+>([\s\S]{10,500}?)<\//i);
    if (servicesSection) {
      info.services = decodeHTML(servicesSection[1].replace(/<[^>]+>/g, " ")).trim().slice(0, 300);
    }

    return info;
  } catch {
    return {};
  }
}

// =========================================================================
// 3. SCRAPE EXTERNAL WEBSITE - Find email, phone from the conciergerie's own site
// =========================================================================
async function scrapeExternalWebsite(websiteUrl) {
  try {
    const res = await fetch(websiteUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (!res.ok) return {};
    const html = await res.text();
    const info = {};

    // Emails (all unique)
    const emails = [...html.matchAll(/([\w.+-]+@[\w-]+\.[\w.]{2,})/g)]
      .map(m => m[1].toLowerCase())
      .filter(e => !e.includes("example") && !e.includes("wixpress") && !e.includes("sentry") && !e.endsWith(".png") && !e.endsWith(".jpg"));
    const uniqueEmails = [...new Set(emails)];
    if (uniqueEmails.length > 0) {
      info.email = uniqueEmails[0]; // Primary email
      info.allEmails = uniqueEmails.slice(0, 5);
    }

    // Phone
    const phoneMatch = html.match(/href="tel:([^"]+)"/i)
      || html.match(/((?:\+33|0)[1-9](?:[\s.]?\d{2}){4})/);
    if (phoneMatch) {
      info.phone = (phoneMatch[1] || phoneMatch[0]).replace(/[\s.]/g, "");
    }

    // Social media
    const socials = {};
    const fbMatch = html.match(/href="(https?:\/\/(?:www\.)?facebook\.com\/[^"]+)"/i);
    if (fbMatch) socials.facebook = fbMatch[1];
    const instaMatch = html.match(/href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]+)"/i);
    if (instaMatch) socials.instagram = instaMatch[1];
    const liMatch = html.match(/href="(https?:\/\/(?:www\.)?linkedin\.com\/[^"]+)"/i);
    if (liMatch) socials.linkedin = liMatch[1];
    if (Object.keys(socials).length > 0) info.socials = socials;

    // Meta description
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (descMatch) info.description = decodeHTML(descMatch[1]).slice(0, 500);

    // Title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) info.siteTitle = decodeHTML(titleMatch[1]).trim();

    // Try contact page for more info
    if (!info.email || !info.phone) {
      const contactUrls = ["/contact", "/nous-contacter", "/contactez-nous"];
      for (const path of contactUrls) {
        try {
          const base = new URL(websiteUrl).origin;
          const contactRes = await fetch(`${base}${path}`, {
            headers: HEADERS,
            signal: AbortSignal.timeout(8000),
            redirect: "follow"
          });
          if (!contactRes.ok) continue;
          const contactHtml = await contactRes.text();

          if (!info.email) {
            const contactEmail = contactHtml.match(/href="mailto:([^"]+)"/i)
              || contactHtml.match(/([\w.+-]+@[\w-]+\.[\w.]{2,})/);
            if (contactEmail) {
              const e = (contactEmail[1] || contactEmail[0]).toLowerCase();
              if (!e.includes("example") && !e.includes("wixpress")) info.email = e;
            }
          }
          if (!info.phone) {
            const contactPhone = contactHtml.match(/href="tel:([^"]+)"/i)
              || contactHtml.match(/((?:\+33|0)[1-9](?:[\s.]?\d{2}){4})/);
            if (contactPhone) {
              info.phone = (contactPhone[1] || contactPhone[0]).replace(/[\s.]/g, "");
            }
          }
          if (info.email && info.phone) break;
        } catch { /* skip */ }
      }
    }

    return info;
  } catch {
    return {};
  }
}

// =========================================================================
// 4. INSERT/ENRICH in Supabase CRM
// =========================================================================
async function upsertIntoCRM(conciergeries, workspaceId) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let created = 0, enriched = 0, errors = 0;

  for (let i = 0; i < conciergeries.length; i++) {
    const c = conciergeries[i];
    const progress = `[${String(i + 1).padStart(3)}/${conciergeries.length}]`;
    process.stdout.write(`\r${progress} ${c.name.slice(0, 45).padEnd(45)}`);

    // Scrape Cocoonr detail page for email, phone, website
    let detail = {};
    try {
      detail = await scrapeDetailPage(c.url);
      await sleep(150);
    } catch { /* continue */ }

    // If we found an external website, try to scrape it for more info
    let siteInfo = {};
    const externalWebsite = detail.website || null;
    if (externalWebsite) {
      try {
        process.stdout.write(` -> ${new URL(externalWebsite).hostname}`);
        siteInfo = await scrapeExternalWebsite(externalWebsite);
        await sleep(200);
      } catch { /* continue */ }
    }

    // Merge all info
    const email = siteInfo.email || detail.email || null;
    const phone = siteInfo.phone || detail.phone || null;
    const website = externalWebsite || null;

    const customFields = {
      cocoonr_url: c.url,
      cocoonr_type: c.type,
      latitude: c.lat || null,
      longitude: c.lng || null,
      full_address: c.address || null,
      postal_code: c.postalCode || null,
      description: siteInfo.description || detail.description || null,
      services: detail.services || null,
      site_title: siteInfo.siteTitle || null,
      all_emails: siteInfo.allEmails || null,
      socials: siteInfo.socials || null,
      scraped_from: "cocoonr.fr/conciergeries",
      scraped_at: new Date().toISOString(),
    };

    // Check if already exists by company name
    const { data: existing } = await supabase
      .from("prospects")
      .select("id, custom_fields, email, phone, website")
      .eq("workspace_id", workspaceId)
      .eq("company", c.name)
      .limit(1)
      .single();

    if (existing) {
      // ENRICH: merge new data with existing, keeping existing non-null values
      const updates = {};
      if (!existing.email && email) updates.email = email;
      if (!existing.phone && phone) updates.phone = phone;
      if (!existing.website && website) updates.website = website;

      // Merge custom_fields
      const mergedCustom = {
        ...(existing.custom_fields || {}),
        ...Object.fromEntries(
          Object.entries(customFields).filter(([, v]) => v !== null)
        ),
      };
      updates.custom_fields = mergedCustom;
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("prospects")
        .update(updates)
        .eq("id", existing.id);

      if (error) {
        errors++;
      } else {
        enriched++;
      }
    } else {
      // CREATE new prospect
      const { error } = await supabase.from("prospects").insert({
        workspace_id: workspaceId,
        email: email || `contact@${slugify(c.name)}.fr`,
        first_name: c.name.split(" ")[0] || "Conciergerie",
        last_name: c.name.split(" ").slice(1).join(" ") || c.name,
        company: c.name,
        job_title: "Conciergerie",
        phone: phone || null,
        website: website || c.url,
        location: c.city ? `${c.city}${c.postalCode ? ` (${c.postalCode})` : ""}` : null,
        linkedin_url: siteInfo.socials?.linkedin || null,
        source: "manual",
        status: "active",
        custom_fields: customFields,
      });

      if (error) {
        errors++;
        if (i < 3) console.error(`\n  ERR: ${error.message}`);
      } else {
        created++;
      }
    }
  }

  console.log(`\n\n${"=".repeat(50)}`);
  console.log(`RESULTATS:`);
  console.log(`  Crees:    ${created}`);
  console.log(`  Enrichis: ${enriched}`);
  console.log(`  Erreurs:  ${errors}`);
  console.log(`  Total:    ${conciergeries.length}`);
  console.log(`${"=".repeat(50)}\n`);
}

// =========================================================================
// Helpers
// =========================================================================
function decodeHTML(text) {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&#8217;/g, "'").replace(/&#8211;/g, "–").replace(/&#8230;/g, "…");
}

function slugify(str) {
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// =========================================================================
// MAIN
// =========================================================================
async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  SCRAPER COCOONR → CRM                  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: workspaces } = await supabase.from("workspaces").select("id, name").limit(1);
  if (!workspaces?.length) { console.error("No workspace found"); process.exit(1); }

  const ws = workspaces[0];
  console.log(`Workspace: ${ws.name} (${ws.id})\n`);

  // Step 1: Extract
  const conciergeries = await fetchConciergeries();
  if (!conciergeries.length) { console.error("No conciergeries found!"); process.exit(1); }

  // Step 2: Upsert into CRM with enrichment
  await upsertIntoCRM(conciergeries, ws.id);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
