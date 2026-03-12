/**
 * Bulk prospect cleanup script
 *
 * Phase 1: Quick filter — remove obvious non-targets based on data patterns
 * Phase 2: AI arbitrage — send ambiguous prospects to Claude for decision
 *
 * Usage: npx tsx scripts/clean-prospects.ts [--dry-run] [--ai-only] [--batch-size=50]
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
const AI_ONLY = args.includes('--ai-only');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '50');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ─── Phase 1: Quick Pattern-Based Filter ────────────────────────────────────

// Keywords that indicate clearly NOT a target for CheckEasy
const BLACKLIST_KEYWORDS = [
  // Food & drink
  'restaurant', 'pizzeria', 'brasserie', 'bistrot', 'traiteur', 'boulangerie',
  'patisserie', 'cafe', 'bar', 'pub', 'kebab', 'sushi', 'burger',
  // Health
  'dentiste', 'medecin', 'pharmacie', 'kine', 'osteopathe', 'veterinaire',
  'opticien', 'clinique', 'cabinet medical', 'infirmier',
  // Beauty & personal care
  'coiffeur', 'coiffure', 'salon de beaute', 'esthetique', 'barbier',
  'manucure', 'spa medical', 'tatoueur',
  // Auto
  'garage', 'carrosserie', 'auto ecole', 'controle technique', 'pneu',
  // Construction
  'plombier', 'electricien', 'peintre', 'maconnerie', 'couvreur',
  'menuisier', 'serrurier', 'chauffagiste',
  // Retail unrelated
  'fleuriste', 'tabac', 'pressing', 'cordonnerie', 'supermarche',
  'epicerie', 'librairie', 'animalerie', 'jardinerie',
  // Education
  'ecole', 'creche', 'garderie', 'auto-ecole',
  // Other services
  'avocat', 'notaire', 'comptable', 'assurance', 'banque',
  'pompes funebres', 'demenagement', 'taxi',
];

// Keywords that indicate a GOOD target
const WHITELIST_KEYWORDS = [
  'conciergerie', 'concierge', 'property manager', 'channel manager',
  'location courte', 'location saisonniere', 'location vacances',
  'airbnb', 'booking', 'gestion locative', 'gite', 'gîte',
  'meuble tourisme', 'chambre hote', 'hospitality',
  'rental', 'vacation rental', 'short term', 'apart hotel',
  'residence tourisme', 'hebergement', 'lodge', 'chalet',
];

// Industries that are definitely targets
const TARGET_INDUSTRIES = [
  'conciergerie', 'gestionnaire_locatif', 'location_vacances',
  'proprietaire_bailleur', 'hotel', 'hospitality',
];

interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  email: string | null;
  industry: string | null;
  website: string | null;
  tags: string[];
  custom_fields: Record<string, unknown> | null;
}

function classifyQuick(p: Prospect): 'delete' | 'keep' | 'ambiguous' {
  const text = [
    p.company,
    p.job_title,
    p.industry,
    p.first_name,
    p.last_name,
    ...(p.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Check whitelist first — if clearly a target, keep
  for (const kw of WHITELIST_KEYWORDS) {
    if (text.includes(kw)) return 'keep';
  }

  // Check if industry is a known target
  if (p.industry && TARGET_INDUSTRIES.includes(p.industry.toLowerCase())) {
    return 'keep';
  }

  // Check blacklist — if clearly NOT a target, delete
  for (const kw of BLACKLIST_KEYWORDS) {
    if (text.includes(kw)) return 'delete';
  }

  // TEST entries
  if (p.first_name?.toUpperCase() === 'TEST' || p.company?.toUpperCase() === 'TEST') {
    return 'delete';
  }

  // Empty profiles with no useful data
  if (!p.company && !p.job_title && !p.email && !p.first_name && !p.last_name) {
    return 'delete';
  }

  return 'ambiguous';
}

// ─── Phase 2: AI Batch Arbitrage ────────────────────────────────────────────

async function aiArbitrageBatch(prospects: Prospect[]): Promise<Map<string, { delete: boolean; reason: string }>> {
  const results = new Map<string, { delete: boolean; reason: string }>();

  const prospectList = prospects.map((p, i) =>
    `[${i + 1}] ${p.first_name || ''} ${p.last_name || ''} | Entreprise: ${p.company || 'N/A'} | Poste: ${p.job_title || 'N/A'} | Industrie: ${p.industry || 'N/A'} | Email: ${p.email || 'N/A'} | Site: ${p.website || 'N/A'} | Tags: ${(p.tags || []).join(', ') || 'N/A'}`
  ).join('\n');

  const prompt = `Tu es l'agent de nettoyage de la base prospects de CheckEasy.
CheckEasy est une solution SaaS pour les conciergeries et gestionnaires de locations courte duree (Airbnb, Booking, etc.).

NOTRE CIBLE :
- Conciergeries
- Property managers / gestionnaires locatifs
- Proprietaires qui gerent des locations courte duree
- Channel managers
- Hotels / residences de tourisme
- Tout professionnel de l'hospitality / location saisonniere

PAS NOTRE CIBLE (a supprimer) :
- Restaurants, bars, cafes
- Commerces de detail (fleuristes, tabacs, etc.)
- Professions medicales (dentistes, medecins, etc.)
- Artisans du batiment (plombiers, electriciens, etc.)
- Salons de coiffure / beaute
- Garages automobiles
- Profils spam, faux, ou vides
- Toute entreprise sans rapport avec la location courte duree

EN CAS DE DOUTE → GARDER (delete: false)

Voici ${prospects.length} prospects a evaluer :

${prospectList}

Reponds en JSON strict — un tableau avec un objet par prospect dans l'ordre :
[
  { "index": 1, "delete": true/false, "reason": "explication courte" },
  ...
]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    let cleanJson = text.trim();
    const fenceMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) cleanJson = fenceMatch[1].trim();

    const decisions = JSON.parse(cleanJson) as Array<{ index: number; delete: boolean; reason: string }>;

    for (const d of decisions) {
      const prospectIndex = d.index - 1;
      if (prospectIndex >= 0 && prospectIndex < prospects.length) {
        results.set(prospects[prospectIndex].id, { delete: d.delete, reason: d.reason });
      }
    }
  } catch (error) {
    console.error('  AI batch error:', error);
    // On error, keep all prospects (safe default)
    for (const p of prospects) {
      results.set(p.id, { delete: false, reason: 'Erreur IA — conserve par securite' });
    }
  }

  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== NETTOYAGE DE LA BASE PROSPECTS ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (aucune suppression)' : 'REEL'}`);
  console.log(`AI only: ${AI_ONLY}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  // Fetch all prospects
  const allProspects: Prospect[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('prospects')
      .select('id, first_name, last_name, company, job_title, email, industry, website, tags, custom_fields')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Erreur fetch:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allProspects.push(...(data as Prospect[]));
    from += pageSize;
    if (data.length < pageSize) break;
  }

  console.log(`Total prospects en base: ${allProspects.length}`);
  console.log('');

  // Phase 1: Quick classification
  const toDelete: Prospect[] = [];
  const toKeep: Prospect[] = [];
  const ambiguous: Prospect[] = [];

  if (!AI_ONLY) {
    console.log('--- Phase 1 : Filtre rapide par mots-cles ---');
    for (const p of allProspects) {
      const classification = classifyQuick(p);
      if (classification === 'delete') toDelete.push(p);
      else if (classification === 'keep') toKeep.push(p);
      else ambiguous.push(p);
    }

    console.log(`  A supprimer (pattern): ${toDelete.length}`);
    console.log(`  A garder (pattern): ${toKeep.length}`);
    console.log(`  Ambigus (besoin IA): ${ambiguous.length}`);

    if (toDelete.length > 0) {
      console.log('');
      console.log('  Exemples a supprimer:');
      for (const p of toDelete.slice(0, 10)) {
        console.log(`    - ${p.first_name || ''} ${p.last_name || ''} | ${p.company || 'N/A'} | ${p.industry || ''}`);
      }
    }
  } else {
    // AI only mode — send all to AI
    ambiguous.push(...allProspects);
    console.log(`  Tous les prospects seront evalues par l'IA: ${ambiguous.length}`);
  }

  // Phase 2: AI arbitrage on ambiguous prospects
  const aiToDelete: Array<{ prospect: Prospect; reason: string }> = [];

  if (ambiguous.length > 0) {
    console.log('');
    console.log('--- Phase 2 : Arbitrage IA ---');

    for (let i = 0; i < ambiguous.length; i += BATCH_SIZE) {
      const batch = ambiguous.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(ambiguous.length / BATCH_SIZE);
      process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} prospects)...`);

      const decisions = await aiArbitrageBatch(batch);

      let batchDeleted = 0;
      for (const [prospectId, decision] of decisions) {
        if (decision.delete) {
          const prospect = batch.find(p => p.id === prospectId)!;
          aiToDelete.push({ prospect, reason: decision.reason });
          batchDeleted++;
        }
      }

      console.log(` ${batchDeleted} a supprimer`);

      // Small delay to avoid rate limiting
      if (i + BATCH_SIZE < ambiguous.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`  Total IA a supprimer: ${aiToDelete.length}`);
    if (aiToDelete.length > 0) {
      console.log('  Exemples:');
      for (const { prospect: p, reason } of aiToDelete.slice(0, 10)) {
        console.log(`    - ${p.first_name || ''} ${p.last_name || ''} | ${p.company || 'N/A'} → ${reason}`);
      }
    }
  }

  // Summary
  const allToDelete = [
    ...toDelete.map(p => ({ id: p.id, source: 'pattern' })),
    ...aiToDelete.map(({ prospect }) => ({ id: prospect.id, source: 'ai' })),
  ];

  console.log('');
  console.log('=== RESUME ===');
  console.log(`  Total prospects: ${allProspects.length}`);
  console.log(`  A supprimer (pattern): ${toDelete.length}`);
  console.log(`  A supprimer (IA): ${aiToDelete.length}`);
  console.log(`  Total a supprimer: ${allToDelete.length}`);
  console.log(`  Restants: ${allProspects.length - allToDelete.length}`);

  if (DRY_RUN) {
    console.log('');
    console.log('DRY RUN — aucune suppression effectuee.');
    console.log('Relancez sans --dry-run pour appliquer.');
    return;
  }

  if (allToDelete.length === 0) {
    console.log('');
    console.log('Rien a supprimer. Base propre !');
    return;
  }

  // Execute deletions
  console.log('');
  console.log('--- Suppression en cours ---');

  const deleteIds = allToDelete.map(d => d.id);

  // First unenroll from campaigns
  const { data: enrollments } = await supabase
    .from('campaign_prospects')
    .select('id')
    .in('prospect_id', deleteIds.slice(0, 500)) // Supabase IN limit
    .in('status', ['active', 'pending']);

  if (enrollments && enrollments.length > 0) {
    await supabase
      .from('campaign_prospects')
      .update({ status: 'removed' })
      .in('id', enrollments.map(e => e.id));
    console.log(`  ${enrollments.length} inscriptions campagne desactivees`);
  }

  // Delete in batches of 500 (Supabase IN limit)
  let totalDeleted = 0;
  for (let i = 0; i < deleteIds.length; i += 500) {
    const batch = deleteIds.slice(i, i + 500);
    const { error } = await supabase
      .from('prospects')
      .delete()
      .in('id', batch);

    if (error) {
      console.error(`  Erreur batch ${i}-${i + batch.length}:`, error.message);
    } else {
      totalDeleted += batch.length;
      console.log(`  Supprime: ${totalDeleted}/${deleteIds.length}`);
    }
  }

  console.log('');
  console.log(`=== TERMINE : ${totalDeleted} prospects supprimes ===`);
}

main().catch(console.error);
