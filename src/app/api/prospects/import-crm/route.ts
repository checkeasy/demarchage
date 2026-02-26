import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import * as fs from 'fs';
import * as path from 'path';

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

// ─── Mapping Helpers ─────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function mapStatus(statut: string): string {
  // Must fit existing CHECK: active, bounced, unsubscribed, replied, converted
  const s = statut.toLowerCase().trim();
  if (s === 'gagnée' || s === 'gagnee') return 'converted';
  // "Perdue" and "En cours" both map to "active" since we don't have 'lost' in CHECK yet
  // The real status is stored in custom_fields.crm_status
  return 'active';
}

function mapPipelineStage(etape: string): string {
  const e = etape.toLowerCase().trim();
  if (e.includes('contacter') && !e.includes('effectu')) return 'to_contact';
  if (e.includes('contact effectu')) return 'contacted';
  if (e.includes('négociation') || e.includes('negociation')) return 'negotiation';
  if (e.includes('démo programmée') || e.includes('demo programmee') || e.includes('démo programmé')) return 'demo_scheduled';
  if (e.includes('démonstration effectuée') || e.includes('demonstration effectuee') || e.includes('démonstration effectué')) return 'demo_done';
  if (e.includes('inscription')) return 'contacted';
  if (e.includes('période') || e.includes('periode') || e.includes('essai')) return 'trial';
  if (e.includes('client')) return 'client';
  if (e.includes('stand-by') || e.includes('standby') || e.includes('stanby')) return 'standby';
  if (e.includes('perdu mais') || e.includes('relancer')) return 'lost_recontact';
  if (e.includes('perdu')) return 'lost';
  return 'to_contact';
}

function splitContactName(name: string): { firstName: string; lastName: string } {
  if (!name || name.trim() === ':)' || name.trim() === '') return { firstName: '', lastName: '' };
  const cleaned = name.trim();
  if (cleaned.includes('@')) return { firstName: cleaned, lastName: '' };
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function extractFirstPhone(...phones: string[]): string {
  for (const p of phones) {
    if (p && p.trim() !== '') return p.trim();
  }
  return '';
}

function extractFirstEmail(...emails: string[]): string {
  for (const e of emails) {
    if (e && e.trim() !== '' && e.includes('@') && !e.includes('crm-import.local')) {
      return e.trim().toLowerCase();
    }
  }
  return '';
}

function parseCountry(paysField: string): string {
  if (!paysField || paysField.trim() === '') return 'France';
  const p = paysField.toLowerCase().trim();
  if (p.includes('france')) return 'France';
  if (p.includes('espagne') || p.includes('spain')) return 'Espagne';
  if (p.includes('portugal')) return 'Portugal';
  if (p.includes('italie') || p.includes('italy')) return 'Italie';
  if (p.includes('suisse')) return 'Suisse';
  if (p.includes('grèce') || p.includes('grece')) return 'Grece';
  return paysField.split(',')[0].trim();
}

// ─── Main Import ─────────────────────────────────────────────────────────────

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
  const csvPath = path.resolve('/root/ProjectList/dmearchage---deal-list.csv/dmearchage - deal list.csv');
  if (!fs.existsSync(csvPath)) {
    return NextResponse.json({ error: 'CSV file not found at ' + csvPath }, { status: 404 });
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
  const headers = parseCSVLine(lines[0]);

  // 3. Build column index
  const colIdx: Record<string, number> = {};
  headers.forEach((h, i) => { colIdx[h.trim()] = i; });

  const getCol = (row: string[], colName: string): string => {
    const idx = colIdx[colName];
    if (idx === undefined) return '';
    return (row[idx] || '').trim();
  };

  // 4. Parse all rows
  const stats = { total: 0, imported: 0, errors: 0, errorDetails: [] as string[] };
  const prospects: Array<Record<string, unknown>> = [];
  const emailsSeen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 5) continue;

    stats.total++;

    const statut = getCol(row, 'Affaire - Statut');
    const raisonPerte = getCol(row, 'Affaire - Raison de la perte');
    const titre = getCol(row, 'Affaire - Titre');
    const personne = getCol(row, 'Affaire - Personne à contacter');
    const etape = getCol(row, 'Affaire - Étape');
    const nbLogements = getCol(row, 'Affaire - Nombre de logements');
    const sourceLeadRaw = getCol(row, 'Affaire - Source du lead');
    const pays = getCol(row, 'Affaire - Pays');
    const region1 = getCol(row, 'Affaire - Région');
    const standing = getCol(row, 'Affaire - Standing des biens');
    const typeBiens = getCol(row, 'Affaire - Type de biens');
    const arriveeVoyageur = getCol(row, 'Affaire - Arrivée voyageur');
    const equipeMenage = getCol(row, 'Affaire - Equipe de ménage');
    const typeConciergerie = getCol(row, 'Affaire - Type de conciergerie');
    const utilisateurs = getCol(row, 'Affaire - Utilisateurs');
    const visionConciergerie = getCol(row, 'Affaire - Vision de la conciergerie');
    const orgName = getCol(row, 'Affaire - Organisation');

    const telTravail = getCol(row, 'Personne - Téléphone - Travail');
    const telDomicile = getCol(row, 'Personne - Téléphone - Domicile');
    const telMobile = getCol(row, 'Personne - Téléphone - Mobile');
    const telAutre = getCol(row, 'Personne - Téléphone - Autre');
    const emailTravail = getCol(row, 'Personne - E-mail - Travail');
    const emailDomicile = getCol(row, 'Personne - E-mail - Domicile');
    const emailAutre = getCol(row, 'Personne - E-mail - Autre');
    const updatedAt = getCol(row, 'Affaire - Heure de mise à jour');

    const { firstName, lastName } = splitContactName(personne);
    const realEmail = extractFirstEmail(emailTravail, emailDomicile, emailAutre);
    const phone = extractFirstPhone(telMobile, telTravail, telDomicile, telAutre);

    // Generate unique placeholder email if none found
    const orgSlug = slugify(orgName || titre || `prospect-${i}`);
    let email = realEmail || `${orgSlug}@crm-import.local`;

    // Handle duplicates within the CSV itself
    if (emailsSeen.has(email)) {
      email = `${orgSlug}-${i}@crm-import.local`;
    }
    emailsSeen.add(email);

    // Parse location - check for second "Affaire - Région" column
    let location = region1;
    if (!location && row.length > 1) {
      const secondRegion = row[row.length - 2]?.trim();
      if (secondRegion && !secondRegion.match(/^\d{4}/) && secondRegion.length > 2) {
        location = secondRegion;
      }
    }

    // Determine real CRM status (stored in custom_fields since DB CHECK is limited)
    const crmStatusRaw = statut.toLowerCase().trim();
    const crmStatus = crmStatusRaw === 'perdue' ? 'lost'
      : crmStatusRaw.includes('gagnée') || crmStatusRaw.includes('gagnee') ? 'converted'
      : 'active';

    const pipelineStage = mapPipelineStage(etape || (crmStatus === 'lost' ? 'lost' : 'to_contact'));
    // For DB status field, use the constrained value
    const dbStatus = mapStatus(statut);

    // Build custom_fields with ALL the extra CRM data
    const customFields: Record<string, unknown> = {
      // Core CRM fields that don't have dedicated columns yet
      crm_status: crmStatus, // The real status: lost, active, converted
      pipeline_stage: pipelineStage,
      country: parseCountry(pays),
      organization: orgName || null,
      nb_properties: nbLogements ? parseInt(nbLogements, 10) || null : null,
      loss_reason: (crmStatus === 'lost' && raisonPerte) ? raisonPerte : null,
      deal_title: titre || null,
      source_lead_original: sourceLeadRaw || null,
      needs_email: !realEmail,
    };

    // Optional CRM fields
    if (standing) customFields.standing = standing;
    if (typeBiens) customFields.type_biens = typeBiens;
    if (arriveeVoyageur) customFields.arrivee_voyageur = arriveeVoyageur;
    if (equipeMenage) customFields.equipe_menage = equipeMenage;
    if (typeConciergerie) customFields.type_conciergerie = typeConciergerie;
    if (utilisateurs) customFields.utilisateurs = utilisateurs;
    if (visionConciergerie) customFields.vision_conciergerie = visionConciergerie;

    prospects.push({
      workspace_id: workspace.id,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      company: orgName || null,
      job_title: null,
      phone: phone || null,
      linkedin_url: null,
      website: null,
      location: location || null,
      status: dbStatus,
      source: 'csv_import',
      custom_fields: customFields,
    });
  }

  // 5. Try inserting first prospect to detect errors early
  // V2 - Debug version
  if (prospects.length > 0) {
    const testProspect = prospects[0];
    const { error: testError } = await supabase
      .from('prospects')
      .upsert(testProspect, { onConflict: 'workspace_id,email', ignoreDuplicates: false });

    if (testError) {
      return NextResponse.json({
        success: false,
        error: `First prospect insert failed: ${testError.message}`,
        code: testError.code,
        details: testError.details,
        hint: testError.hint,
        testProspect: { email: testProspect.email, status: testProspect.status, source: testProspect.source },
      }, { status: 400 });
    }
    stats.imported = 1;
  }

  // 6. Insert remaining in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 1; i < prospects.length; i += BATCH_SIZE) {
    const batch = prospects.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('prospects')
      .upsert(batch, { onConflict: 'workspace_id,email', ignoreDuplicates: false });

    if (error) {
      stats.errorDetails.push(`BATCH ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
      for (const prospect of batch) {
        const { error: singleError } = await supabase
          .from('prospects')
          .upsert(prospect, { onConflict: 'workspace_id,email', ignoreDuplicates: false });

        if (singleError) {
          stats.errors++;
          if (stats.errorDetails.length < 20) {
            stats.errorDetails.push(`${prospect.email}: ${singleError.message}`);
          }
        } else {
          stats.imported++;
        }
      }
    } else {
      stats.imported += batch.length;
    }
  }

  // 6. Get summary counts
  const { count: totalCount } = await supabase
    .from('prospects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id);

  const { data: crmProspects } = await supabase
    .from('prospects')
    .select('status, custom_fields')
    .eq('workspace_id', workspace.id)
    .eq('source', 'csv_import');

  const crmStatusCounts: Record<string, number> = {};
  const countryCounts: Record<string, number> = {};
  const pipelineCounts: Record<string, number> = {};
  let hasEmail = 0;
  let hasPhone = 0;

  for (const p of crmProspects || []) {
    const cf = p.custom_fields as Record<string, unknown> || {};
    const cs = (cf.crm_status as string) || 'unknown';
    const country = (cf.country as string) || 'Unknown';
    const stage = (cf.pipeline_stage as string) || 'unknown';
    crmStatusCounts[cs] = (crmStatusCounts[cs] || 0) + 1;
    countryCounts[country] = (countryCounts[country] || 0) + 1;
    pipelineCounts[stage] = (pipelineCounts[stage] || 0) + 1;
    if (!cf.needs_email) hasEmail++;
  }

  // Count phones separately
  const { data: phonedProspects } = await supabase
    .from('prospects')
    .select('phone')
    .eq('workspace_id', workspace.id)
    .eq('source', 'csv_import')
    .not('phone', 'is', null);
  hasPhone = phonedProspects?.length || 0;

  return NextResponse.json({
    success: true,
    stats,
    summary: {
      totalInDB: totalCount || 0,
      crmImported: crmProspects?.length || 0,
      byStatus: crmStatusCounts,
      byCountry: countryCounts,
      byPipeline: pipelineCounts,
      withRealEmail: hasEmail,
      withPhone: hasPhone,
    },
  });
}
