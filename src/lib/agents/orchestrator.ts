// ─── Multi-Agent Orchestrator ───────────────────────────────────────────────
// Central orchestration layer that coordinates all AI agents for ColdReach.
// Manages strategy generation (CEO), content creation (writers), reply
// analysis, and prospect research through Claude models.

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  AgentType,
  AgentConfig,
  PromptVersion,
  AgentStrategy,
  StrategyContent,
  ProspectContext,
  CampaignContext,
  PerformanceContext,
  MemoryEntry,
  OutreachTask,
  GeneratedEmail,
  GeneratedLinkedIn,
  ReplyAnalysis,
  ProspectResearch,
  GenerationResult,
  PersonalizationScore,
} from './types';
import { AGENT_MODELS, MODEL_PRICING } from './types';
import { DEFAULT_PROMPTS } from './prompts';

// ─── Lazy Singleton Anthropic Client ────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      timeout: 30_000, // 30s timeout per request
    });
  }
  return _anthropic;
}

// ─── Context Bundle ─────────────────────────────────────────────────────────

interface BuiltContext {
  prospect: ProspectContext;
  campaign: CampaignContext;
  performance: PerformanceContext;
  memory: MemoryEntry[];
  bookingUrl?: string | null;
}

// ─── Helper: Safe JSON Parse ────────────────────────────────────────────────

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    // Try to extract JSON from possible markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleaned = jsonMatch ? jsonMatch[1].trim() : text.trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

// ─── Helper: Extract Text from Claude Response ──────────────────────────────

function extractClaudeText(
  response: Anthropic.Message
): string {
  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      text += block.text;
    }
  }
  return text;
}

// ─── Helper: Compute Cost ───────────────────────────────────────────────────

function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// ─── French City Names for Country Inference ────────────────────────────────

const FRENCH_LOCATION_MARKERS = [
  'france',
  'paris',
  'lyon',
  'marseille',
  'toulouse',
  'nice',
  'nantes',
  'strasbourg',
  'montpellier',
  'bordeaux',
  'lille',
  'rennes',
  'reims',
  'saint-etienne',
  'toulon',
  'grenoble',
  'dijon',
  'angers',
  'nimes',
  'villeurbanne',
  'clermont-ferrand',
  'le havre',
  'aix-en-provence',
  'brest',
  'limoges',
  'tours',
  'amiens',
  'perpignan',
  'metz',
  'besancon',
  'orleans',
  'rouen',
  'caen',
  'nancy',
  'argenteuil',
  'montreuil',
  'mulhouse',
];

// ─── Seniority Inference Patterns ───────────────────────────────────────────

const C_LEVEL_PATTERNS = [
  'ceo',
  'cto',
  'cfo',
  'coo',
  'cmo',
  'cio',
  'cpo',
  'directeur',
  'directrice',
  'president',
  'presidente',
  'pdg',
  'fondateur',
  'fondatrice',
  'co-fondateur',
  'co-fondatrice',
  'gerant',
  'gerante',
  'managing director',
  'general manager',
  'directeur general',
  'directrice generale',
  'vp',
  'vice president',
  'vice-president',
];

const MANAGER_PATTERNS = [
  'manager',
  'responsable',
  'chef',
  'head of',
  'lead',
  'team lead',
  'superviseur',
  'coordinateur',
  'coordinatrice',
  'chef de projet',
  'chef de produit',
  'senior',
];

// ─── Main Orchestrator Class ────────────────────────────────────────────────

export class AgentOrchestrator {
  // ─── Public: Main Entry Point ───────────────────────────────────────────

  /**
   * Generate outreach content (email or LinkedIn message) for a prospect.
   * Orchestrates: context building -> strategy -> content generation -> scoring -> logging.
   */
  async generateOutreach(task: OutreachTask): Promise<GenerationResult> {
    const startTime = Date.now();

    // 1. Build context (parallel fetches)
    const context = await this.buildContext(task);

    // 2. Get or compute strategy for this segment
    const segmentKey = this.computeSegmentKey(context.prospect);
    const strategy = await this.getOrComputeStrategy(
      task.workspaceId,
      segmentKey,
      context
    );

    // 3. Call the appropriate writer agent
    let result: GenerationResult;
    if (task.channel === 'email') {
      result = await this.callEmailWriter(task, context, strategy);
    } else {
      result = await this.callLinkedInWriter(task, context, strategy);
    }

    // 4. Calculate personalization score
    const contentText = JSON.stringify(result.content);
    const personalizationScore = this.calculatePersonalizationScore(
      contentText,
      context.prospect,
      strategy
    );
    result.metadata.personalizationScore = personalizationScore.total;
    result.metadata.generationDurationMs = Date.now() - startTime;
    result.metadata.strategyId = strategy?.id ?? null;

    // 5. Log generation and update memory (fire-and-forget)
    this.logGeneration(task, context, result).catch(console.error);
    this.updateMemory(task, result).catch(console.error);

    return result;
  }

  // ─── Public: Analyze Reply ──────────────────────────────────────────────

  /**
   * Analyze a prospect's reply to determine sentiment, intent, and next action.
   */
  async analyzeReply(
    workspaceId: string,
    prospectId: string,
    replyText: string,
    previousInteractions: Array<{ role: string; content: string; sent_at?: string }>
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const agentType: AgentType = 'response_handler';

    const { config, prompt } = await this.getAgentConfigAndPrompt(
      workspaceId,
      agentType
    );

    const prospect = await this.fetchProspectContext(workspaceId, prospectId);

    const interactionHistory = previousInteractions
      .map(
        (i) =>
          `[${i.role === 'assistant' ? 'NOUS' : 'PROSPECT'}${i.sent_at ? ' - ' + i.sent_at : ''}] ${i.content}`
      )
      .join('\n\n');

    const userMessage = `Analyse la reponse suivante d'un prospect et determine le sentiment, l'intention et la prochaine action.

PROFIL DU PROSPECT :
- Nom : ${prospect.first_name || ''} ${prospect.last_name || ''}
- Poste : ${prospect.job_title || 'Non renseigne'}
- Entreprise : ${prospect.company || 'Non renseignee'}
- Secteur : ${prospect.industry || (prospect.custom_fields?.industry as string) || 'Non renseigne'}

HISTORIQUE DES INTERACTIONS :
${interactionHistory || 'Aucune interaction precedente.'}

REPONSE DU PROSPECT A ANALYSER :
"""
${replyText}
"""

Reponds UNIQUEMENT en JSON valide selon le format specifie.`;

    const response = await getAnthropic().messages.create({
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      system: prompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = extractClaudeText(response);
    const analysis = safeJsonParse<ReplyAnalysis>(text, {
      sentiment: 'neutral',
      intent: 'needs_info',
      objections: [],
      suggested_response: '',
      next_action: 'escalate_human',
      confidence: 0,
    });

    const result: GenerationResult = {
      content: analysis as unknown as Record<string, unknown>,
      metadata: {
        agentType,
        model: config.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: computeCost(
          config.model,
          response.usage.input_tokens,
          response.usage.output_tokens
        ),
        personalizationScore: 0,
        generationDurationMs: Date.now() - startTime,
        strategyId: null,
        promptVersionId: config.active_prompt_version_id,
        cacheHit: false,
      },
    };

    return result;
  }

  // ─── Public: Research Prospect ──────────────────────────────────────────

  /**
   * Analyze prospect profile data, identify pain points and score ICP fit.
   */
  async researchProspect(
    workspaceId: string,
    prospectId: string
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const agentType: AgentType = 'prospect_researcher';

    const { config, prompt } = await this.getAgentConfigAndPrompt(
      workspaceId,
      agentType
    );

    const prospect = await this.fetchProspectContext(workspaceId, prospectId);

    const enrichmentText =
      prospect.enrichments.length > 0
        ? `\n\nDONNEES D'ENRICHISSEMENT :\n${JSON.stringify(prospect.enrichments, null, 2)}`
        : '';

    // Extract website analysis from custom_fields for a dedicated section
    const websiteAnalysis = prospect.custom_fields.website_analysis as Record<string, unknown> | undefined;
    const websiteAnalysisText = websiteAnalysis
      ? `\n\nANALYSE DU SITE WEB (donnees reelles scrapees) :
- URL : ${websiteAnalysis.url || 'N/A'}
- Titre : ${websiteAnalysis.title || 'N/A'}
- Description de l'entreprise : ${websiteAnalysis.companyDescription || websiteAnalysis.description || 'N/A'}
- Services/Produits : ${JSON.stringify(websiteAnalysis.services || [])}
- Secteur : ${JSON.stringify(websiteAnalysis.industry || 'N/A')}
- Taille estimee : ${websiteAnalysis.companySize || 'N/A'}
- Maturite digitale : ${websiteAnalysis.digitalMaturity || 'N/A'}
- Pain points identifies : ${JSON.stringify(websiteAnalysis.painPoints || [])}
- Score de pertinence CheckEasy : ${websiteAnalysis.relevanceScore || 'N/A'}
- Stack technique : ${JSON.stringify(websiteAnalysis.techStack || [])}
- Langue : ${websiteAnalysis.language || 'N/A'}
- Liens sociaux : ${JSON.stringify(websiteAnalysis.socialLinks || {})}
- Emails de contact : ${JSON.stringify(websiteAnalysis.contactEmails || [])}`
      : '';

    // Filter out website_analysis from custom_fields to avoid duplication
    const filteredCustomFields = { ...prospect.custom_fields };
    delete filteredCustomFields.website_analysis;
    delete filteredCustomFields.ai_research;
    delete filteredCustomFields.ai_research_at;

    const customFieldsText =
      Object.keys(filteredCustomFields).length > 0
        ? `\n\nCHAMPS PERSONNALISES :\n${JSON.stringify(filteredCustomFields, null, 2)}`
        : '';

    const userMessage = `Analyse le profil suivant et produis un brief de recherche complet.

PROFIL DU PROSPECT :
- Prenom : ${prospect.first_name || 'Non renseigne'}
- Nom : ${prospect.last_name || 'Non renseigne'}
- Email : ${prospect.email}
- Poste : ${prospect.job_title || 'Non renseigne'}
- Entreprise : ${prospect.company || 'Non renseignee'}
- Secteur : ${prospect.industry || 'Non renseigne'}
- Localisation : ${prospect.location || 'Non renseignee'}
- Ville : ${prospect.city || 'Non renseignee'}
- Site web : ${prospect.website || 'Non renseigne'}
- LinkedIn : ${prospect.linkedin_url || 'Non renseigne'}
- Telephone : ${prospect.phone || 'Non renseigne'}
- Nombre de biens : ${prospect.lead_score !== null ? 'Score actuel: ' + prospect.lead_score : 'Non renseigne'}
- Tags : ${prospect.tags.length > 0 ? prospect.tags.join(', ') : 'Aucun'}${websiteAnalysisText}${enrichmentText}${customFieldsText}

IMPORTANT : Si des donnees du site web sont fournies ci-dessus, utilise-les pour enrichir ton analyse. Ces donnees sont reelles et fiables.

Reponds UNIQUEMENT en JSON valide selon le format specifie.`;

    const response = await getAnthropic().messages.create({
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      system: prompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = extractClaudeText(response);
    const research = safeJsonParse<ProspectResearch>(text, {
      company_description: '',
      industry: 'unknown',
      pain_points: [],
      talking_points: [],
      recommended_angle: '',
      recommended_tone: 'semi-formel',
      icp_score: 50,
    });

    const result: GenerationResult = {
      content: research as unknown as Record<string, unknown>,
      metadata: {
        agentType,
        model: config.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: computeCost(
          config.model,
          response.usage.input_tokens,
          response.usage.output_tokens
        ),
        personalizationScore: 0,
        generationDurationMs: Date.now() - startTime,
        strategyId: null,
        promptVersionId: config.active_prompt_version_id,
        cacheHit: false,
      },
    };

    return result;
  }

  // ─── Private: Build Context ─────────────────────────────────────────────

  /**
   * Fetch prospect, campaign, performance, and memory data in parallel.
   */
  private async buildContext(task: OutreachTask): Promise<BuiltContext> {
    const [prospect, campaign, performance, memory] = await Promise.all([
      this.fetchProspectContext(task.workspaceId, task.prospectId),
      this.fetchCampaignContext(task.campaignId),
      this.fetchPerformanceContext(task.workspaceId, task.campaignId),
      this.fetchMemoryContext(task.workspaceId, task.prospectId),
    ]);

    // Fetch booking URL from the campaign's email account
    let bookingUrl: string | null = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(task.campaignId)) {
      const supabase = createAdminClient();
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('email_accounts!inner(booking_url)')
        .eq('id', task.campaignId)
        .single();
      if (campaignData) {
        const ea = campaignData.email_accounts as unknown as { booking_url: string | null };
        bookingUrl = ea?.booking_url || null;
      }
    }

    return { prospect, campaign, performance, memory, bookingUrl };
  }

  // ─── Private: Strategy Management ───────────────────────────────────────

  /**
   * Get cached strategy or compute new one via CEO agent.
   */
  private async getOrComputeStrategy(
    workspaceId: string,
    segmentKey: string,
    context: BuiltContext
  ): Promise<AgentStrategy & { strategy: StrategyContent }> {
    const supabase = createAdminClient();

    // Check for active, non-expired cached strategy
    const { data: cached } = await supabase
      .from('agent_strategies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('segment_key', segmentKey)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      return cached as AgentStrategy & { strategy: StrategyContent };
    }

    // No cached strategy; generate via CEO agent
    const strategy = await this.callCEOAgent(workspaceId, segmentKey, context);

    // Store the new strategy with 7-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: inserted, error } = await supabase
      .from('agent_strategies')
      .insert({
        workspace_id: workspaceId,
        segment_key: segmentKey,
        strategy: strategy as unknown as Record<string, unknown>,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (error || !inserted) {
      // Return a synthetic strategy object if insert fails
      return {
        id: 'synthetic',
        workspace_id: workspaceId,
        segment_key: segmentKey,
        strategy,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      };
    }

    return inserted as AgentStrategy & { strategy: StrategyContent };
  }

  /**
   * Compute a deterministic segment key from prospect attributes.
   * Format: industry_companySize_seniority_country
   */
  private computeSegmentKey(prospect: ProspectContext): string {
    const industry = this.extractIndustry(prospect);
    const companySize = this.extractCompanySize(prospect);
    const seniority = this.inferSeniority(prospect.job_title);
    const country = this.inferCountry(prospect.location);

    return `${industry}_${companySize}_${seniority}_${country}`
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
  }

  private extractIndustry(prospect: ProspectContext): string {
    if (prospect.industry) return prospect.industry;
    if (
      prospect.custom_fields?.industry &&
      typeof prospect.custom_fields.industry === 'string'
    ) {
      return prospect.custom_fields.industry;
    }
    if (prospect.company) return prospect.company;
    return 'unknown';
  }

  private extractCompanySize(prospect: ProspectContext): string {
    if (prospect.employee_count) return prospect.employee_count;
    if (
      prospect.custom_fields?.company_size &&
      typeof prospect.custom_fields.company_size === 'string'
    ) {
      return prospect.custom_fields.company_size;
    }
    return 'unknown';
  }

  private inferSeniority(jobTitle: string | null): string {
    if (!jobTitle) return 'unknown';
    const lower = jobTitle.toLowerCase();

    for (const pattern of C_LEVEL_PATTERNS) {
      if (lower.includes(pattern)) return 'c-level';
    }
    for (const pattern of MANAGER_PATTERNS) {
      if (lower.includes(pattern)) return 'manager';
    }
    return 'ic';
  }

  private inferCountry(location: string | null): string {
    if (!location) return 'unknown';
    const lower = location.toLowerCase();

    for (const marker of FRENCH_LOCATION_MARKERS) {
      if (lower.includes(marker)) return 'france';
    }
    return 'international';
  }

  // ─── Private: CEO Agent ─────────────────────────────────────────────────

  /**
   * Call the CEO agent (Claude Sonnet) to generate a strategic brief for a segment.
   */
  private async callCEOAgent(
    workspaceId: string,
    segmentKey: string,
    context: BuiltContext
  ): Promise<StrategyContent> {
    const agentType: AgentType = 'ceo';
    const { config, prompt } = await this.getAgentConfigAndPrompt(
      workspaceId,
      agentType
    );

    const performanceSummary = this.buildPerformanceSummary(context.performance);

    const userMessage = `Genere un brief strategique pour le segment suivant.

SEGMENT : ${segmentKey}

PROFIL TYPE DU SEGMENT :
- Secteur : ${this.extractIndustry(context.prospect)}
- Taille entreprise : ${this.extractCompanySize(context.prospect)}
- Niveau de seniorite : ${this.inferSeniority(context.prospect.job_title)}
- Pays : ${this.inferCountry(context.prospect.location)}

CONTEXTE DE LA CAMPAGNE :
- Nom : ${context.campaign.name}
- Description : ${context.campaign.description || 'Non renseignee'}
- Prospects totaux : ${context.campaign.total_prospects}

PERFORMANCES PASSEES :
${performanceSummary}

EXEMPLE DE PROSPECT DU SEGMENT :
- Nom : ${context.prospect.first_name || ''} ${context.prospect.last_name || ''}
- Poste : ${context.prospect.job_title || 'Non renseigne'}
- Entreprise : ${context.prospect.company || 'Non renseignee'}
- Localisation : ${context.prospect.location || 'Non renseignee'}

Reponds UNIQUEMENT en JSON valide selon le format specifie.`;

    const response = await getAnthropic().messages.create({
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      system: prompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = extractClaudeText(response);
    const strategy = safeJsonParse<StrategyContent>(text, {
      primary_angle: 'Efficacite operationnelle',
      tone: 'semi-formel',
      key_pain_points: ['Processus manuels chronophages', 'Manque de visibilite'],
      value_propositions: ['Gain de temps', 'Centralisation'],
      objection_frameworks: [],
      channel_priority: 'email_first',
      sequence_length: 4,
      avoid: [],
      email_guidelines: {
        subject_style: 'Question directe',
        max_length: 150,
        cta_style: 'Question ouverte',
      },
      linkedin_guidelines: {
        connection_angle: 'Interet commun pour le secteur',
        followup_cadence_days: 3,
      },
    });

    return strategy;
  }

  // ─── Private: Email Writer ──────────────────────────────────────────────

  /**
   * Call the email writer agent (Claude Haiku) to generate a personalized email.
   */
  private async callEmailWriter(
    task: OutreachTask,
    context: BuiltContext,
    strategy: AgentStrategy & { strategy: StrategyContent }
  ): Promise<GenerationResult> {
    const agentType: AgentType = 'email_writer';
    const { config, prompt } = await this.getAgentConfigAndPrompt(
      task.workspaceId,
      agentType
    );

    const strat = strategy.strategy;
    const memoryContext = this.buildMemoryContext(context.memory);

    const userMessage = `Redige un email de prospection (etape ${task.stepNumber} sur ${strat.sequence_length}).

BRIEF STRATEGIQUE :
- Angle principal : ${strat.primary_angle}
- Ton : ${strat.tone}
- Points de douleur cibles : ${strat.key_pain_points.join(', ')}
- Propositions de valeur : ${strat.value_propositions.join(', ')}
- Style objet : ${strat.email_guidelines.subject_style}
- Longueur max : ${strat.email_guidelines.max_length} mots
- Style CTA : ${strat.email_guidelines.cta_style}
- A eviter : ${strat.avoid.length > 0 ? strat.avoid.join(', ') : 'Rien de specifique'}

PROFIL DU PROSPECT :
- Prenom : ${context.prospect.first_name || 'Non renseigne'}
- Nom : ${context.prospect.last_name || 'Non renseigne'}
- Email : ${context.prospect.email}
- Poste : ${context.prospect.job_title || 'Non renseigne'}
- Entreprise : ${context.prospect.company || 'Non renseignee'}
- Secteur : ${(context.prospect.custom_fields?.industry as string) || 'Non renseigne'}
- Localisation : ${context.prospect.location || 'Non renseignee'}
- Site web : ${context.prospect.website || 'Non renseigne'}
${context.prospect.enrichments.length > 0 ? `\nENRICHISSEMENTS :\n${JSON.stringify(context.prospect.enrichments, null, 2)}` : ''}

PERFORMANCES :
- Taux d'ouverture : ${(context.performance.openRate * 100).toFixed(1)}%
- Taux de reponse : ${(context.performance.replyRate * 100).toFixed(1)}%
${context.performance.bestSubjectPatterns.length > 0 ? `- Meilleurs patterns objet : ${context.performance.bestSubjectPatterns.map((p) => p.pattern).join(', ')}` : ''}
${context.performance.avoidSubjects.length > 0 ? `- Objets a eviter : ${context.performance.avoidSubjects.join(', ')}` : ''}

${memoryContext}
${context.bookingUrl ? `LIEN DE PRISE DE RENDEZ-VOUS : ${context.bookingUrl}
Tu PEUX proposer ce lien dans l'email si c'est pertinent (ex: "Si vous souhaitez en discuter, voici un lien pour reserver un creneau : ${context.bookingUrl}").
Le lien doit paraitre naturel, ne le force pas si ca ne colle pas.` : ''}
${task.abTestVariant ? `VARIANTE A/B : ${task.abTestVariant} - Propose une approche differente.` : ''}

Reponds UNIQUEMENT en JSON valide selon le format specifie.`;

    const response = await getAnthropic().messages.create({
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      system: prompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = extractClaudeText(response);
    const email = safeJsonParse<GeneratedEmail>(text, {
      subject: '',
      body_html: '',
      body_text: '',
      personalization_hooks: [],
      tone: strat.tone,
      cta_type: 'question_ouverte',
    });

    return {
      content: email as unknown as Record<string, unknown>,
      metadata: {
        agentType,
        model: config.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: computeCost(
          config.model,
          response.usage.input_tokens,
          response.usage.output_tokens
        ),
        personalizationScore: 0, // Computed after return
        generationDurationMs: 0, // Computed after return
        strategyId: strategy.id,
        promptVersionId: config.active_prompt_version_id,
        cacheHit: false,
      },
    };
  }

  // ─── Private: LinkedIn Writer ───────────────────────────────────────────

  /**
   * Call the LinkedIn writer agent (Claude Haiku) to generate a LinkedIn message.
   */
  private async callLinkedInWriter(
    task: OutreachTask,
    context: BuiltContext,
    strategy: AgentStrategy & { strategy: StrategyContent }
  ): Promise<GenerationResult> {
    const agentType: AgentType = 'linkedin_writer';
    const { config, prompt } = await this.getAgentConfigAndPrompt(
      task.workspaceId,
      agentType
    );

    const strat = strategy.strategy;
    const messageType = task.linkedinMessageType || 'connection';
    const memoryContext = this.buildMemoryContext(context.memory);

    const maxChars = messageType === 'connection' ? 300 : 500;

    const userMessage = `Redige un message LinkedIn de type "${messageType}" (etape ${task.stepNumber}).

BRIEF STRATEGIQUE :
- Angle principal : ${strat.primary_angle}
- Ton : ${strat.tone}
- Points de douleur cibles : ${strat.key_pain_points.join(', ')}
- Angle de connexion : ${strat.linkedin_guidelines.connection_angle}
- A eviter : ${strat.avoid.length > 0 ? strat.avoid.join(', ') : 'Rien de specifique'}

PROFIL DU PROSPECT :
- Prenom : ${context.prospect.first_name || 'Non renseigne'}
- Nom : ${context.prospect.last_name || 'Non renseigne'}
- Poste : ${context.prospect.job_title || 'Non renseigne'}
- Entreprise : ${context.prospect.company || 'Non renseignee'}
- Secteur : ${(context.prospect.custom_fields?.industry as string) || 'Non renseigne'}
- Localisation : ${context.prospect.location || 'Non renseignee'}
- LinkedIn : ${context.prospect.linkedin_url || 'Non renseigne'}
${context.prospect.enrichments.length > 0 ? `\nENRICHISSEMENTS :\n${JSON.stringify(context.prospect.enrichments, null, 2)}` : ''}

CONTRAINTE : Le message doit faire MAXIMUM ${maxChars} caracteres.

${memoryContext}

Reponds UNIQUEMENT en JSON valide selon le format specifie.`;

    const response = await getAnthropic().messages.create({
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      system: prompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = extractClaudeText(response);
    const linkedin = safeJsonParse<GeneratedLinkedIn>(text, {
      message: '',
      character_count: 0,
      message_type: messageType,
      personalization_hooks: [],
      tone: strat.tone,
    });

    // Safety: enforce character limits
    if (linkedin.message.length > maxChars) {
      linkedin.message = linkedin.message.substring(0, maxChars - 3) + '...';
      linkedin.character_count = linkedin.message.length;
    }

    return {
      content: linkedin as unknown as Record<string, unknown>,
      metadata: {
        agentType,
        model: config.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: computeCost(
          config.model,
          response.usage.input_tokens,
          response.usage.output_tokens
        ),
        personalizationScore: 0,
        generationDurationMs: 0,
        strategyId: strategy.id,
        promptVersionId: config.active_prompt_version_id,
        cacheHit: false,
      },
    };
  }

  // ─── Private: Personalization Scoring ───────────────────────────────────

  /**
   * Score personalization quality from 0-100 based on multiple criteria.
   */
  private calculatePersonalizationScore(
    contentText: string,
    prospect: ProspectContext,
    strategy: AgentStrategy & { strategy: StrategyContent } | null
  ): PersonalizationScore {
    const lower = contentText.toLowerCase();

    // +10 if first_name or last_name appears
    const nameUsed =
      (!!prospect.first_name && lower.includes(prospect.first_name.toLowerCase())) ||
      (!!prospect.last_name && lower.includes(prospect.last_name.toLowerCase()));

    // +10 if company name appears
    const companyUsed =
      !!prospect.company && lower.includes(prospect.company.toLowerCase());

    // +15 if job_title / role referenced
    const roleReferenced =
      !!prospect.job_title &&
      lower.includes(prospect.job_title.toLowerCase().split(' ')[0]);

    // +20 if industry-specific pain point mentioned
    const industry = (prospect.custom_fields?.industry as string) || '';
    const industryPainPoint =
      !!industry &&
      (lower.includes(industry.toLowerCase()) ||
        (strategy?.strategy.key_pain_points || []).some((pp) =>
          lower.includes(pp.toLowerCase().substring(0, 20))
        ));

    // +15 if company-specific reference from enrichment
    const companySpecificRef =
      prospect.enrichments.length > 0 &&
      prospect.enrichments.some((e) => {
        const enrichText = JSON.stringify(e).toLowerCase();
        // Check if any enrichment keyword (>5 chars) appears in content
        const words = enrichText.split(/\s+/).filter((w) => w.length > 5);
        return words.some((w) => lower.includes(w));
      });

    // +15 if language matches prospect location (French for France)
    const isFrench = this.inferCountry(prospect.location) === 'france';
    const contentIsFrench =
      lower.includes('vous') || lower.includes('votre') || lower.includes('nous');
    const languageMatched = isFrench ? contentIsFrench : true;

    // +15 if tone matches strategy
    const toneMatched = (() => {
      if (!strategy) return false;
      const stratTone = strategy.strategy.tone;
      if (stratTone === 'formel')
        return lower.includes('vous') && !lower.includes('!');
      if (stratTone === 'decontracte')
        return lower.includes('!') || lower.includes(':)');
      // semi-formel is the middle ground, accept either
      return true;
    })();

    const total =
      (nameUsed ? 10 : 0) +
      (companyUsed ? 10 : 0) +
      (roleReferenced ? 15 : 0) +
      (industryPainPoint ? 20 : 0) +
      (companySpecificRef ? 15 : 0) +
      (languageMatched ? 15 : 0) +
      (toneMatched ? 15 : 0);

    return {
      total,
      prospect_name_used: nameUsed,
      company_name_used: companyUsed,
      role_referenced: roleReferenced,
      industry_specific_pain_point: industryPainPoint,
      company_specific_reference: companySpecificRef,
      language_matched: languageMatched,
      tone_matched_to_segment: toneMatched,
    };
  }

  // ─── Private: Logging & Memory ──────────────────────────────────────────

  /**
   * Store the generation result in agent_generation_log.
   */
  private async logGeneration(
    task: OutreachTask,
    context: BuiltContext,
    result: GenerationResult
  ): Promise<void> {
    const supabase = createAdminClient();

    await supabase.from('agent_generation_log').insert({
      workspace_id: task.workspaceId,
      prospect_id: task.prospectId,
      campaign_id: task.campaignId,
      agent_type: result.metadata.agentType,
      model: result.metadata.model,
      channel: task.channel,
      step_number: task.stepNumber,
      input_tokens: result.metadata.inputTokens,
      output_tokens: result.metadata.outputTokens,
      cost_usd: result.metadata.costUsd,
      personalization_score: result.metadata.personalizationScore,
      generation_duration_ms: result.metadata.generationDurationMs,
      strategy_id: result.metadata.strategyId,
      prompt_version_id: result.metadata.promptVersionId,
      content: result.content,
      segment_key: this.computeSegmentKey(context.prospect),
      ab_variant: task.abTestVariant || null,
    });
  }

  /**
   * Add generation metadata to agent_memory for the prospect.
   */
  private async updateMemory(
    task: OutreachTask,
    result: GenerationResult
  ): Promise<void> {
    const supabase = createAdminClient();

    await supabase.from('agent_memory').insert({
      workspace_id: task.workspaceId,
      prospect_id: task.prospectId,
      campaign_id: task.campaignId,
      memory_type: `${task.channel}_generation`,
      content: {
        step_number: task.stepNumber,
        agent_type: result.metadata.agentType,
        personalization_score: result.metadata.personalizationScore,
        cost_usd: result.metadata.costUsd,
        content_preview:
          task.channel === 'email'
            ? (result.content as unknown as GeneratedEmail).subject
            : (result.content as unknown as GeneratedLinkedIn).message?.substring(
                0,
                100
              ),
      },
      sequence_order: task.stepNumber,
    });
  }

  // ─── Private: Data Fetchers ─────────────────────────────────────────────

  /**
   * Fetch prospect profile and enrichments from Supabase.
   */
  private async fetchProspectContext(
    workspaceId: string,
    prospectId: string
  ): Promise<ProspectContext> {
    const supabase = createAdminClient();

    const { data: prospect, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !prospect) {
      throw new Error(
        `Prospect not found: ${prospectId} in workspace ${workspaceId}`
      );
    }

    // Fetch enrichments if table exists
    const { data: enrichments } = await supabase
      .from('prospect_enrichments')
      .select('data')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      id: prospect.id,
      first_name: prospect.first_name,
      last_name: prospect.last_name,
      email: prospect.email,
      company: prospect.company,
      job_title: prospect.job_title,
      phone: prospect.phone,
      linkedin_url: prospect.linkedin_url,
      website: prospect.website,
      location: prospect.location,
      notes: prospect.notes || null,
      industry: prospect.industry || null,
      city: prospect.city || null,
      employee_count: prospect.employee_count || null,
      tags: (prospect.tags as string[]) || [],
      lead_score: prospect.lead_score ?? null,
      custom_fields: (prospect.custom_fields as Record<string, unknown>) || {},
      enrichments: enrichments?.map((e) => e.data as Record<string, unknown>) || [],
    };
  }

  /**
   * Fetch campaign stats from Supabase.
   */
  private async fetchCampaignContext(
    campaignId: string
  ): Promise<CampaignContext> {
    // If campaignId is not a valid UUID, return empty context
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(campaignId)) {
      return {
        id: campaignId,
        name: 'Analyse strategique',
        description: null,
        total_prospects: 0,
        total_sent: 0,
        total_opened: 0,
        total_replied: 0,
      };
    }

    const supabase = createAdminClient();

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(
        'id, name, description, total_prospects, total_sent, total_opened, total_replied'
      )
      .eq('id', campaignId)
      .single();

    if (error || !campaign) {
      return {
        id: campaignId,
        name: 'Campagne inconnue',
        description: null,
        total_prospects: 0,
        total_sent: 0,
        total_opened: 0,
        total_replied: 0,
      };
    }

    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      total_prospects: campaign.total_prospects,
      total_sent: campaign.total_sent,
      total_opened: campaign.total_opened,
      total_replied: campaign.total_replied,
    };
  }

  /**
   * Compute aggregate performance metrics for the workspace/campaign.
   */
  private async fetchPerformanceContext(
    workspaceId: string,
    campaignId: string
  ): Promise<PerformanceContext> {
    const supabase = createAdminClient();

    // Get campaign stats (skip if campaignId is not a valid UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const { data: campaign } = uuidRegex.test(campaignId)
      ? await supabase
          .from('campaigns')
          .select('total_sent, total_opened, total_clicked, total_replied')
          .eq('id', campaignId)
          .single()
      : { data: null };

    const totalSent = campaign?.total_sent || 0;
    const openRate = totalSent > 0 ? (campaign?.total_opened || 0) / totalSent : 0;
    const replyRate = totalSent > 0 ? (campaign?.total_replied || 0) / totalSent : 0;
    const clickRate = totalSent > 0 ? (campaign?.total_clicked || 0) / totalSent : 0;

    // Fetch best-performing subject patterns from generation log
    const { data: subjectLogs } = await supabase
      .from('agent_generation_log')
      .select('content')
      .eq('workspace_id', workspaceId)
      .eq('channel', 'email')
      .order('personalization_score', { ascending: false })
      .limit(10);

    const bestSubjectPatterns: Array<{ pattern: string; open_rate: number }> = [];
    const bestCtaPatterns: Array<{ pattern: string; reply_rate: number }> = [];

    if (subjectLogs) {
      for (const log of subjectLogs) {
        const content = log.content as Record<string, unknown>;
        if (content?.subject && typeof content.subject === 'string') {
          bestSubjectPatterns.push({
            pattern: content.subject,
            open_rate: openRate,
          });
        }
        if (content?.cta_type && typeof content.cta_type === 'string') {
          bestCtaPatterns.push({
            pattern: content.cta_type,
            reply_rate: replyRate,
          });
        }
      }
    }

    return {
      totalSent,
      openRate,
      replyRate,
      clickRate,
      bestSubjectPatterns: bestSubjectPatterns.slice(0, 5),
      bestCtaPatterns: bestCtaPatterns.slice(0, 5),
      bestTone: 'semi-formel', // Default; could be computed from logs
      avoidSubjects: [],
      avoidApproaches: [],
    };
  }

  /**
   * Fetch memory entries for a prospect in a workspace.
   */
  private async fetchMemoryContext(
    workspaceId: string,
    prospectId: string
  ): Promise<MemoryEntry[]> {
    const supabase = createAdminClient();

    const { data: memories } = await supabase
      .from('agent_memory')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('prospect_id', prospectId)
      .order('sequence_order', { ascending: true })
      .limit(20);

    if (!memories) return [];

    return memories.map((m) => ({
      id: m.id,
      memory_type: m.memory_type,
      content: m.content as Record<string, unknown>,
      sequence_order: m.sequence_order,
      created_at: m.created_at,
    }));
  }

  // ─── Private: Agent Config & Prompt Resolution ──────────────────────────

  /**
   * Get agent config and active prompt for a workspace+agent_type.
   * Creates defaults if none exist.
   */
  private async getAgentConfigAndPrompt(
    workspaceId: string,
    agentType: AgentType
  ): Promise<{ config: AgentConfig; prompt: string }> {
    const config = await this.getAgentConfig(workspaceId, agentType);

    let prompt: string;
    if (config.active_prompt_version_id) {
      const activePrompt = await this.getActivePrompt(
        config.active_prompt_version_id
      );
      prompt = activePrompt?.system_prompt || DEFAULT_PROMPTS[agentType];
    } else {
      prompt = DEFAULT_PROMPTS[agentType];
    }

    return { config, prompt };
  }

  /**
   * Fetch or create agent config for a workspace+agent_type.
   */
  private async getAgentConfig(
    workspaceId: string,
    agentType: AgentType
  ): Promise<AgentConfig> {
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('agent_type', agentType)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (existing) {
      return existing as AgentConfig;
    }

    // Create default config
    const model = AGENT_MODELS[agentType];
    const defaultConfig = {
      workspace_id: workspaceId,
      agent_type: agentType,
      name: this.getDefaultAgentName(agentType),
      description: this.getDefaultAgentDescription(agentType),
      model,
      temperature: agentType === 'ceo' || agentType === 'response_handler' ? 0.7 : 0.8,
      max_tokens: agentType === 'ceo' ? 2048 : 1024,
      active_prompt_version_id: null,
      settings: {},
      is_active: true,
    };

    const { data: created, error } = await supabase
      .from('agent_configs')
      .insert(defaultConfig)
      .select()
      .single();

    if (error || !created) {
      // Return a synthetic config if insert fails
      return {
        id: 'default',
        ...defaultConfig,
      } as AgentConfig;
    }

    // Also create the initial prompt version
    const { data: promptVersion } = await supabase
      .from('agent_prompt_versions')
      .insert({
        agent_config_id: created.id,
        version: 1,
        system_prompt: DEFAULT_PROMPTS[agentType],
        prompt_metadata: {},
        is_active: true,
      })
      .select()
      .single();

    // Link prompt version to config
    if (promptVersion) {
      await supabase
        .from('agent_configs')
        .update({ active_prompt_version_id: promptVersion.id })
        .eq('id', created.id);

      (created as AgentConfig).active_prompt_version_id = promptVersion.id;
    }

    return created as AgentConfig;
  }

  /**
   * Fetch active prompt version by ID.
   */
  private async getActivePrompt(
    promptVersionId: string
  ): Promise<PromptVersion | null> {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from('agent_prompt_versions')
      .select('*')
      .eq('id', promptVersionId)
      .single();

    return data as PromptVersion | null;
  }

  // ─── Private: Formatting Helpers ────────────────────────────────────────

  private buildPerformanceSummary(performance: PerformanceContext): string {
    if (performance.totalSent === 0) {
      return 'Aucune donnee de performance disponible (premiere campagne).';
    }

    const lines = [
      `- Emails envoyes : ${performance.totalSent}`,
      `- Taux d'ouverture : ${(performance.openRate * 100).toFixed(1)}%`,
      `- Taux de reponse : ${(performance.replyRate * 100).toFixed(1)}%`,
      `- Taux de clic : ${(performance.clickRate * 100).toFixed(1)}%`,
    ];

    if (performance.bestSubjectPatterns.length > 0) {
      lines.push(
        `- Meilleurs patterns objet : ${performance.bestSubjectPatterns.map((p) => `"${p.pattern}" (${(p.open_rate * 100).toFixed(0)}%)`).join(', ')}`
      );
    }

    if (performance.bestTone) {
      lines.push(`- Meilleur ton : ${performance.bestTone}`);
    }

    if (performance.avoidSubjects.length > 0) {
      lines.push(
        `- Objets a eviter : ${performance.avoidSubjects.join(', ')}`
      );
    }

    if (performance.avoidApproaches.length > 0) {
      lines.push(
        `- Approches a eviter : ${performance.avoidApproaches.join(', ')}`
      );
    }

    return lines.join('\n');
  }

  private buildMemoryContext(memory: MemoryEntry[]): string {
    if (memory.length === 0) {
      return 'HISTORIQUE : Aucune interaction precedente avec ce prospect.';
    }

    const lines = memory.map((m) => {
      const preview =
        typeof m.content?.content_preview === 'string'
          ? m.content.content_preview
          : JSON.stringify(m.content).substring(0, 100);
      return `- [Etape ${m.sequence_order}] ${m.memory_type}: ${preview}`;
    });

    return `HISTORIQUE DES INTERACTIONS :\n${lines.join('\n')}`;
  }

  private getDefaultAgentName(agentType: AgentType): string {
    const names: Record<AgentType, string> = {
      ceo: 'Directeur Strategique',
      email_writer: 'Redacteur Email',
      linkedin_writer: 'Redacteur LinkedIn',
      response_handler: 'Analyseur de Reponses',
      prospect_researcher: 'Chercheur de Prospects',
    };
    return names[agentType];
  }

  private getDefaultAgentDescription(agentType: AgentType): string {
    const descriptions: Record<AgentType, string> = {
      ceo: 'Genere des briefs strategiques pour chaque segment de prospects.',
      email_writer: 'Redige des emails de prospection personnalises.',
      linkedin_writer: 'Redige des messages LinkedIn de prospection personnalises.',
      response_handler: 'Analyse les reponses des prospects et determine les actions.',
      prospect_researcher:
        'Analyse les profils de prospects et evalue leur adequation.',
    };
    return descriptions[agentType];
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

let _orchestrator: AgentOrchestrator | null = null;

export function getOrchestrator(): AgentOrchestrator {
  if (!_orchestrator) {
    _orchestrator = new AgentOrchestrator();
  }
  return _orchestrator;
}
