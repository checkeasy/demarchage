/**
 * Create 5 outreach campaigns (draft) and enroll prospects into each one.
 *
 * Each prospect goes into exactly ONE campaign based on:
 * 1. contact_type (lead_chaud, a_recontacter, mauvaise_cible...)
 * 2. Pipeline stage (lost, contacted, never contacted)
 * 3. Available contact info (email required for email campaigns)
 *
 * Campaigns use use_ai_generation=true so the orchestrator generates
 * a unique email for each prospect using their full data + enrichments.
 *
 * Usage: npx tsx scripts/create-campaigns-and-enroll.ts [--dry-run]
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Campaign Definitions ────────────────────────────────────────────────────

interface CampaignDef {
  name: string;
  description: string;
  steps: StepDef[];
}

interface StepDef {
  step_order: number;
  step_type: 'email' | 'delay' | 'linkedin_connect' | 'linkedin_message';
  delay_days?: number;
  delay_hours?: number;
  subject?: string;
  body_html?: string;
  body_text?: string;
  linkedin_message?: string;
  use_ai_generation?: boolean;
  ai_prompt_context?: string;
}

const CAMPAIGNS: CampaignDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. LEADS CHAUDS — Sequence aggressive, 4 emails, cadence rapide
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: '🔥 Leads Chauds — Sequence Aggressive',
    description: 'Prospects avec ICP score eleve et signaux forts de besoin urgent. Cadence rapide J0→J+3→J+7→J+14.',
    steps: [
      {
        step_order: 1,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : LEAD CHAUD — Ce prospect a des signaux forts de besoin urgent (beaucoup de biens, pas de PMS, mauvais avis, forte presence OTA).

OBJECTIF : Obtenir un RDV demo dans la semaine.

ANGLE : Accroche directe sur leur pain point principal. Montre que tu comprends leur quotidien sans jamais dire "j'ai vu que" ou "j'ai analyse". Le prospect doit sentir que tu connais son metier.

TON : Semi-formel, chaleureux, pas vendeur. Tu parles de leur realite, pas du produit.

CTA : Question ouverte qui les fait reflechir a leur probleme ("ca vous arrive souvent ?", "comment vous gerez ca aujourd'hui ?")

EVITER : Mentionner qu'on a analyse leurs avis/donnees, pitcher des le premier message, utiliser un ton corporate.

C'est l'EMAIL 1 sur 4 de la sequence. Premiere prise de contact.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 2, step_type: 'delay', delay_days: 3 },
      {
        step_order: 3,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : LEAD CHAUD — Relance avec preuve sociale.

OBJECTIF : Montrer un resultat concret d'un client similaire.

ANGLE : Partage un cas client concret (conciergerie similaire) avec des chiffres : heures gagnees, avis ameliores, reservations en hausse. Pas de pitch produit, juste "voila ce qu'un confrere a fait".

TON : Semi-formel, conversationnel.

CTA : "Interesse pour voir comment on pourrait faire pareil chez vous ?"

C'est l'EMAIL 2 sur 4. Le prospect n'a pas repondu au premier email.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 4, step_type: 'delay', delay_days: 4 },
      {
        step_order: 5,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : LEAD CHAUD — Proposition de demo directe.

OBJECTIF : Decrocher un creneau de demo 20 minutes.

ANGLE : Direct et concret. Montre en 2 phrases ce que CheckEasy fait (centralise les demandes clients, automatise les reponses). Propose un creneau de 20 min, "pas de presentation bidon, juste l'outil en action".

TON : Semi-formel, direct.

CTA : Proposition de creneaux concrets ("demain a 14h ou jeudi matin ?") + lien booking si disponible.

C'est l'EMAIL 3 sur 4.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 6, step_type: 'delay', delay_days: 7 },
      {
        step_order: 7,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : LEAD CHAUD — Dernier message, breakup doux.

OBJECTIF : Laisser la porte ouverte sans insister.

ANGLE : Honnetete. "Je vous ai ecrit plusieurs fois, je comprends que ca n'a peut-etre pas resonne." Rappelle en une phrase le probleme que CheckEasy resout. Termine par "je suis la si ca vous interesse un jour".

TON : Semi-formel, sincere, pas de pression.

CTA : Breakup — "Je suis la si ca vous interesse un jour."

C'est l'EMAIL 4 sur 4. DERNIER email de la sequence.`,
        subject: '', body_html: '', body_text: '',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PERDUS — Newsletter re-engagement, 3 emails, cadence mensuelle
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: '📰 Perdus — Newsletter Re-engagement',
    description: 'Prospects qui etaient dans le pipeline mais n\'ont pas converti. Newsletter avec nouveautes + contenu IA.',
    steps: [
      {
        step_order: 1,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : PROSPECT PERDU — Ils nous connaissent deja, on les a perdus.

OBJECTIF : Re-engager avec du contenu, pas du pitch. Montrer qu'on a evolue.

ANGLE : "On a bosse depuis qu'on s'est parle." Email newsletter avec :
1. Une nouveaute/feature CheckEasy avec un benefice concret (ex: integration Booking automatisee, nouveau tableau de bord avis)
2. Un chiffre ou insight du secteur de la conciergerie/location courte duree
3. Un CTA soft

TON : Semi-formel, naturel. On se souvient d'eux sans etre lourd.

CTA : "Ca vaut le coup de se reparler ?" ou lien vers une page de nouveautes.

EVITER : Rappeler pourquoi ils ont dit non, envoyer le meme type de message qu'avant, etre agressif.

C'est l'EMAIL 1 sur 3. Format newsletter, pas email de vente.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 2, step_type: 'delay', delay_days: 14 },
      {
        step_order: 3,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : PROSPECT PERDU — Success story client.

OBJECTIF : Montrer un resultat concret qui resonne avec leur situation.

ANGLE : Raconte l'histoire d'une conciergerie qui a utilise CheckEasy. Details concrets : combien de biens, quel probleme, quel resultat (heures gagnees, avis ameliores, reservations en hausse). Pas de pitch, juste "voila ce qui se passe chez nos clients".

TON : Semi-formel, storytelling.

CTA : "Vous etes dans une situation similaire ?"

C'est l'EMAIL 2 sur 3.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 4, step_type: 'delay', delay_days: 14 },
      {
        step_order: 5,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : PROSPECT PERDU — Offre de retour.

OBJECTIF : Proposer de revenir avec un avantage.

ANGLE : "Vous avez teste il y a quelques mois, pas de jugement. Mais on a beaucoup ameliore. Revenez, on vous offre 1 mois gratuit." Liste 3 ameliorations concretes.

TON : Semi-formel, genereux.

CTA : "Dites-moi et je vous reactive le compte."

EVITER : Rappeler pourquoi ils sont partis.

C'est l'EMAIL 3 sur 3. DERNIER email.`,
        subject: '', body_html: '', body_text: '',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. A RECONTACTER — Nurturing doux, 3 emails
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: '🌱 A Recontacter — Nurturing',
    description: 'Prospects pertinents mais qui n\'etaient pas prets (en creation, projet futur). Approche douce.',
    steps: [
      {
        step_order: 1,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : A RECONTACTER — Profil pertinent, pas pret avant.

OBJECTIF : Prendre des nouvelles sinceres, aucun pitch.

ANGLE : "On s'etait parle il y a un moment, vous aviez d'autres priorites. Je pensais a vous cette semaine." Question ouverte sur leur avancement. ZERO mention du produit.

TON : Decontracte, empathique. Ce sont des VIP en patience.

CTA : Question ouverte — "Ou en etes-vous dans votre projet ?"

EVITER : Commencer par le produit, sequence agressive. Ce segment est fragile.

C'est l'EMAIL 1 sur 3. Prise de nouvelles pure.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 2, step_type: 'delay', delay_days: 10 },
      {
        step_order: 3,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : A RECONTACTER — Contenu de valeur.

OBJECTIF : Apporter de la valeur sans rien demander.

ANGLE : Partage un guide/conseil pratique pour les conciergeries qui demarrent. "Les 5 systemes qui font gagner 10h/semaine". Contenu utile, pas de vente.

TON : Semi-formel, genereux.

CTA : "Vous trouveriez de la valeur la-dedans ?"

C'est l'EMAIL 2 sur 3.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 4, step_type: 'delay', delay_days: 11 },
      {
        step_order: 5,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : A RECONTACTER — Check-in leger, breakup bienveillant.

OBJECTIF : Dernier contact, laisser la porte ouverte.

ANGLE : "Petite relance. Vous avez eu la chance de lire ? Sans pression." Court et leger.

TON : Decontracte, zero pression.

CTA : Question ouverte simple.

C'est l'EMAIL 3 sur 3. DERNIER email.`,
        subject: '', body_html: '', body_text: '',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. JAMAIS CONTACTES — Cold outreach classique, 3 emails
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: '❄️ Jamais Contactes — Cold Outreach',
    description: 'Prospects frais, jamais demarches. Cold outreach classique avec personnalisation IA.',
    steps: [
      {
        step_order: 1,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : JAMAIS CONTACTE — Premier contact froid.

OBJECTIF : Creer la curiosite, pas la vente. Le prospect ne nous connait pas.

ANGLE : Accroche sur le secteur et la ville du prospect. "On travaille avec des conciergeries en France et [ville] a une belle concentration de property managers." Montre qu'on connait leur metier. Mentionne subtilement leur profil ("vous avez un profil solide"). Explique CheckEasy en une phrase.

TON : Semi-formel, personnalise (ville, secteur, taille du parc si connu).

PAIN POINTS a exploiter : Gestion du menage et prestataires = stress n°1, pas de tracabilite des interventions, mauvais avis lies a la proprete.

CTA : Question ouverte — "Ca peut vous interesser ?"

EVITER : Messages generiques qui ne mentionnent ni la ville ni le secteur, pitcher agressivement.

C'est l'EMAIL 1 sur 3. Premiere impression.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 2, step_type: 'delay', delay_days: 3 },
      {
        step_order: 3,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : JAMAIS CONTACTE — Apporter de la valeur.

OBJECTIF : Partager un insight/stat du secteur + mention legere du produit.

ANGLE : Stat qui fait reflechir (ex: "73% des property managers perdent 10-20% de potentiel de reservation a cause des temps de reponse trop longs"). Explication du probleme. Puis resultat de nos clients avec CheckEasy.

TON : Semi-formel, expert du secteur.

CTA : "Interesse par le detail ?"

C'est l'EMAIL 2 sur 3.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 4, step_type: 'delay', delay_days: 4 },
      {
        step_order: 5,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : JAMAIS CONTACTE — Proposition demo directe.

OBJECTIF : Proposer une demo 20 min.

ANGLE : Direct. "CheckEasy concentre toutes vos demandes clients dans une seule inbox. Les questions basiques ? Repondues automatiquement." Propose 20 min, "pas de presentation bidon, juste l'outil en action".

TON : Semi-formel, direct.

CTA : "Vous avez 20 minutes cette semaine ?" + lien booking si disponible.

C'est l'EMAIL 3 sur 3. DERNIER email.`,
        subject: '', body_html: '', body_text: '',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CONTACTES SANS REPONSE — Re-engagement, 2 emails
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: '🔄 Contactes Sans Reponse — Re-engagement',
    description: 'Prospects deja contactes qui n\'ont pas repondu. Angle completement different, max 2 emails.',
    steps: [
      {
        step_order: 1,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : CONTACTE SANS REPONSE — Rupture de pattern.

OBJECTIF : Obtenir une reponse en changeant completement d'angle.

ANGLE : Angle RADICALEMENT different. Ne parle PAS du produit. Pose une question directe et humaine : "Quelle est la chose la plus frustrante dans votre travail de property manager ?" Liste 3-4 options (messages qui trainent partout, questions repetitives, avis qui souffrent). Demande une reponse sincere.

TON : Decontracte, leger, presque familier. Ce n'est plus de la prospection, c'est une vraie question.

CTA : "Dites-moi. Pour de vrai."

EVITER : Relancer avec le meme type de message, mentionner qu'on a deja ecrit plusieurs fois.

EMAIL ULTRA COURT : 70-80 mots max.

C'est l'EMAIL 1 sur 2.`,
        subject: '', body_html: '', body_text: '',
      },
      { step_order: 2, step_type: 'delay', delay_days: 5 },
      {
        step_order: 3,
        step_type: 'email',
        use_ai_generation: true,
        ai_prompt_context: `SEGMENT : CONTACTE SANS REPONSE — Break-up email final.

OBJECTIF : Clore proprement, laisser la porte ouverte.

ANGLE : "Je vais arreter la. Je comprends le message. Peut-etre pas le bon moment, peut-etre que vous avez deja une solution. Et c'est ok." Termine par "si un jour vous avez besoin, vous savez ou me trouver".

TON : Decontracte, sincere, zero pression.

CTA : Breakup — porte ouverte.

EMAIL ULTRA COURT : 70-80 mots max.

C'est l'EMAIL 2 sur 2. DERNIER EMAIL. On ne les contacte plus apres.`,
        subject: '', body_html: '', body_text: '',
      },
    ],
  },
];

// ─── Prospect Segmentation ──────────────────────────────────────────────────

async function getWorkspaceId(): Promise<string> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1)
    .single();
  if (!data) throw new Error('No workspace found');
  return data.id;
}

async function getUserId(workspaceId: string): Promise<string> {
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .limit(1)
    .single();
  if (!data) throw new Error('No workspace owner found');
  return data.user_id;
}

interface ProspectForSegmentation {
  id: string;
  email: string | null;
  linkedin_url: string | null;
  contact_type: string | null;
  last_contacted_at: string | null;
}

async function fetchAllProspects(): Promise<ProspectForSegmentation[]> {
  const all: ProspectForSegmentation[] = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('prospects')
      .select('id, email, linkedin_url, contact_type, last_contacted_at')
      .not('contact_type', 'eq', 'mauvaise_cible')
      .range(offset, offset + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

async function getProspectsAlreadyInCampaigns(): Promise<Set<string>> {
  const enrolled = new Set<string>();
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('campaign_prospects')
      .select('prospect_id')
      .in('status', ['active', 'paused', 'pending', 'completed'])
      .range(offset, offset + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    data.forEach(d => enrolled.add(d.prospect_id));
    if (data.length < limit) break;
    offset += limit;
  }
  return enrolled;
}

async function getLostProspectIds(workspaceId: string): Promise<Set<string>> {
  const lost = new Set<string>();
  const { data } = await supabase
    .from('deals')
    .select('prospect_id')
    .eq('workspace_id', workspaceId)
    .eq('stage', 'lost');
  if (data) data.forEach(d => { if (d.prospect_id) lost.add(d.prospect_id); });
  return lost;
}

function segmentProspects(
  prospects: ProspectForSegmentation[],
  alreadyEnrolled: Set<string>,
  lostIds: Set<string>,
): Record<string, string[]> {
  const segments: Record<string, string[]> = {
    leads_chauds: [],
    perdus: [],
    a_recontacter: [],
    jamais_contactes: [],
    contactes_sans_reponse: [],
  };

  for (const p of prospects) {
    // Skip if already in a campaign
    if (alreadyEnrolled.has(p.id)) continue;
    // Skip if no email (can't send email campaigns)
    if (!p.email) continue;
    // Skip concurrents, partenaires, influenceurs
    if (['concurrent', 'partenaire', 'influenceur'].includes(p.contact_type || '')) continue;

    if (p.contact_type === 'lead_chaud') {
      segments.leads_chauds.push(p.id);
    } else if (lostIds.has(p.id)) {
      segments.perdus.push(p.id);
    } else if (p.contact_type === 'a_recontacter') {
      segments.a_recontacter.push(p.id);
    } else if (!p.last_contacted_at) {
      segments.jamais_contactes.push(p.id);
    } else {
      // Contacted but no reply (they're still "prospect" type + have last_contacted_at)
      segments.contactes_sans_reponse.push(p.id);
    }
  }

  return segments;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== Creation des campagnes et inscription des prospects ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'REEL'}\n`);

  // 1. Get workspace and user
  const workspaceId = await getWorkspaceId();
  const userId = await getUserId(workspaceId);
  console.log(`Workspace: ${workspaceId}`);
  console.log(`User: ${userId}\n`);

  // 2. Fetch and segment prospects
  console.log('Chargement des prospects...');
  const prospects = await fetchAllProspects();
  console.log(`  ${prospects.length} prospects actifs (hors mauvaise_cible)`);

  const alreadyEnrolled = await getProspectsAlreadyInCampaigns();
  console.log(`  ${alreadyEnrolled.size} deja inscrits dans des campagnes`);

  const lostIds = await getLostProspectIds(workspaceId);
  console.log(`  ${lostIds.size} dans le stage "lost"\n`);

  const segments = segmentProspects(prospects, alreadyEnrolled, lostIds);

  console.log('Segmentation:');
  const segmentNames = ['leads_chauds', 'perdus', 'a_recontacter', 'jamais_contactes', 'contactes_sans_reponse'];
  for (const name of segmentNames) {
    console.log(`  ${name.padEnd(25)} ${segments[name].length} prospects`);
  }
  const totalToEnroll = segmentNames.reduce((sum, n) => sum + segments[n].length, 0);
  console.log(`  ${'TOTAL'.padEnd(25)} ${totalToEnroll} prospects\n`);

  if (DRY_RUN) {
    console.log('[DRY RUN] Aucune campagne creee. Relancez sans --dry-run pour appliquer.');
    return;
  }

  // 3. Create campaigns and enroll
  const campaignMapping = [
    { def: CAMPAIGNS[0], segment: 'leads_chauds' },
    { def: CAMPAIGNS[1], segment: 'perdus' },
    { def: CAMPAIGNS[2], segment: 'a_recontacter' },
    { def: CAMPAIGNS[3], segment: 'jamais_contactes' },
    { def: CAMPAIGNS[4], segment: 'contactes_sans_reponse' },
  ];

  for (const { def, segment } of campaignMapping) {
    const prospectIds = segments[segment];
    console.log(`\n--- ${def.name} ---`);
    console.log(`  ${prospectIds.length} prospects a inscrire`);

    if (prospectIds.length === 0) {
      console.log('  Aucun prospect, skip');
      continue;
    }

    // Create campaign
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: workspaceId,
        name: def.name,
        description: def.description,
        status: 'draft',
        created_by: userId,
        timezone: 'Europe/Paris',
        sending_window_start: '08:00',
        sending_window_end: '18:00',
        sending_days: [1, 2, 3, 4, 5],
        track_opens: true,
        track_clicks: true,
        stop_on_reply: true,
      })
      .select('id')
      .single();

    if (campError || !campaign) {
      console.error(`  ERREUR creation campagne: ${campError?.message}`);
      continue;
    }
    console.log(`  Campagne creee: ${campaign.id}`);

    // Create sequence steps
    for (const step of def.steps) {
      const { error: stepError } = await supabase
        .from('sequence_steps')
        .insert({
          campaign_id: campaign.id,
          step_order: step.step_order,
          step_type: step.step_type,
          delay_days: step.delay_days || 0,
          delay_hours: step.delay_hours || 0,
          subject: step.subject || null,
          body_html: step.body_html || null,
          body_text: step.body_text || null,
          linkedin_message: step.linkedin_message || null,
          use_ai_generation: step.use_ai_generation || false,
          ai_prompt_context: step.ai_prompt_context || null,
          is_active: true,
        });

      if (stepError) {
        console.error(`  ERREUR step ${step.step_order}: ${stepError.message}`);
      }
    }
    console.log(`  ${def.steps.length} steps crees`);

    // Get first email step (not delay) for enrollment
    const { data: firstStep } = await supabase
      .from('sequence_steps')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('step_type', 'email')
      .order('step_order', { ascending: true })
      .limit(1)
      .single();

    if (!firstStep) {
      console.error('  ERREUR: pas de premier step email');
      continue;
    }

    // Enroll prospects in batches of 500
    let enrolled = 0;
    for (let i = 0; i < prospectIds.length; i += 500) {
      const batch = prospectIds.slice(i, i + 500);
      const enrollments = batch.map(prospectId => ({
        campaign_id: campaign.id,
        prospect_id: prospectId,
        current_step_id: firstStep.id,
        status: 'paused', // Draft campaign = paused prospects
        next_send_at: null, // Will be set when campaign is activated
      }));

      const { error: enrollError } = await supabase
        .from('campaign_prospects')
        .insert(enrollments);

      if (enrollError) {
        console.error(`  ERREUR enrollment batch ${i}: ${enrollError.message}`);
      } else {
        enrolled += batch.length;
      }
    }

    // Update campaign total
    await supabase
      .from('campaigns')
      .update({ total_prospects: enrolled })
      .eq('id', campaign.id);

    console.log(`  ${enrolled} prospects inscrits (status: paused)`);
  }

  console.log('\n=== TERMINE ===');
  console.log('Toutes les campagnes sont en DRAFT.');
  console.log('Les prospects sont en PAUSED (ils ne recevront rien tant que la campagne n\'est pas activee).');
  console.log('Va sur l\'app pour relire les campagnes et les activer quand tu es pret.');
}

main().catch(console.error);
