// ─── Agent Prompts Loader ────────────────────────────────────────────────────
// Loads prompts from .claude/agents/<name>/AGENT.md files (frontmatter + body).
// Falls back to hardcoded defaults if files are not found (e.g. in production).

import * as fs from 'fs';
import * as path from 'path';
import type { AgentType } from './types';

// ─── Agent file mapping ─────────────────────────────────────────────────────

const AGENT_FILE_MAP: Record<AgentType, string> = {
  ceo: 'ceo-stratege',
  email_writer: 'redacteur-email',
  linkedin_writer: 'redacteur-linkedin',
  response_handler: 'analyste-reponses',
  prospect_researcher: 'chercheur-prospects',
};

// ─── Parse AGENT.md ─────────────────────────────────────────────────────────

function parseAgentMd(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { frontmatter, body: match[2].trim() };
}

// ─── Load prompt from .md file ──────────────────────────────────────────────

function loadAgentPrompt(agentType: AgentType): string | null {
  const dirName = AGENT_FILE_MAP[agentType];
  if (!dirName) return null;

  // Try multiple paths (dev vs production)
  const candidates = [
    path.resolve(process.cwd(), '.claude', 'agents', dirName, 'AGENT.md'),
    path.resolve('/root/ProjectList/colddemarchage/.claude/agents', dirName, 'AGENT.md'),
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { body } = parseAgentMd(raw);
        if (body.length > 50) return body;
      }
    } catch {
      // Silently continue to next candidate
    }
  }

  return null;
}

// ─── Cached prompts (loaded once per process) ───────────────────────────────

let _cachedPrompts: Record<AgentType, string> | null = null;

export function getAgentPrompt(agentType: AgentType): string {
  if (!_cachedPrompts) {
    _cachedPrompts = {} as Record<AgentType, string>;
    for (const type of Object.keys(AGENT_FILE_MAP) as AgentType[]) {
      _cachedPrompts[type] = loadAgentPrompt(type) || FALLBACK_PROMPTS[type];
    }
  }
  return _cachedPrompts[agentType];
}

/** Force reload from disk (useful after editing via UI) */
export function reloadAgentPrompts(): void {
  _cachedPrompts = null;
}

/** Get the file path for an agent type */
export function getAgentFilePath(agentType: AgentType): string | null {
  const dirName = AGENT_FILE_MAP[agentType];
  if (!dirName) return null;
  const filePath = path.resolve(process.cwd(), '.claude', 'agents', dirName, 'AGENT.md');
  return fs.existsSync(filePath) ? filePath : null;
}

/** Get all agent files with their content */
export function getAllAgentFiles(): Array<{
  agentType: AgentType;
  dirName: string;
  filePath: string;
  exists: boolean;
  frontmatter: Record<string, string>;
  body: string;
}> {
  return (Object.entries(AGENT_FILE_MAP) as [AgentType, string][]).map(([agentType, dirName]) => {
    const filePath = path.resolve(process.cwd(), '.claude', 'agents', dirName, 'AGENT.md');
    const exists = fs.existsSync(filePath);
    if (exists) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseAgentMd(raw);
      return { agentType, dirName, filePath, exists, frontmatter, body };
    }
    return { agentType, dirName, filePath, exists, frontmatter: {}, body: '' };
  });
}

/** Save agent prompt body to file */
export function saveAgentPrompt(agentType: AgentType, newBody: string): boolean {
  const dirName = AGENT_FILE_MAP[agentType];
  if (!dirName) return false;

  const filePath = path.resolve(process.cwd(), '.claude', 'agents', dirName, 'AGENT.md');
  try {
    // Read existing to preserve frontmatter
    let frontmatterBlock = '';
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const match = raw.match(/^(---\s*\n[\s\S]*?\n---\s*\n)/);
      if (match) frontmatterBlock = match[1];
    }

    fs.writeFileSync(filePath, frontmatterBlock + newBody, 'utf-8');
    reloadAgentPrompts();
    return true;
  } catch {
    return false;
  }
}

// ─── Backward-compatible export ─────────────────────────────────────────────
// DEFAULT_PROMPTS reads from .md files first, falls back to hardcoded.

export const DEFAULT_PROMPTS: Record<AgentType, string> = new Proxy(
  {} as Record<AgentType, string>,
  {
    get(_target, prop: string) {
      return getAgentPrompt(prop as AgentType);
    },
  }
);

// ─── Fallback Prompts (minimal, used only if .md files missing) ─────────────

const FALLBACK_PROMPTS: Record<AgentType, string> = {
  ceo: `Tu es le Directeur Strategique IA de ColdReach pour CheckEasy.
Tu definis la strategie de demarchage optimale pour chaque segment de prospects conciergeries.
Reponds en JSON strict avec: segment, primary_angle, tone, key_pain_points, value_propositions, proof_elements, objection_frameworks, channel_priority, sequence_length, avoid, email_guidelines, linkedin_guidelines.`,

  email_writer: `Tu es un redacteur expert en emails de prospection B2B pour CheckEasy.
Tu rediges des emails a froid personnalises pour les conciergeries de location courte duree.
Maximum 150 mots, vouvoiement, francais.
Reponds en JSON strict avec: subject, body_html, body_text, personalization_hooks, tone, cta_type, word_count.`,

  linkedin_writer: `Tu es un redacteur expert en messages LinkedIn pour CheckEasy.
Tu crees des messages personnalises pour les conciergeries. Connexion max 300 caracteres, followup max 500.
Reponds en JSON strict avec: message, character_count, message_type, personalization_hooks, tone.`,

  response_handler: `Tu es un expert en analyse de reponses de prospects B2B pour CheckEasy.
Tu classifies les reponses, detectes les objections, et recommandes la prochaine action.
Reponds en JSON strict avec: sentiment, intent, objections, objection_category, suggested_response, next_action, recontact_date, confidence, priority.`,

  prospect_researcher: `Tu es un analyste expert en recherche de prospects conciergeries pour CheckEasy.
Tu analyses les donnees disponibles et produis un brief actionnable avec score ICP.
Reponds en JSON strict avec: company_description, estimated_properties, cities, digital_maturity, ota_presence, pms_used, review_score, pain_points, talking_points, recommended_angle, recommended_tone, icp_score, priority, contact_channels.`,
};
