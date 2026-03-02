import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

// ─── Number Parsing ─────────────────────────────────────────────────────────

/** Parse Hostinfly numbers: "7 636" → 7636, "4,4" → 4.4, "81.08K" → 81080 */
function parseHNumber(val: string | undefined | null): number | null {
  if (!val || val.trim() === '') return null;
  let s = val.trim();
  // Handle K/M suffix
  const multiplier = s.endsWith('K') ? 1000 : s.endsWith('M') ? 1000000 : 1;
  if (multiplier > 1) s = s.slice(0, -1);
  // Replace comma decimal with dot, remove space thousands
  s = s.replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.round(n * multiplier);
}

/** Parse review score: "4,4" → 4.4 (keep decimal) */
function parseScore(val: string | undefined | null): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val.trim().replace(',', '.'));
  return isNaN(n) ? null : Math.round(n * 10) / 10;
}

// ─── Name/Domain Helpers ────────────────────────────────────────────────────

function splitName(name: string): { firstName: string; lastName: string } {
  if (!name || name.trim() === '') return { firstName: '', lastName: '' };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizeDomain(raw: string): string {
  if (!raw) return '';
  return raw.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/+$/, '').trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function normalizePhone(phone: string): string {
  // Return last 9 digits for matching
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

function extractFirst(val: string | undefined | null, separator = ','): string {
  if (!val || val.trim() === '') return '';
  // Take first value from comma or newline separated list
  const first = val.split(separator)[0]?.trim() || '';
  return first;
}

function extractFirstUrl(val: string | undefined | null): string {
  if (!val || val.trim() === '') return '';
  // URLs may be comma-separated
  const first = val.split(',')[0]?.trim() || '';
  // Only return if it looks like a URL
  if (first.startsWith('http') || first.startsWith('www.')) return first;
  return '';
}

/** Convert a domain name to a readable company name.
 *  e.g. "chaletsdevalloire.com" → "Chaletsdevalloire"
 *       "ouest-ocean.com" → "Ouest Ocean"
 *       "ibis.accor.com" → "Ibis Accor"
 */
function domainToCompanyName(domain: string): string {
  if (!domain) return '';
  const KNOWN_TLDS = new Set(['com','fr','net','org','eu','ch','io','me','uk','de','it','es','be','nl','at','co']);
  // Remove www prefix
  let d = domain.toLowerCase().replace(/^(www\.)?/, '').trim();
  if (!d) return '';
  // Split by dots and remove known TLD parts from the end
  const parts = d.split('.');
  while (parts.length > 1 && KNOWN_TLDS.has(parts[parts.length - 1])) {
    parts.pop();
  }
  if (parts.length === 0) return '';
  // Join remaining parts, replace dashes/underscores with spaces, capitalize
  const words = parts.join(' ').replace(/[-_]+/g, ' ').trim();
  return words.replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main Import ────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = createAdminClient();

  // 1. Get workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 500 });
  }

  // 2. Read CSV file
  const csvPath = path.resolve('/root/ProjectList/Hostinfly-BDD---Directory-August-2021.csv/Hostinfly BDD - Directory August 2021.csv');
  if (!fs.existsSync(csvPath)) {
    return NextResponse.json({ error: 'CSV file not found at ' + csvPath }, { status: 404 });
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // The CSV has 2 junk rows before the actual header (row 3)
  const lines = csvContent.split('\n');
  const dataContent = lines.slice(2).join('\n'); // Skip first 2 rows

  const parsed = Papa.parse(dataContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (parsed.errors.length > 5) {
    return NextResponse.json({
      error: 'Too many CSV parse errors',
      details: parsed.errors.slice(0, 10)
    }, { status: 400 });
  }

  // 3. Load existing prospects for dedup
  const { data: existing } = await supabase
    .from('prospects')
    .select('id, email, website, company, organization, phone, custom_fields')
    .eq('workspace_id', workspace.id);

  // Build dedup indexes
  const emailIndex = new Map<string, any>();
  const domainIndex = new Map<string, any>();
  const companyIndex = new Map<string, any>();
  const phoneIndex = new Map<string, any>();

  for (const p of existing || []) {
    // Email index (skip placeholders)
    if (p.email && !p.email.includes('@crm-import.local') && !p.email.includes('@directory-import.local')) {
      emailIndex.set(p.email.toLowerCase(), p);
    }
    // Domain index
    if (p.website) {
      const dom = normalizeDomain(p.website);
      if (dom) domainIndex.set(dom, p);
    }
    // Company/org index
    const compName = (p.organization || p.company || '').toLowerCase().trim();
    if (compName && compName.length > 2) {
      companyIndex.set(compName, p);
    }
    // Phone index (last 9 digits)
    if (p.phone) {
      const norm = normalizePhone(p.phone);
      if (norm.length >= 9) phoneIndex.set(norm, p);
    }
  }

  // 4. Parse rows and build prospects
  const stats = {
    total: 0, inserted: 0, merged: 0, skipped: 0, errors: 0,
    errorDetails: [] as string[]
  };
  const newProspects: Array<Record<string, unknown>> = [];
  const mergeUpdates: Array<{ id: string; data: Record<string, unknown>; linkedin_url_fill: string | null; job_title_fill: string | null; phone_fill: string | null; nb_properties_fill: number | null }> = [];
  const emailsSeen = new Set<string>();

  for (const row of parsed.data as Record<string, string>[]) {
    const domain = (row['PM Domain Name'] || '').trim();
    if (!domain || domain === '') continue;

    stats.total++;

    const normalizedDom = normalizeDomain(domain);
    const name = (row['Name'] || '').trim();
    const { firstName, lastName } = splitName(name);
    const title = (row['Title'] || '').trim();
    const directEmail = (row['Email'] || '').trim().toLowerCase();
    const indexedEmails = (row['Indexed Emails'] || '').trim();
    const phoneRaw = (row['Phone numbers'] || '').trim();
    const phone = extractFirst(phoneRaw) || extractFirst(row['Indexed Phone numbers'] || '');
    const linkedinContact = (row['Linkedin Contact Profile'] || '').trim();
    const linkedinCompany = (row['Linkedin Company Page'] || '').trim();
    const address = (row['Company Address'] || '').trim();
    const maxListings = parseHNumber(row['Max Listings']);
    const reviewScore = parseScore(row['Review Score']);
    const reviewCount = parseHNumber(row['Review Count']);
    const country1 = (row['Country 1'] || 'France').trim();
    const hostName = (row['Property Manager Host Name Example'] || '').trim();

    // OTA listings
    const otaListings: Record<string, number | null> = {
      airbnb: parseHNumber(row['AIRBNB']),
      booking: parseHNumber(row['BOOKING']),
      homeaway: parseHNumber(row['HOMEAWAY']),
      tripadvisor: parseHNumber(row['TRIPADVISOR']),
    };

    // Cities
    const cities: string[] = [];
    for (let c = 1; c <= 5; c++) {
      const city = (row[`City ${c}`] || row[`city${c}`] || '').trim();
      if (city) cities.push(city);
    }

    // Social media
    const socialMedia: Record<string, string> = {};
    const tw = extractFirstUrl(row['Twitter']);
    const fb = extractFirstUrl(row['Facebook']);
    const ig = extractFirstUrl(row['Instagram']);
    if (tw) socialMedia.twitter = tw;
    if (fb) socialMedia.facebook = fb;
    if (ig) socialMedia.instagram = ig;

    const pms = (row['Services / PMS 1'] || '').trim();
    const traffic = (row['Total Visits (estimated January 2019)'] || '').trim();

    // Build enrichment custom_fields
    const enrichmentFields: Record<string, unknown> = {
      enriched_from_directory: true,
      directory_domain: normalizedDom,
    };
    if (otaListings.airbnb || otaListings.booking || otaListings.homeaway || otaListings.tripadvisor) {
      enrichmentFields.ota_listings = otaListings;
    }
    if (reviewScore !== null) enrichmentFields.review_score = reviewScore;
    if (reviewCount !== null) enrichmentFields.review_count = reviewCount;
    if (cities.length > 0) enrichmentFields.cities = cities;
    if (Object.keys(socialMedia).length > 0) enrichmentFields.social_media = socialMedia;
    if (linkedinCompany) enrichmentFields.linkedin_company = linkedinCompany;
    if (pms) enrichmentFields.pms = pms;
    if (traffic) enrichmentFields.website_traffic = traffic;

    // ─── Dedup Check ──────────────────────────────────────────────────────

    const realEmail = directEmail && directEmail.includes('@') && !directEmail.includes('exemple')
      ? directEmail : '';
    // Also check indexed emails for a real one
    const altEmail = !realEmail && indexedEmails
      ? (indexedEmails.split(',').find(e => e.trim().includes('@') && !e.includes('exemple'))?.trim().toLowerCase() || '')
      : '';
    const bestEmail = realEmail || altEmail;

    let matchedProspect: any = null;
    let matchType = '';

    // Priority 1: Email match
    if (bestEmail && emailIndex.has(bestEmail)) {
      matchedProspect = emailIndex.get(bestEmail)!;
      matchType = 'email';
    }
    // Priority 2: Domain match
    if (!matchedProspect && normalizedDom && domainIndex.has(normalizedDom)) {
      matchedProspect = domainIndex.get(normalizedDom)!;
      matchType = 'domain';
    }
    // Priority 3: Company name match (use domain name as company)
    if (!matchedProspect) {
      const domParts = normalizedDom.split('.');
      const domBase = domParts[0] || '';
      if (domBase.length > 2 && companyIndex.has(domBase)) {
        matchedProspect = companyIndex.get(domBase)!;
        matchType = 'company';
      }
    }
    // Priority 4: Phone match
    if (!matchedProspect && phone) {
      const normPhone = normalizePhone(phone);
      if (normPhone.length >= 9 && phoneIndex.has(normPhone)) {
        matchedProspect = phoneIndex.get(normPhone)!;
        matchType = 'phone';
      }
    }

    if (matchedProspect) {
      // MERGE: existing prospect gets enrichment data added
      const existingCF = (matchedProspect.custom_fields as Record<string, unknown>) || {};
      const mergedCF = { ...existingCF, ...enrichmentFields };

      const updateData: Record<string, unknown> = {
        custom_fields: mergedCF,
      };
      // Fill in fields that are null in existing
      if (!matchedProspect.website && normalizedDom) {
        updateData.website = `https://${normalizedDom}`;
      }

      mergeUpdates.push({
        id: matchedProspect.id as string,
        data: updateData,
        linkedin_url_fill: linkedinContact || null,
        job_title_fill: title || null,
        phone_fill: phone || null,
        nb_properties_fill: maxListings,
      });
      stats.merged++;
      continue;
    }

    // NEW PROSPECT - no match found
    const domSlug = slugify(normalizedDom || domain);
    let email = bestEmail || `${domSlug}@directory-import.local`;

    if (emailsSeen.has(email)) {
      email = `${domSlug}-${stats.total}@directory-import.local`;
    }
    emailsSeen.add(email);

    const customFields: Record<string, unknown> = {
      ...enrichmentFields,
      needs_email: !bestEmail,
    };

    newProspects.push({
      workspace_id: workspace.id,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      company: hostName || domainToCompanyName(normalizedDom) || null,
      organization: normalizedDom || null,
      job_title: title || null,
      phone: phone || null,
      linkedin_url: linkedinContact || null,
      website: normalizedDom ? `https://${normalizedDom}` : null,
      location: address || null,
      country: country1 || 'France',
      nb_properties: maxListings,
      pipeline_stage: 'to_contact',
      status: 'active',
      source: 'directory_import',
      custom_fields: customFields,
    });
  }

  // 5. Execute merge updates
  for (const update of mergeUpdates) {
    const { id, data, linkedin_url_fill, job_title_fill, phone_fill, nb_properties_fill } = update;

    // Build conditional update - only fill null fields
    const updateObj: Record<string, unknown> = { custom_fields: data.custom_fields };
    if (data.website) updateObj.website = data.website;

    // For these fields, we need to check if they're null first
    // We'll do a read-then-write for simplicity (3500 records is fine)
    const { data: current } = await supabase
      .from('prospects')
      .select('linkedin_url, job_title, phone, nb_properties')
      .eq('id', id)
      .single();

    if (current) {
      if (!current.linkedin_url && linkedin_url_fill) updateObj.linkedin_url = linkedin_url_fill;
      if (!current.job_title && job_title_fill) updateObj.job_title = job_title_fill;
      if (!current.phone && phone_fill) updateObj.phone = phone_fill;
      if (!current.nb_properties && nb_properties_fill) updateObj.nb_properties = nb_properties_fill;
    }

    const { error } = await supabase
      .from('prospects')
      .update(updateObj)
      .eq('id', id);

    if (error) {
      stats.errors++;
      if (stats.errorDetails.length < 20) {
        stats.errorDetails.push(`MERGE ${id}: ${error.message}`);
      }
    }
  }

  // 6. Insert new prospects in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < newProspects.length; i += BATCH_SIZE) {
    const batch = newProspects.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('prospects')
      .upsert(batch, { onConflict: 'workspace_id,email', ignoreDuplicates: false });

    if (error) {
      // Fallback: insert one by one
      for (const prospect of batch) {
        const { error: singleError } = await supabase
          .from('prospects')
          .upsert(prospect, { onConflict: 'workspace_id,email', ignoreDuplicates: false });

        if (singleError) {
          stats.errors++;
          if (stats.errorDetails.length < 20) {
            stats.errorDetails.push(`${(prospect as any).email}: ${singleError.message}`);
          }
        } else {
          stats.inserted++;
        }
      }
    } else {
      stats.inserted += batch.length;
    }
  }

  // 7. Summary
  const { count: totalCount } = await supabase
    .from('prospects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id);

  return NextResponse.json({
    success: true,
    stats,
    summary: {
      totalInDB: totalCount || 0,
      csvRowsParsed: stats.total,
      newInserted: stats.inserted,
      mergedWithExisting: stats.merged,
      errors: stats.errors,
    },
  });
}
