#!/usr/bin/env node
/**
 * Import CRM CSV (Pipedrive export) into Supabase prospects table
 * Usage: node scripts/import-crm.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://eykdqbpdxyowpvbflzcn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5a2RxYnBkeHlvd3B2YmZsemNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAzODU2MSwiZXhwIjoyMDg3NjE0NTYxfQ.-DLbpigJBceHqm8emYK4QETl2t9xzOkp7q2kBzqT2o8',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

function mapStatus(statut) {
  const s = statut.toLowerCase().trim();
  if (s.includes('gagnée') || s.includes('gagnee')) return 'converted';
  return 'active'; // Perdue + En cours both map to active (CHECK constraint)
}

function mapPipelineStage(etape) {
  const e = etape.toLowerCase().trim();
  if (e.includes('contacter') && !e.includes('effectu')) return 'to_contact';
  if (e.includes('contact effectu')) return 'contacted';
  if (e.includes('gociation') || e.includes('gociations')) return 'negotiation';
  if (e.includes('mo programm')) return 'demo_scheduled';
  if (e.includes('monstration effectu')) return 'demo_done';
  if (e.includes('inscription')) return 'contacted';
  if (e.includes('essai')) return 'trial';
  if (e.includes('client')) return 'client';
  if (e.includes('stand-by') || e.includes('stanby')) return 'standby';
  if (e.includes('perdu mais') || e.includes('relancer')) return 'lost_recontact';
  if (e.includes('perdu')) return 'lost';
  return 'to_contact';
}

function splitName(name) {
  if (!name || name.trim() === ':)' || name.trim() === '') return { firstName: null, lastName: null };
  const cleaned = name.trim();
  if (cleaned.includes('@')) return { firstName: cleaned, lastName: null };
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function firstNonEmpty(...vals) {
  for (const v of vals) { if (v && v.trim() !== '') return v.trim(); }
  return '';
}

function parseCountry(pays) {
  if (!pays || pays.trim() === '') return 'France';
  const p = pays.toLowerCase();
  if (p.includes('france')) return 'France';
  if (p.includes('espagne') || p.includes('spain')) return 'Espagne';
  if (p.includes('portugal')) return 'Portugal';
  if (p.includes('italie') || p.includes('italy')) return 'Italie';
  if (p.includes('suisse')) return 'Suisse';
  return pays.split(',')[0].trim();
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== CRM Import Script ===\n');

  // 1. Get workspace
  const { data: ws } = await supabase.from('workspaces').select('id').limit(1).single();
  if (!ws) { console.error('No workspace found!'); process.exit(1); }
  console.log('Workspace:', ws.id);

  // 2. Read CSV
  const csvPath = path.resolve('/root/ProjectList/dmearchage---deal-list.csv/dmearchage - deal list.csv');
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  const headers = parseCSVLine(lines[0]);

  const colIdx = {};
  headers.forEach((h, i) => { colIdx[h.trim()] = i; });
  const getCol = (row, name) => { const i = colIdx[name]; return i !== undefined ? (row[i] || '').trim() : ''; };

  console.log(`CSV headers found: ${headers.length}`);
  console.log(`Data rows: ${lines.length - 1}\n`);

  // 3. Parse rows
  const prospects = [];
  const emailsSeen = new Set();
  let parseErrors = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 5) { parseErrors++; continue; }

    const statut = getCol(row, 'Affaire - Statut');
    const raisonPerte = getCol(row, 'Affaire - Raison de la perte');
    const titre = getCol(row, 'Affaire - Titre');
    const personne = getCol(row, 'Affaire - Personne à contacter');
    const etape = getCol(row, 'Affaire - Étape');
    const nbLogements = getCol(row, 'Affaire - Nombre de logements');
    const sourceLeadRaw = getCol(row, 'Affaire - Source du lead');
    const pays = getCol(row, 'Affaire - Pays');
    const region = getCol(row, 'Affaire - Région');
    const standing = getCol(row, 'Affaire - Standing des biens');
    const typeBiens = getCol(row, 'Affaire - Type de biens');
    const typeConciergerie = getCol(row, 'Affaire - Type de conciergerie');
    const visionConciergerie = getCol(row, 'Affaire - Vision de la conciergerie');
    const orgName = getCol(row, 'Affaire - Organisation');

    const phone = firstNonEmpty(
      getCol(row, 'Personne - Téléphone - Mobile'),
      getCol(row, 'Personne - Téléphone - Travail'),
      getCol(row, 'Personne - Téléphone - Domicile'),
      getCol(row, 'Personne - Téléphone - Autre')
    );

    const realEmail = firstNonEmpty(
      getCol(row, 'Personne - E-mail - Travail'),
      getCol(row, 'Personne - E-mail - Domicile'),
      getCol(row, 'Personne - E-mail - Autre')
    );

    const { firstName, lastName } = splitName(personne);

    // Generate unique email
    const orgSlug = slugify(orgName || titre || `prospect-${i}`);
    let email = (realEmail && realEmail.includes('@')) ? realEmail.toLowerCase() : `${orgSlug}@crm-import.local`;
    if (emailsSeen.has(email)) {
      email = `${orgSlug}-${i}@crm-import.local`;
    }
    emailsSeen.add(email);

    // Location: check for second "Affaire - Région" column (duplicate header)
    let location = region;
    if (!location) {
      const secondLast = row[row.length - 2]?.trim();
      if (secondLast && !secondLast.match(/^\d{4}/) && secondLast.length > 2) {
        location = secondLast;
      }
    }

    // CRM status
    const crmStatus = statut.toLowerCase().includes('perdue') ? 'lost'
      : (statut.toLowerCase().includes('gagn')) ? 'converted'
      : 'active';

    const pipelineStage = mapPipelineStage(etape || (crmStatus === 'lost' ? 'lost' : 'to_contact'));

    // Build custom_fields
    const cf = {
      crm_status: crmStatus,
      pipeline_stage: pipelineStage,
      country: parseCountry(pays),
      organization: orgName || null,
      nb_properties: nbLogements ? parseInt(nbLogements) || null : null,
      loss_reason: (crmStatus === 'lost' && raisonPerte) ? raisonPerte : null,
      deal_title: titre || null,
      source_lead_original: sourceLeadRaw || null,
      needs_email: !realEmail || !realEmail.includes('@'),
    };
    if (standing) cf.standing = standing;
    if (typeBiens) cf.type_biens = typeBiens;
    if (typeConciergerie) cf.type_conciergerie = typeConciergerie;
    if (visionConciergerie) cf.vision_conciergerie = visionConciergerie;

    prospects.push({
      workspace_id: ws.id,
      email,
      first_name: firstName,
      last_name: lastName,
      company: orgName || null,
      job_title: null,
      phone: phone || null,
      linkedin_url: null,
      website: null,
      location: location || null,
      status: mapStatus(statut),
      source: 'csv_import',
      custom_fields: cf,
    });
  }

  console.log(`Parsed: ${prospects.length} prospects (${parseErrors} parse errors)`);

  // 4. Insert in batches
  const BATCH = 50;
  let ok = 0, errors = 0;

  for (let i = 0; i < prospects.length; i += BATCH) {
    const batch = prospects.slice(i, i + BATCH);
    const { error } = await supabase.from('prospects')
      .upsert(batch, { onConflict: 'workspace_id,email', ignoreDuplicates: false });

    if (error) {
      // Batch failed, try one by one
      for (const p of batch) {
        const { error: e2 } = await supabase.from('prospects')
          .upsert(p, { onConflict: 'workspace_id,email', ignoreDuplicates: false });
        if (e2) {
          errors++;
          if (errors <= 5) console.log(`  ERROR [${p.email}]: ${e2.message}`);
        } else {
          ok++;
        }
      }
    } else {
      ok += batch.length;
    }

    if ((i + BATCH) % 200 === 0 || i + BATCH >= prospects.length) {
      console.log(`  Progress: ${Math.min(i + BATCH, prospects.length)}/${prospects.length} (${ok} ok, ${errors} errors)`);
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Total parsed: ${prospects.length}`);
  console.log(`Inserted/Updated: ${ok}`);
  console.log(`Errors: ${errors}`);

  // 5. Summary
  const { data: summary } = await supabase.from('prospects')
    .select('status, custom_fields')
    .eq('workspace_id', ws.id)
    .eq('source', 'csv_import');

  const statusCounts = {};
  const countryCounts = {};
  const pipelineCounts = {};
  let withEmail = 0, withPhone = 0;

  for (const p of summary || []) {
    const cf = p.custom_fields || {};
    statusCounts[cf.crm_status || 'unknown'] = (statusCounts[cf.crm_status || 'unknown'] || 0) + 1;
    countryCounts[cf.country || 'Unknown'] = (countryCounts[cf.country || 'Unknown'] || 0) + 1;
    pipelineCounts[cf.pipeline_stage || 'unknown'] = (pipelineCounts[cf.pipeline_stage || 'unknown'] || 0) + 1;
    if (!cf.needs_email) withEmail++;
  }

  const { data: phonedP } = await supabase.from('prospects')
    .select('phone').eq('workspace_id', ws.id).eq('source', 'csv_import').not('phone', 'is', null);
  withPhone = phonedP?.length || 0;

  console.log(`\n=== Summary (in DB) ===`);
  console.log(`Total CRM prospects: ${summary?.length || 0}`);
  console.log(`By CRM status:`, JSON.stringify(statusCounts));
  console.log(`By country:`, JSON.stringify(countryCounts));
  console.log(`By pipeline:`, JSON.stringify(pipelineCounts));
  console.log(`With real email: ${withEmail}`);
  console.log(`With phone: ${withPhone}`);

  process.exit(0);
})();
