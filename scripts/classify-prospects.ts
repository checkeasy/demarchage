/**
 * Bulk prospect classification script
 *
 * Sends all prospects to Claude AI in batches to classify them with the right contact_type badge.
 * Uses existing prospect data (no web enrichment) for fast, cost-effective classification.
 *
 * Usage: npx tsx scripts/classify-prospects.ts [--dry-run] [--batch-size=50] [--force]
 *
 * --dry-run   : Show what would be classified without updating DB
 * --batch-size : Number of prospects per AI call (default: 50)
 * --force     : Re-classify even prospects that already have a non-default contact_type
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ─── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '50');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const VALID_TYPES = ['prospect', 'lead_chaud', 'client', 'ancien_client', 'partenaire', 'concurrent', 'influenceur', 'a_recontacter', 'mauvaise_cible'] as const;

// ─── Fetch All Prospects ─────────────────────────────────────────────────────

async function fetchProspects(): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('prospects')
      .select('id, first_name, last_name, email, company, job_title, industry, city, country, website, linkedin_url, phone, tags, lead_score, custom_fields, contact_type, notes')
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Supabase fetch error: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return all;
}

// ─── AI Classification ─────────────────────────────────────────────────────

async function classifyBatch(prospects: any[]): Promise<Record<string, string>> {
  const prospectLines = prospects.map((p, i) => {
    const tags = p.tags?.length > 0 ? p.tags.join(', ') : 'aucun';
    const cf = p.custom_fields || {};
    const extras = [];
    if (cf.nb_properties) extras.push(`nb_biens: ${cf.nb_properties}`);
    if (cf.pms_used) extras.push(`PMS: ${cf.pms_used}`);
    if (cf.crm_status) extras.push(`CRM: ${cf.crm_status}`);
    if (cf.pipeline_stage) extras.push(`pipeline: ${cf.pipeline_stage}`);
    const extrasStr = extras.length > 0 ? ` | ${extras.join(', ')}` : '';

    return `[${i}] ID:${p.id} | ${p.first_name || ''} ${p.last_name || ''} | ${p.email || ''} | Entreprise: ${p.company || '?'} | Poste: ${p.job_title || '?'} | Secteur: ${p.industry || '?'} | Ville: ${p.city || '?'} ${p.country || ''} | Site: ${p.website || '?'} | LinkedIn: ${p.linkedin_url ? 'oui' : 'non'} | Score: ${p.lead_score ?? '?'} | Tags: ${tags}${extrasStr}`;
  });

  const prompt = `Tu es un analyste expert en classification de prospects pour CheckEasy, une solution SaaS pour les conciergeries et la location courte duree.

CONTEXTE PRODUIT :
CheckEasy cible les conciergeries, property managers, gestionnaires locatifs, et tout professionnel de la location courte duree (Airbnb, Booking, etc.).

MISSION :
Classe chaque prospect ci-dessous dans UNE des categories suivantes :

- "prospect" : Contact pertinent dans notre cible, en debut de prospection (DEFAUT)
- "lead_chaud" : Signaux forts de besoin urgent — beaucoup de biens sans PMS, mauvais avis, forte presence OTA, score ICP eleve (>=70)
- "partenaire" : Acteur complementaire — PMS (Guesty, Lodgify, Hostaway...), channel manager, plateforme tech, OTA manager, agence marketing hospitality. PAS un client, un partenaire potentiel.
- "concurrent" : Fait exactement la meme chose que CheckEasy — conciergerie digitale, SaaS gestion locative, logiciel de conciergerie
- "influenceur" : Media, blog, podcast, personnalite publique dans l'hospitality/location courte duree
- "a_recontacter" : Profil pertinent mais pas pret maintenant — conciergerie en creation, projet futur, pas encore lance
- "mauvaise_cible" : Completement hors cible — restaurant, garage, coiffeur, dentiste, etc. Aucun rapport avec la location courte duree.

REGLES STRICTES :
1. Une conciergerie classique qui gere des biens = "prospect" (ou "lead_chaud" si signaux forts)
2. Un property manager avec beaucoup de biens et pas de PMS = "lead_chaud"
3. Guesty, Lodgify, Hostaway, Smoobu, Avantio = "partenaire" (ce sont des PMS)
4. Un blog hospitality ou un influenceur voyage = "influenceur"
5. Une agence immo classique SANS location courte duree = "a_recontacter" (potentiel futur)
6. Si tu vois des tags comme "type:mauvaise_cible" ou score tres bas avec aucun signal = "mauvaise_cible"
7. En cas de doute → "prospect"

PROSPECTS A CLASSER :
${prospectLines.join('\n')}

REPONDS EN JSON STRICT, un objet avec les IDs comme cles et les contact_type comme valeurs :
{"id1": "prospect", "id2": "lead_chaud", ...}

Pas de texte, pas d'explication, UNIQUEMENT le JSON.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = (jsonMatch[1] || text).trim();

  try {
    const parsed = JSON.parse(jsonStr);
    // Validate all values
    const result: Record<string, string> = {};
    for (const [id, type] of Object.entries(parsed)) {
      if (VALID_TYPES.includes(type as any)) {
        result[id] = type as string;
      }
    }
    return result;
  } catch (e) {
    console.error('  [!] Failed to parse AI response, skipping batch');
    console.error('  Response:', text.substring(0, 200));
    return {};
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Classification des prospects par IA ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pas de modification)' : 'REEL'}`);
  console.log(`Force re-classification: ${FORCE ? 'OUI' : 'NON (seulement les "prospect" par defaut)'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  // 1. Fetch all prospects
  console.log('Chargement des prospects...');
  let prospects = await fetchProspects();
  console.log(`  ${prospects.length} prospects trouves au total`);

  // 2. Filter to only those needing classification
  if (!FORCE) {
    prospects = prospects.filter(p => !p.contact_type || p.contact_type === 'prospect');
    console.log(`  ${prospects.length} prospects a classifier (contact_type = "prospect" ou null)`);
  }

  if (prospects.length === 0) {
    console.log('\nAucun prospect a classifier. Utilisez --force pour re-classifier tous les prospects.');
    return;
  }

  // 3. Process in batches
  const totalBatches = Math.ceil(prospects.length / BATCH_SIZE);
  console.log(`\nTraitement en ${totalBatches} lots de ${BATCH_SIZE}...\n`);

  const stats: Record<string, number> = {};
  VALID_TYPES.forEach(t => stats[t] = 0);
  let totalClassified = 0;
  let totalErrors = 0;

  for (let i = 0; i < totalBatches; i++) {
    const batch = prospects.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const pct = Math.round(((i + 1) / totalBatches) * 100);
    process.stdout.write(`  [${i + 1}/${totalBatches}] ${pct}% - ${batch.length} prospects... `);

    try {
      const classifications = await classifyBatch(batch);
      const classified = Object.keys(classifications).length;
      totalClassified += classified;

      // Count stats
      for (const type of Object.values(classifications)) {
        stats[type] = (stats[type] || 0) + 1;
      }

      // Update DB
      if (!DRY_RUN) {
        // Group by contact_type for bulk updates
        const byType: Record<string, string[]> = {};
        for (const [id, type] of Object.entries(classifications)) {
          if (!byType[type]) byType[type] = [];
          byType[type].push(id);
        }

        for (const [type, ids] of Object.entries(byType)) {
          // Update in chunks of 200 to avoid query limits
          for (let j = 0; j < ids.length; j += 200) {
            const chunk = ids.slice(j, j + 200);
            const { error } = await supabase
              .from('prospects')
              .update({ contact_type: type })
              .in('id', chunk);
            if (error) {
              console.error(`\n  [!] DB update error for type "${type}": ${error.message}`);
              totalErrors++;
            }
          }
        }
      }

      console.log(`${classified} classes`);
    } catch (err: any) {
      console.log(`ERREUR: ${err.message}`);
      totalErrors++;
      // Rate limit? Wait and retry
      if (err.message?.includes('429') || err.message?.includes('rate')) {
        console.log('  Pause 30s (rate limit)...');
        await new Promise(r => setTimeout(r, 30000));
        i--; // Retry this batch
      }
    }
  }

  // 4. Summary
  console.log('\n=== RESULTATS ===');
  console.log(`Total classes: ${totalClassified}`);
  console.log(`Erreurs: ${totalErrors}`);
  console.log('');
  console.log('Repartition:');
  for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    if (count > 0) {
      const bar = '█'.repeat(Math.max(1, Math.round(count / Math.max(...Object.values(stats)) * 30)));
      console.log(`  ${type.padEnd(18)} ${String(count).padStart(5)} ${bar}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Aucune modification effectuee. Relancez sans --dry-run pour appliquer.');
  }
}

main().catch(console.error);
