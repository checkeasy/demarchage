/**
 * Enrichissement direct des conciergeries
 * Visite directement le domaine de l'email pour trouver telephone, site web, infos
 * Usage: node scripts/enrich-direct.mjs [--skip N] [--batch N]
 */

import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const WS = '83da732a-a933-4ed4-a815-3f975c8ff0c6';

const args = process.argv.slice(2);
const skipIndex = args.indexOf('--skip');
const SKIP = skipIndex >= 0 ? parseInt(args[skipIndex + 1]) || 0 : 0;
const batchIndex = args.indexOf('--batch');
const BATCH = batchIndex >= 0 ? parseInt(args[batchIndex + 1]) || 999 : 999;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

const ISP_DOMAINS = new Set([
  'gmail.com', 'yahoo.fr', 'yahoo.com', 'hotmail.com', 'hotmail.fr',
  'outlook.com', 'outlook.fr', 'live.fr', 'live.com',
  'wanadoo.fr', 'orange.fr', 'free.fr', 'sfr.fr', 'laposte.net',
  'icloud.com', 'me.com', 'aol.com', 'mail.com', 'gmx.fr', 'gmx.com',
  'protonmail.com', 'pm.me', 'bbox.fr', 'numericable.fr',
]);

const COCOONR_PHONES = new Set(['0928389844', '0434782610', '+33928389844', '+33434782610']);

// =========================================================================
// Scrape a website for contact info
// =========================================================================
async function scrapeWebsite(url) {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const info = { url: res.url || url, reachable: true };

    // Email - from mailto links first, then regex
    const mailtoMatch = html.match(/href="mailto:([^"?]+)/i);
    if (mailtoMatch) {
      const e = mailtoMatch[1].toLowerCase().trim();
      if (!e.includes('exemple') && !e.includes('example')) {
        info.email = e;
      }
    }
    if (!info.email) {
      const emailRegex = /([\w.+-]+@[\w-]+\.(?:fr|com|net|org|eu|io))/gi;
      const allEmails = [...html.matchAll(emailRegex)].map(m => m[1].toLowerCase());
      const goodEmails = allEmails.filter(e =>
        !e.includes('wix') && !e.includes('sentry') && !e.includes('wordpress') &&
        !e.includes('example') && !e.includes('exemple') && !e.includes('cookie') &&
        !e.includes('@sentry') && !e.includes('noreply')
      );
      if (goodEmails.length > 0) info.email = goodEmails[0];
      if (goodEmails.length > 1) info.allEmails = [...new Set(goodEmails)].slice(0, 5);
    }

    // Phone - from tel: links first, then regex
    const telMatches = [...html.matchAll(/href="tel:([^"]+)"/gi)].map(m =>
      m[1].replace(/[\s.\-()]/g, '')
    ).filter(p => !COCOONR_PHONES.has(p));

    if (telMatches.length > 0) {
      info.phone = telMatches[0];
    } else {
      const phoneRegex = /((?:\+33|0)[1-9](?:[\s.\-]?\d{2}){4})/g;
      const allPhones = [...html.matchAll(phoneRegex)]
        .map(m => m[1].replace(/[\s.\-]/g, ''))
        .filter(p => !COCOONR_PHONES.has(p));
      if (allPhones.length > 0) info.phone = allPhones[0];
    }

    // Description
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
                      html.match(/<meta\s+content="([^"]+)"\s+name="description"/i);
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
    const linkedinMatch = html.match(/href="(https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"]+)"/i);
    if (linkedinMatch) socials.linkedin = linkedinMatch[1];
    if (Object.keys(socials).length > 0) info.socials = socials;

    // Address
    const addrMatch = html.match(/(?:adresse|address|siège)[^<]*<[^>]*>([^<]+(?:\d{5})[^<]*)/i);
    if (addrMatch) info.address = addrMatch[1].trim().slice(0, 200);

    return info;
  } catch (e) {
    return null;
  }
}

// =========================================================================
// Try contact pages
// =========================================================================
async function tryContactPages(baseUrl) {
  const info = {};
  const base = new URL(baseUrl).origin;

  for (const path of ['/contact', '/nous-contacter', '/contactez-nous', '/a-propos', '/contact.html']) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();

      if (!info.email) {
        const cMailto = html.match(/href="mailto:([^"?]+)/i);
        if (cMailto) {
          const e = cMailto[1].toLowerCase();
          if (!e.includes('exemple') && !e.includes('example') && !e.includes('noreply')) {
            info.email = e;
          }
        }
        if (!info.email) {
          const cEmail = html.match(/([\w.+-]+@[\w-]+\.(?:fr|com|net|org|eu|io))/i);
          if (cEmail) {
            const e = cEmail[1].toLowerCase();
            if (!e.includes('wix') && !e.includes('sentry') && !e.includes('wordpress') && !e.includes('noreply')) {
              info.email = e;
            }
          }
        }
      }

      if (!info.phone) {
        const telMatches = [...html.matchAll(/href="tel:([^"]+)"/gi)]
          .map(m => m[1].replace(/[\s.\-()]/g, ''))
          .filter(p => !COCOONR_PHONES.has(p));
        if (telMatches.length > 0) {
          info.phone = telMatches[0];
        } else {
          const phoneMatch = html.match(/((?:\+33|0)[1-9](?:[\s.\-]?\d{2}){4})/);
          if (phoneMatch) {
            const p = phoneMatch[1].replace(/[\s.\-]/g, '');
            if (!COCOONR_PHONES.has(p)) info.phone = p;
          }
        }
      }

      if (info.email && info.phone) break;
    } catch { /* skip */ }
  }
  return info;
}

// =========================================================================
// Main
// =========================================================================
async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  ENRICHISSEMENT DIRECT (visite domaine)  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const { data: concs } = await sb.from('prospects')
    .select('id, company, email, phone, website, location, custom_fields')
    .eq('workspace_id', WS)
    .eq('job_title', 'Conciergerie')
    .order('company')
    .range(0, 999);

  if (!concs?.length) {
    console.log("Aucune conciergerie");
    return;
  }

  // Build list of domains to visit
  const toProcess = [];
  for (const c of concs) {
    if (!c.email || !c.email.includes('@')) continue;
    const domain = c.email.split('@')[1];
    if (ISP_DOMAINS.has(domain)) continue; // Skip ISP emails
    if (c.custom_fields?.direct_enriched_at) continue; // Already done

    const needsPhone = !c.phone;
    const needsWebsite = !c.website || c.website.includes('cocoonr');

    if (needsPhone || needsWebsite) {
      toProcess.push({
        ...c,
        domain,
        needsPhone,
        needsWebsite,
      });
    }
  }

  const batch = toProcess.slice(SKIP, SKIP + BATCH);

  console.log(`Total conciergeries: ${concs.length}`);
  console.log(`Avec domaine pro a visiter: ${toProcess.length}`);
  console.log(`Skip: ${SKIP}, Batch: ${BATCH}`);
  console.log(`Traitement: ${batch.length}\n`);

  let enrichedPhone = 0, enrichedWebsite = 0, enrichedEmail = 0;
  let reachable = 0, unreachable = 0;

  for (let i = 0; i < batch.length; i++) {
    const p = batch[i];
    const baseUrl = `https://www.${p.domain}`;
    const altUrl = `https://${p.domain}`;

    process.stdout.write(`\r[${String(i + 1 + SKIP).padStart(3)}/${toProcess.length}] ${p.company.slice(0, 35).padEnd(35)} → ${p.domain.slice(0, 30).padEnd(30)}`);

    // Try www first, then without www
    let info = await scrapeWebsite(baseUrl);
    if (!info) {
      info = await scrapeWebsite(altUrl);
    }

    const updates = {};
    const cfUpdates = { ...(p.custom_fields || {}) };
    let didUpdate = false;

    if (info && info.reachable) {
      reachable++;

      // Website
      if (p.needsWebsite && info.url) {
        updates.website = info.url;
        enrichedWebsite++;
        didUpdate = true;
      }

      // Phone
      if (p.needsPhone && info.phone) {
        updates.phone = info.phone;
        enrichedPhone++;
        didUpdate = true;
      }

      // Better email (if current is just contact@)
      if (info.email && p.email.startsWith('contact@') && info.email !== p.email) {
        // Store as alternative if different
        cfUpdates.alt_email = info.email;
      }
      if (info.allEmails) {
        cfUpdates.all_emails = info.allEmails;
      }

      // Try contact pages if missing info
      if (!info.phone || !info.email) {
        const contactInfo = await tryContactPages(info.url);
        if (contactInfo.phone && !info.phone && p.needsPhone) {
          updates.phone = contactInfo.phone;
          enrichedPhone++;
          didUpdate = true;
        }
        if (contactInfo.email && p.email.startsWith('contact@') && contactInfo.email !== p.email) {
          cfUpdates.alt_email = contactInfo.email;
        }
      }

      // Store metadata
      if (info.description) cfUpdates.description = info.description;
      if (info.siteTitle) cfUpdates.site_title = info.siteTitle;
      if (info.socials) cfUpdates.socials = info.socials;
      if (info.address) cfUpdates.address = info.address;

      const indicator = updates.phone ? 'P' : '-';
      const webInd = updates.website ? 'W' : '-';
      const extraInd = info.socials ? 'S' : '-';
      process.stdout.write(` [${indicator}${webInd}${extraInd}]`);
    } else {
      unreachable++;
      process.stdout.write(' [OFFLINE]');
    }

    cfUpdates.direct_enriched_at = new Date().toISOString();
    updates.custom_fields = cfUpdates;
    updates.updated_at = new Date().toISOString();

    await sb.from('prospects').update(updates).eq('id', p.id);

    // Small delay to be polite
    await sleep(300 + Math.random() * 200);

    // Progress report every 20
    if ((i + 1) % 20 === 0) {
      console.log(`\n  Progress: P=${enrichedPhone} W=${enrichedWebsite} reach=${reachable} offline=${unreachable}`);
    }
  }

  console.log(`\n\n${"=".repeat(55)}`);
  console.log(`ENRICHISSEMENT DIRECT TERMINE:`);
  console.log(`  Sites atteignables:   ${reachable}/${batch.length}`);
  console.log(`  Sites hors-ligne:     ${unreachable}`);
  console.log(`  Telephones trouves:   ${enrichedPhone}`);
  console.log(`  Sites web mis a jour: ${enrichedWebsite}`);
  console.log(`  Emails alternatifs:   ${enrichedEmail}`);
  console.log(`${"=".repeat(55)}\n`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
