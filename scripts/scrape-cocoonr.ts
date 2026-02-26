/**
 * Scraper Cocoonr - Extrait toutes les conciergeries et les insere dans le CRM
 * Usage: npx tsx scripts/scrape-cocoonr.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = "https://cocoonr.fr";
const PAGE_URL = `${BASE_URL}/conciergeries/`;

interface ConciergerieParsed {
  name: string;
  city: string;
  postalCode: string;
  address: string;
  url: string;
  lat: number;
  lng: number;
  isPartner: boolean; // true = partenaire, false = agence Cocoonr
}

// -------------------------------------------------------------------------
// 1. Fetch the page and extract the JavaScript array
// -------------------------------------------------------------------------
async function fetchConciergeries(): Promise<ConciergerieParsed[]> {
  console.log("Fetching page:", PAGE_URL);
  const res = await fetch(PAGE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const html = await res.text();
  console.log(`Page fetched: ${html.length} characters`);

  const results: ConciergerieParsed[] = [];

  // Extract the JavaScript "concierges" array (partner conciergeries)
  // Format: var concierges = [[lat, lng, "name", "address", "url"], ...]
  const conciergesMatch = html.match(/var\s+concierges\s*=\s*\[([\s\S]*?)\];\s*(?:var|let|const|function|\/\/)/);

  if (conciergesMatch) {
    const arrayContent = conciergesMatch[1];
    // Match each sub-array: [lat, lng, "name", "address", "url"]
    const entryRegex = /\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*["']([^"']*?)["']\s*,\s*["']([^"']*?)["']\s*,\s*["']([^"']*?)["']\s*\]/g;

    let match;
    while ((match = entryRegex.exec(arrayContent)) !== null) {
      const [, lat, lng, name, address, urlPath] = match;

      // Parse city and postal code from address
      const postalMatch = address.match(/(\d{5})/);
      const postalCode = postalMatch ? postalMatch[1] : "";

      // Extract city - usually after the postal code or the main part of address
      let city = address;
      if (postalCode) {
        // Try to get city after postal code
        const afterPostal = address.split(postalCode)[1]?.trim();
        if (afterPostal) {
          city = afterPostal.replace(/^[\s,]+/, "");
        } else {
          // City might be before postal code
          city = address.split(postalCode)[0]?.trim().replace(/[\s,]+$/, "") || address;
        }
      }

      results.push({
        name: decodeHTMLEntities(name.trim()),
        city: city.trim(),
        postalCode,
        address: address.trim(),
        url: urlPath.startsWith("http") ? urlPath : `${BASE_URL}${urlPath}`,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        isPartner: true,
      });
    }

    console.log(`Found ${results.length} partner conciergeries from JS array`);
  } else {
    console.log("Could not find 'concierges' JS array, trying alternative patterns...");

    // Try alternative pattern
    const altMatch = html.match(/concierges\s*=\s*(\[[\s\S]*?\]);/);
    if (altMatch) {
      try {
        // Clean the array for JSON parsing
        let jsonStr = altMatch[1]
          .replace(/'/g, '"')
          .replace(/,\s*\]/g, "]"); // Remove trailing commas
        const parsed = JSON.parse(jsonStr);
        for (const entry of parsed) {
          if (Array.isArray(entry) && entry.length >= 5) {
            const [lat, lng, name, address, urlPath] = entry;
            const postalMatch = String(address).match(/(\d{5})/);
            const postalCode = postalMatch ? postalMatch[1] : "";
            let city = address;
            if (postalCode) {
              const afterPostal = String(address).split(postalCode)[1]?.trim();
              city = afterPostal?.replace(/^[\s,]+/, "") || address;
            }

            results.push({
              name: String(name).trim(),
              city: String(city).trim(),
              postalCode,
              address: String(address).trim(),
              url: String(urlPath).startsWith("http") ? String(urlPath) : `${BASE_URL}${urlPath}`,
              lat: Number(lat),
              lng: Number(lng),
              isPartner: true,
            });
          }
        }
        console.log(`Found ${results.length} partner conciergeries from alt pattern`);
      } catch (e) {
        console.error("Failed to parse alternative pattern:", e);
      }
    }
  }

  // Also extract the Cocoonr official agencies from HTML
  // They appear as links like: <a href="/conciergerie-bnb-.../">Cocoonr City</a>
  const agencyRegex = /<a[^>]*href=["'](\/conciergerie-bnb-[^"']+)["'][^>]*>([^<]+)<\/a>/g;
  let agencyMatch;
  const seenUrls = new Set(results.map(r => r.url));

  while ((agencyMatch = agencyRegex.exec(html)) !== null) {
    const [, urlPath, name] = agencyMatch;
    const fullUrl = `${BASE_URL}${urlPath}`;
    if (!seenUrls.has(fullUrl)) {
      seenUrls.add(fullUrl);

      // Try to find address info nearby in the HTML
      const addressRegex = new RegExp(
        `${urlPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]{0,500}?(\\d{5})\\s+([^<,]+)`,
        "i"
      );
      const addrMatch = html.match(addressRegex);

      results.push({
        name: decodeHTMLEntities(name.trim()),
        city: addrMatch ? addrMatch[2].trim() : "",
        postalCode: addrMatch ? addrMatch[1] : "",
        address: addrMatch ? `${addrMatch[1]} ${addrMatch[2].trim()}` : "",
        url: fullUrl,
        lat: 0,
        lng: 0,
        isPartner: false,
      });
    }
  }

  console.log(`Total: ${results.length} conciergeries found`);
  return results;
}

// -------------------------------------------------------------------------
// 2. Scrape detail pages for contact info (email, phone, website)
// -------------------------------------------------------------------------
interface DetailInfo {
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
}

async function scrapeDetailPage(url: string): Promise<DetailInfo> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return {};

    const html = await res.text();
    const info: DetailInfo = {};

    // Extract email
    const emailMatch = html.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch && !emailMatch[0].includes("example") && !emailMatch[0].includes("cocoonr")) {
      info.email = emailMatch[0].toLowerCase();
    }

    // Extract phone
    const phoneMatch = html.match(/(?:tel:|href="tel:)([^"<\s]+)/i)
      || html.match(/(0[1-9][\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2})/);
    if (phoneMatch) {
      info.phone = phoneMatch[1].replace(/[\s.]/g, "").replace(/^(\+33)/, "0");
    }

    // Extract website
    const websiteMatch = html.match(/(?:Site\s*(?:web|internet)\s*:?\s*<[^>]*>?\s*<a[^>]*href=["'])(https?:\/\/[^"']+)/i)
      || html.match(/<a[^>]*href=["'](https?:\/\/(?!cocoonr\.fr|facebook|instagram|twitter|linkedin|google)[^"']+)["'][^>]*(?:target=["']_blank|rel=["']noopener)/i);
    if (websiteMatch) {
      info.website = websiteMatch[1];
    }

    // Extract description (meta description or first paragraph)
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)/i);
    if (descMatch) {
      info.description = decodeHTMLEntities(descMatch[1]).slice(0, 500);
    }

    return info;
  } catch {
    return {};
  }
}

// -------------------------------------------------------------------------
// 3. Insert into Supabase CRM
// -------------------------------------------------------------------------
async function insertIntoCRM(conciergeries: ConciergerieParsed[], workspaceId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log("\nScraping detail pages for contact info...");

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < conciergeries.length; i++) {
    const c = conciergeries[i];
    process.stdout.write(`\r  [${i + 1}/${conciergeries.length}] ${c.name.slice(0, 40).padEnd(40)}...`);

    // Check if already exists (by name + company match)
    const { data: existing } = await supabase
      .from("prospects")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("company", c.name)
      .limit(1);

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    // Scrape detail page for contact info
    let detail: DetailInfo = {};
    try {
      detail = await scrapeDetailPage(c.url);
      // Small delay to be polite
      await new Promise((r) => setTimeout(r, 300));
    } catch {
      // Continue without detail info
    }

    const email = detail.email || `contact@${c.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-")}.fr`;

    const { error } = await supabase.from("prospects").insert({
      workspace_id: workspaceId,
      email,
      first_name: c.name.split(" ")[0] || "Conciergerie",
      last_name: c.name.split(" ").slice(1).join(" ") || c.name,
      company: c.name,
      job_title: "Conciergerie",
      phone: detail.phone || null,
      website: detail.website || c.url,
      location: c.city ? `${c.city}${c.postalCode ? ` (${c.postalCode})` : ""}` : null,
      linkedin_url: null,
      source: "scraper" as const,
      status: "active" as const,
      tags: [c.isPartner ? "cocoonr-partenaire" : "cocoonr-agence", "conciergerie"],
      custom_fields: {
        cocoonr_url: c.url,
        latitude: c.lat || null,
        longitude: c.lng || null,
        full_address: c.address,
        description: detail.description || null,
        scraped_from: "cocoonr.fr/conciergeries",
        scraped_at: new Date().toISOString(),
      },
    });

    if (error) {
      errors++;
      if (i < 5) console.error(`\n  Error inserting ${c.name}:`, error.message);
    } else {
      inserted++;
    }
  }

  console.log(`\n\nDone!`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (already exist): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total processed: ${conciergeries.length}`);
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8230;/g, "…");
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------
async function main() {
  console.log("=== Cocoonr Conciergeries Scraper ===\n");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    process.exit(1);
  }

  // Get workspace ID
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Find the first workspace (or specify one)
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .limit(5);

  if (!workspaces || workspaces.length === 0) {
    console.error("No workspaces found in database");
    process.exit(1);
  }

  const workspace = workspaces[0];
  console.log(`Using workspace: ${workspace.name} (${workspace.id})\n`);

  // Step 1: Fetch and parse conciergeries
  const conciergeries = await fetchConciergeries();

  if (conciergeries.length === 0) {
    console.error("No conciergeries found. The page structure may have changed.");
    process.exit(1);
  }

  // Step 2: Insert into CRM
  await insertIntoCRM(conciergeries, workspace.id);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
