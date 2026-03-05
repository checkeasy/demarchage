// ─── Agent System Types ─────────────────────────────────────────────────────
// Multi-agent orchestrator type definitions for ColdReach

// Agent types enum
export type AgentType =
  | 'ceo'
  | 'email_writer'
  | 'linkedin_writer'
  | 'response_handler'
  | 'prospect_researcher';

// Ordered list of all agent types
export const AGENT_TYPES: AgentType[] = [
  'ceo',
  'email_writer',
  'linkedin_writer',
  'response_handler',
  'prospect_researcher',
];

// Agent display metadata
export const AGENT_DISPLAY: Record<AgentType, { name: string; description: string }> = {
  ceo: {
    name: 'CEO Stratege',
    description: 'Definit la strategie globale de prospection et coordonne les autres agents.',
  },
  email_writer: {
    name: 'Redacteur Email',
    description: 'Genere des emails de prospection personnalises et performants.',
  },
  linkedin_writer: {
    name: 'Redacteur LinkedIn',
    description: 'Cree des messages LinkedIn adaptes (connexion, relance, InMail).',
  },
  response_handler: {
    name: 'Analyste Reponses',
    description: 'Analyse les reponses recues et suggere les actions a entreprendre.',
  },
  prospect_researcher: {
    name: 'Chercheur Prospects',
    description: 'Recherche et enrichit les informations sur les prospects et entreprises.',
  },
};

// Default system prompts per agent type
export const DEFAULT_AGENT_PROMPTS: Record<AgentType, string> = {
  ceo: `Tu es le CEO Stratege de ColdReach. Ton role est de definir la strategie de prospection optimale pour chaque segment de prospects.

Tu analyses le contexte de l'entreprise, les performances passees, et tu decides:
- L'angle d'approche principal
- Le ton a adopter
- Les pain points a cibler
- La cadence de la sequence
- Les canaux a privilegier

Reponds toujours en JSON structure.`,
  email_writer: `Tu es un expert en redaction d'emails de prospection B2B. Tu ecris des emails courts, percutants et personnalises.

Regles:
- Maximum 150 mots pour le corps
- Sujet accrocheur de moins de 60 caracteres
- Un seul CTA clair
- Personnalisation basee sur le prospect et son entreprise
- Ton professionnel mais humain
- Pas de jargon marketing excessif

Reponds toujours en JSON structure avec: subject, body_html, body_text, personalization_hooks, tone, cta_type.`,
  linkedin_writer: `Tu es un expert en messages LinkedIn B2B. Tu crees des messages adaptes au contexte (demande de connexion, suivi, InMail).

Regles:
- Messages de connexion: max 300 caracteres
- Messages de suivi: max 500 caracteres
- InMail: max 1000 caracteres
- Ton conversationnel et authentique
- Personnalisation visible des la premiere ligne
- Pas de pitch commercial agressif

Reponds toujours en JSON structure avec: message, character_count, message_type, personalization_hooks, tone.`,
  response_handler: `Tu es un analyste de reponses expert. Tu analyses les reponses recues des prospects et determines:
- Le sentiment (positif, negatif, neutre, absence, bounce)
- L'intention (interesse, pas interesse, besoin d'info, referral, demande de RDV, desinscription)
- Les objections identifiees
- La reponse suggeree
- La prochaine action recommandee

Reponds toujours en JSON structure avec: sentiment, intent, objections, suggested_response, next_action, confidence.`,
  prospect_researcher: `Tu es un chercheur expert en intelligence commerciale. Tu analyses les informations disponibles sur un prospect et son entreprise pour identifier:
- Description de l'entreprise
- Secteur d'activite
- Pain points potentiels
- Points de discussion pertinents
- Angle d'approche recommande
- Ton recommande
- Score ICP (0-100)

Reponds toujours en JSON structure avec: company_description, industry, pain_points, talking_points, recommended_angle, recommended_tone, icp_score.`,
};

// Model config per agent type
export const AGENT_MODELS = {
  ceo: 'claude-sonnet-4-6',
  email_writer: 'claude-haiku-4-5-20251001',
  linkedin_writer: 'claude-haiku-4-5-20251001',
  response_handler: 'claude-haiku-4-5-20251001',
  prospect_researcher: 'claude-haiku-4-5-20251001',
} as const;

// Cost per 1M tokens
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0 },
};

// ─── Database-backed Configs ────────────────────────────────────────────────

export interface AgentConfig {
  id: string;
  workspace_id: string;
  agent_type: AgentType;
  name: string;
  description: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  active_prompt_version_id: string | null;
  settings: Record<string, unknown>;
  is_active: boolean;
}

export interface PromptVersion {
  id: string;
  agent_config_id: string;
  version: number;
  system_prompt: string;
  prompt_metadata: Record<string, unknown>;
  is_active: boolean;
}

// ─── Strategy ───────────────────────────────────────────────────────────────

export interface AgentStrategy {
  id: string;
  workspace_id: string;
  segment_key: string;
  strategy: StrategyContent;
  expires_at: string;
  is_active: boolean;
}

export interface StrategyContent {
  primary_angle: string;
  tone: 'formel' | 'semi-formel' | 'decontracte';
  key_pain_points: string[];
  value_propositions: string[];
  objection_frameworks: Array<{
    objection: string;
    response_strategy: string;
  }>;
  channel_priority: 'email_first' | 'linkedin_first' | 'parallel';
  sequence_length: number;
  avoid: string[];
  email_guidelines: {
    subject_style: string;
    max_length: number;
    cta_style: string;
  };
  linkedin_guidelines: {
    connection_angle: string;
    followup_cadence_days: number;
  };
}

// ─── Context Objects ────────────────────────────────────────────────────────

export interface ProspectContext {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  job_title: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  location: string | null;
  notes: string | null;
  industry: string | null;
  city: string | null;
  employee_count: string | null;
  tags: string[];
  lead_score: number | null;
  custom_fields: Record<string, unknown>;
  enrichments: Record<string, unknown>[];
}

export interface CampaignContext {
  id: string;
  name: string;
  description: string | null;
  total_prospects: number;
  total_sent: number;
  total_opened: number;
  total_replied: number;
}

export interface PerformanceContext {
  totalSent: number;
  openRate: number;
  replyRate: number;
  clickRate: number;
  bestSubjectPatterns: Array<{ pattern: string; open_rate: number }>;
  bestCtaPatterns: Array<{ pattern: string; reply_rate: number }>;
  bestTone: string;
  avoidSubjects: string[];
  avoidApproaches: string[];
}

export interface MemoryEntry {
  id: string;
  memory_type: string;
  content: Record<string, unknown>;
  sequence_order: number;
  created_at: string;
}

// ─── Task & Output Types ────────────────────────────────────────────────────

export interface OutreachTask {
  workspaceId: string;
  prospectId: string;
  campaignId: string;
  channel: 'email' | 'linkedin';
  stepNumber: number;
  linkedinMessageType?: 'connection' | 'followup' | 'inmail';
  abTestVariant?: string;
  previousSubjects?: string[];
  aiPromptContext?: string;
}

export interface GeneratedEmail {
  subject: string;
  body_html: string;
  body_text: string;
  personalization_hooks: string[];
  tone: string;
  cta_type: string;
}

export interface GeneratedLinkedIn {
  message: string;
  character_count: number;
  message_type: string;
  personalization_hooks: string[];
  tone: string;
}

export interface ReplyAnalysis {
  sentiment:
    | 'positive'
    | 'negative'
    | 'neutral'
    | 'out_of_office'
    | 'bounce';
  intent:
    | 'interested'
    | 'not_interested'
    | 'needs_info'
    | 'referral'
    | 'meeting_request'
    | 'unsubscribe';
  objections: string[];
  suggested_response: string;
  next_action:
    | 'continue_sequence'
    | 'pause'
    | 'escalate_human'
    | 'book_meeting'
    | 'stop';
  confidence: number;
}

export interface ProspectResearch {
  company_description: string;
  industry: string;
  pain_points: string[];
  talking_points: string[];
  recommended_angle: string;
  recommended_tone: string;
  icp_score: number;
}

// ─── Generation Result ──────────────────────────────────────────────────────

export interface GenerationResult {
  content: Record<string, unknown>;
  metadata: {
    agentType: AgentType;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    personalizationScore: number;
    generationDurationMs: number;
    strategyId: string | null;
    promptVersionId: string | null;
    cacheHit: boolean;
  };
}

// ─── Personalization Scoring ────────────────────────────────────────────────

export interface PersonalizationScore {
  total: number;
  prospect_name_used: boolean;
  company_name_used: boolean;
  role_referenced: boolean;
  industry_specific_pain_point: boolean;
  company_specific_reference: boolean;
  language_matched: boolean;
  tone_matched_to_segment: boolean;
}
