import OpenAI from 'openai';
import {
  SYSTEM_PROMPT_CONNECTION,
  SYSTEM_PROMPT_FOLLOWUP,
  SYSTEM_PROMPT_EMAIL,
  SYSTEM_PROMPT_ICEBREAKER,
  SYSTEM_PROMPT_ANALYSIS,
} from '@/lib/ai/prompts';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProspectProfile {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  industry?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  website?: string | null;
  email?: string | null;
  bio?: string | null;
  companyDescription?: string | null;
  companySize?: string | null;
  customFields?: Record<string, unknown>;
}

export interface MessageContext {
  productName?: string;
  campaignTone?: 'formel' | 'semi-formel' | 'decontracte';
  keyValueProps?: string[];
  targetAction?: string;
  additionalContext?: string;
}

export interface PreviousMessage {
  role: 'user' | 'assistant';
  content: string;
  sentAt?: string;
}

export interface ConnectionMessageResult {
  message: string;
  character_count: number;
  personalization_hooks: string[];
}

export interface FollowUpMessageResult {
  message: string;
  character_count: number;
  tone: string;
  call_to_action: string;
  follow_up_number: number;
}

export interface EmailSequenceStep {
  step: number;
  subject: string;
  body_html: string;
  body_text: string;
  delay_days: number;
  purpose: string;
}

export interface EmailSequenceResult {
  sequence: EmailSequenceStep[];
}

export interface IcebreakerResult {
  icebreaker: string;
  reference_type: string;
  specificity_score: number;
}

export interface ProfileAnalysisResult {
  relevance_score: number;
  score_breakdown: {
    role_fit: number;
    industry_fit: number;
    company_size_fit: number;
    intent_signals: number;
  };
  talking_points: string[];
  recommended_approach: {
    channel: string;
    tone: string;
    angle: string;
    contact_frequency: string;
  };
  risks: {
    sensitive_points: string[];
    likely_objections: Array<{
      objection: string;
      suggested_response: string;
    }>;
  };
  priority: 'high' | 'medium' | 'low';
}

export interface WebsiteDataForIcebreaker {
  title?: string | null;
  description?: string | null;
  mainContent?: string | null;
  industry?: string | null;
  products?: string[];
}

// ─── OpenAI Client ──────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = 'gpt-5-mini-2025-08-07';

// ─── Helper: Build Profile Description ──────────────────────────────────────

function buildProfileDescription(profile: ProspectProfile): string {
  const parts: string[] = [];

  const name =
    profile.fullName ||
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    'Inconnu';
  parts.push(`Nom: ${name}`);

  if (profile.jobTitle) parts.push(`Poste: ${profile.jobTitle}`);
  if (profile.company) parts.push(`Entreprise: ${profile.company}`);
  if (profile.industry) parts.push(`Secteur: ${profile.industry}`);
  if (profile.location) parts.push(`Localisation: ${profile.location}`);
  if (profile.companyDescription)
    parts.push(`Description entreprise: ${profile.companyDescription}`);
  if (profile.companySize)
    parts.push(`Taille entreprise: ${profile.companySize}`);
  if (profile.bio) parts.push(`Bio/Resume: ${profile.bio}`);
  if (profile.website) parts.push(`Site web: ${profile.website}`);
  if (profile.linkedinUrl) parts.push(`LinkedIn: ${profile.linkedinUrl}`);

  if (profile.customFields && Object.keys(profile.customFields).length > 0) {
    parts.push(
      `Informations supplementaires: ${JSON.stringify(profile.customFields)}`
    );
  }

  return parts.join('\n');
}

function buildContextDescription(context: MessageContext): string {
  const parts: string[] = [];

  parts.push(`Produit: ${context.productName || 'CheckEasy'}`);

  if (context.campaignTone)
    parts.push(`Ton de la campagne: ${context.campaignTone}`);
  if (context.keyValueProps && context.keyValueProps.length > 0)
    parts.push(
      `Propositions de valeur cles: ${context.keyValueProps.join(', ')}`
    );
  if (context.targetAction)
    parts.push(`Action souhaitee: ${context.targetAction}`);
  if (context.additionalContext)
    parts.push(`Contexte additionnel: ${context.additionalContext}`);

  return parts.join('\n');
}

// ─── Helper: Extract GPT Response Text ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractResponseText(response: any): string {
  let text = '';
  if (!response.output) return text;
  for (const item of response.output) {
    if (item.type === 'message') {
      for (const block of item.content) {
        if (block.type === 'output_text' && block.text) {
          text += block.text;
        }
      }
    }
  }
  return text;
}

// ─── Message Generation Functions ───────────────────────────────────────────

/**
 * Generate a personalized LinkedIn connection note (max 300 chars)
 */
export async function generateConnectionMessage(
  profile: ProspectProfile,
  context: MessageContext = {}
): Promise<ConnectionMessageResult> {
  const profileDesc = buildProfileDescription(profile);
  const contextDesc = buildContextDescription(context);

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: SYSTEM_PROMPT_CONNECTION,
      },
      {
        role: 'user',
        content: `Genere un message de connexion LinkedIn personnalise pour ce prospect.

PROFIL DU PROSPECT :
${profileDesc}

CONTEXTE DE LA CAMPAGNE :
${contextDesc}

Reponds UNIQUEMENT en JSON valide selon le format specifie dans les instructions systeme.`,
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const text = extractResponseText(response);
  const result: ConnectionMessageResult = JSON.parse(text);

  // Safety check: ensure message is under 300 characters
  if (result.message.length > 300) {
    result.message = result.message.substring(0, 297) + '...';
    result.character_count = result.message.length;
  }

  return result;
}

/**
 * Generate follow-up LinkedIn messages
 */
export async function generateFollowUpMessage(
  profile: ProspectProfile,
  context: MessageContext = {},
  previousMessages: PreviousMessage[] = []
): Promise<FollowUpMessageResult> {
  const profileDesc = buildProfileDescription(profile);
  const contextDesc = buildContextDescription(context);

  const conversationHistory =
    previousMessages.length > 0
      ? previousMessages
          .map(
            (msg) =>
              `[${msg.role === 'user' ? 'PROSPECT' : 'NOUS'}] ${msg.content}`
          )
          .join('\n\n')
      : 'Aucun message precedent (premier follow-up apres connexion acceptee).';

  const followUpNumber = previousMessages.filter(
    (msg) => msg.role === 'assistant'
  ).length + 1;

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: SYSTEM_PROMPT_FOLLOWUP,
      },
      {
        role: 'user',
        content: `Genere un message de suivi LinkedIn (follow-up #${followUpNumber}) personnalise pour ce prospect.

PROFIL DU PROSPECT :
${profileDesc}

CONTEXTE DE LA CAMPAGNE :
${contextDesc}

HISTORIQUE DE LA CONVERSATION :
${conversationHistory}

C'est le follow-up numero ${followUpNumber}. Adapte le ton et le contenu en consequence.
Reponds UNIQUEMENT en JSON valide selon le format specifie dans les instructions systeme.`,
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const text = extractResponseText(response);
  return JSON.parse(text) as FollowUpMessageResult;
}

/**
 * Generate a full email sequence
 */
export async function generateEmailSequence(
  profile: ProspectProfile,
  context: MessageContext = {},
  numSteps: number = 4
): Promise<EmailSequenceResult> {
  const profileDesc = buildProfileDescription(profile);
  const contextDesc = buildContextDescription(context);

  // Clamp numSteps between 2 and 7
  const steps = Math.max(2, Math.min(7, numSteps));

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: SYSTEM_PROMPT_EMAIL,
      },
      {
        role: 'user',
        content: `Genere une sequence de ${steps} emails de prospection personnalisee pour ce prospect.

PROFIL DU PROSPECT :
${profileDesc}

CONTEXTE DE LA CAMPAGNE :
${contextDesc}

Nombre d'emails dans la sequence : ${steps}

Rappel de la structure attendue :
- Email 1 (Jour 0) : Introduction / accroche de valeur
- Email 2 (Jour 3) : Preuve sociale / etude de cas
- Email 3 (Jour 7) : Proposition directe de meeting/demo
- Email 4 (Jour 14) : Breakup email
- Emails supplementaires si demandes : relances douces avec angles differents

Reponds UNIQUEMENT en JSON valide selon le format specifie dans les instructions systeme.`,
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const text = extractResponseText(response);
  return JSON.parse(text) as EmailSequenceResult;
}

/**
 * Generate a custom icebreaker based on profile + their website data
 */
export async function generateIcebreaker(
  profile: ProspectProfile,
  websiteData?: WebsiteDataForIcebreaker
): Promise<IcebreakerResult> {
  const profileDesc = buildProfileDescription(profile);

  let websiteInfo = '';
  if (websiteData) {
    const wParts: string[] = [];
    if (websiteData.title) wParts.push(`Titre du site: ${websiteData.title}`);
    if (websiteData.description)
      wParts.push(`Description: ${websiteData.description}`);
    if (websiteData.industry)
      wParts.push(`Secteur identifie: ${websiteData.industry}`);
    if (websiteData.products && websiteData.products.length > 0)
      wParts.push(`Produits/services: ${websiteData.products.join(', ')}`);
    if (websiteData.mainContent)
      wParts.push(
        `Contenu du site (extrait): ${websiteData.mainContent.substring(0, 1000)}`
      );
    websiteInfo = `\n\nDONNEES DU SITE WEB DU PROSPECT :\n${wParts.join('\n')}`;
  }

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: SYSTEM_PROMPT_ICEBREAKER,
      },
      {
        role: 'user',
        content: `Genere un icebreaker personnalise pour ce prospect.

PROFIL DU PROSPECT :
${profileDesc}${websiteInfo}

Reponds UNIQUEMENT en JSON valide selon le format specifie dans les instructions systeme.`,
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const text = extractResponseText(response);
  return JSON.parse(text) as IcebreakerResult;
}

/**
 * Analyze a prospect profile and return outreach recommendations
 */
export async function analyzeProfileForOutreach(
  profile: ProspectProfile
): Promise<ProfileAnalysisResult> {
  const profileDesc = buildProfileDescription(profile);

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: SYSTEM_PROMPT_ANALYSIS,
      },
      {
        role: 'user',
        content: `Analyse ce profil de prospect et fournis tes recommandations pour la prospection avec CheckEasy.

PROFIL DU PROSPECT :
${profileDesc}

Reponds UNIQUEMENT en JSON valide selon le format specifie dans les instructions systeme.`,
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const text = extractResponseText(response);
  return JSON.parse(text) as ProfileAnalysisResult;
}
