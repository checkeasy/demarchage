# ColdReach Multi-Agent Architecture
# Claude + MCP Orchestrated AI System for Outbound Sales Automation
# Version 1.0 - February 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [How MCP Works Technically](#2-how-mcp-works-technically)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Agent Definitions & Hierarchy](#4-agent-definitions--hierarchy)
5. [Multi-Agent Orchestration Pattern](#5-multi-agent-orchestration-pattern)
6. [Personalization Engine](#6-personalization-engine)
7. [Learning Loop](#7-learning-loop)
8. [Database Schema](#8-database-schema)
9. [API Flow & Implementation](#9-api-flow--implementation)
10. [Agent Prompt Structures](#10-agent-prompt-structures)
11. [Cost Analysis](#11-cost-analysis)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Differentiation Strategy](#13-differentiation-strategy)

---

## 1. Executive Summary

ColdReach is a multi-agent outbound sales automation SaaS built on a **CEO Agent + Specialized Sub-Agents** hierarchy, powered by Anthropic Claude via the **Model Context Protocol (MCP)**.

**Core innovation**: Instead of a monolithic prompt generating emails, ColdReach uses a hierarchy of specialized AI agents that communicate through MCP, share a structured memory layer, and continuously learn from campaign performance data. The CEO Agent acts as the strategic brain, delegating to specialized agents who each master one aspect of outbound sales.

**Key architectural decisions**:
- MCP is used as the **internal communication protocol** between our Next.js backend and the agent layer, NOT as an external integration protocol
- Claude Haiku 4.5 for high-volume operations (email writing, message generation)
- Claude Sonnet 4.5 for the CEO Agent (strategic decisions, performance analysis)
- Claude Opus 4.5 reserved only for complex prospect research on high-value targets
- All agent configurations, prompts, and memory stored in Supabase with workspace isolation
- Learning loop via a dedicated analytics pipeline that feeds performance data back into agent prompts

---

## 2. How MCP Works Technically

### 2.1 Protocol Fundamentals

MCP (Model Context Protocol) is an open standard created by Anthropic that provides a standardized way for AI applications to connect to external tools, data sources, and services. It uses **JSON-RPC 2.0** over various transports.

**Three core primitives**:

| Primitive | Who Controls It | What It Does |
|-----------|----------------|--------------|
| **Tools** | Model-driven (AI decides when to call) | Executable functions that perform actions |
| **Resources** | Application-driven (app decides what to expose) | Read-only data the AI can access |
| **Prompts** | User-driven (templates for common tasks) | Reusable structured message templates |

### 2.2 Transport Options

```
[MCP Client] <--JSON-RPC 2.0--> [MCP Server]

Transports:
  1. STDIO       - For local processes (subprocess communication)
  2. Streamable HTTP - For remote servers (our choice)
     - POST /mcp  -> Send requests to server
     - GET  /mcp  -> SSE stream for server notifications
     - DELETE /mcp -> Terminate session
     - Header: Mcp-Session-Id for stateful sessions
```

### 2.3 How We Use MCP in ColdReach

**Our approach**: We build MCP servers that wrap each specialized agent. Our Next.js backend acts as the MCP client that calls these servers.

```
                    +------------------+
                    |   Next.js App    |
                    |  (MCP Client)    |
                    +--------+---------+
                             |
              JSON-RPC 2.0 / Streamable HTTP
                             |
         +-------------------+-------------------+
         |          |           |          |
    +----v----+ +---v----+ +---v----+ +---v------+
    |Email    | |LinkedIn| |Response| |Prospect  |
    |Writer   | |Writer  | |Handler | |Researcher|
    |MCP Srv  | |MCP Srv | |MCP Srv | |MCP Srv   |
    +---------+ +--------+ +--------+ +----------+
         |          |           |          |
         +----------+-----------+----------+
                    |
              +-----v------+
              | CEO Agent  |
              | MCP Server |
              +------------+
```

**Critical insight**: We are NOT using MCP to connect Claude to external APIs. We are using MCP as the **inter-agent communication protocol** inside our own system. Each agent is an MCP server that exposes tools, resources, and prompts. The orchestrator (CEO Agent) is both an MCP client (calling sub-agents) and an MCP server (exposable to the Next.js app).

### 2.4 MCP Server Implementation Pattern (TypeScript)

Each agent is implemented as an MCP server using the official TypeScript SDK:

```typescript
// Example: Email Writer Agent as MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const server = new McpServer({
  name: "coldreach-email-writer",
  version: "1.0.0",
});

// TOOL: Generate a cold email
server.tool(
  "generate_cold_email",
  "Generate a personalized cold email for a prospect",
  {
    prospect_id: z.string().uuid(),
    campaign_id: z.string().uuid(),
    step_number: z.number().int().min(1).max(7),
    tone: z.enum(["formel", "semi-formel", "decontracte"]),
    strategy_override: z.string().optional(),
  },
  async ({ prospect_id, campaign_id, step_number, tone, strategy_override }) => {
    // 1. Fetch prospect data + enrichment from Supabase
    // 2. Fetch CEO Agent strategy for this segment
    // 3. Fetch performance data for similar prospects
    // 4. Build optimized prompt
    // 5. Call Claude API (Haiku for cost efficiency)
    // 6. Log generation + return result
    return {
      content: [{ type: "text", text: JSON.stringify(emailResult) }],
    };
  }
);

// RESOURCE: Expose best-performing email templates
server.resource(
  "top-emails://{workspace_id}",
  "Top performing email templates for a workspace",
  async (uri) => {
    const workspaceId = uri.pathname.split("/").pop();
    // Fetch from Supabase
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(topEmails) }],
    };
  }
);

// PROMPT: Reusable cold email prompt template
server.prompt(
  "cold_email_sequence",
  "Generate a full cold email sequence",
  [
    { name: "prospect_context", description: "JSON with prospect data", required: true },
    { name: "company_context", description: "JSON with company/product data", required: true },
    { name: "performance_context", description: "JSON with past performance stats", required: false },
  ],
  async ({ prospect_context, company_context, performance_context }) => {
    return {
      messages: [
        { role: "user", content: { type: "text", text: buildEmailPrompt(prospect_context, company_context, performance_context) } },
      ],
    };
  }
);
```

### 2.5 Practical Architecture Decision

**After thorough analysis, the recommended approach for ColdReach v1 is a HYBRID**:

- **Phase 1 (MVP)**: Direct Claude API calls orchestrated by a TypeScript orchestrator class (no MCP overhead). This is simpler, faster to build, and sufficient for the initial product.
- **Phase 2 (Scale)**: Migrate each agent to a standalone MCP server for true modularity, independent scaling, and the ability to swap AI providers per agent.
- **Phase 3 (Platform)**: Expose the agent MCP servers to users via MCP, allowing power users to connect their own MCP clients.

The rationale: MCP adds operational complexity (server management, session handling, transport overhead). For a single-team SaaS, the orchestrator pattern with direct API calls is simpler. MCP becomes valuable when agents need to be independently deployable, swappable, or externally accessible.

---

## 3. System Architecture Overview

### 3.1 Full System Diagram

```
+============================================================================+
|                           COLDREACH SYSTEM                                  |
|                                                                             |
|  +------------------------------------------------------------------+      |
|  |                    NEXT.JS APPLICATION                            |      |
|  |                                                                   |      |
|  |  +------------------+  +-------------------+  +--------------+   |      |
|  |  | Campaign Manager |  | Prospect Pipeline |  | Dashboard    |   |      |
|  |  | (UI + API)       |  | (Import/Enrich)   |  | (Analytics)  |   |      |
|  |  +--------+---------+  +--------+----------+  +------+-------+   |      |
|  |           |                     |                     |           |      |
|  |  +--------v---------------------v---------------------v-------+  |      |
|  |  |              AGENT ORCHESTRATOR (TypeScript)                |  |      |
|  |  |                                                             |  |      |
|  |  |  1. Receives task (generate email for prospect X)          |  |      |
|  |  |  2. Calls CEO Agent for strategy                           |  |      |
|  |  |  3. Dispatches to specialized agent                        |  |      |
|  |  |  4. Validates output                                       |  |      |
|  |  |  5. Stores result + logs tokens                            |  |      |
|  |  +----+----------+----------+----------+----------------------+  |      |
|  |       |          |          |          |                         |      |
|  +-------+----------+----------+----------+-------------------------+      |
|          |          |          |          |                                  |
|  +-------v---+ +---v-----+ +-v-------+ +v-----------+                     |
|  | CEO       | | Email   | |LinkedIn | | Prospect   |                     |
|  | Agent     | | Writer  | |Writer   | | Researcher |                     |
|  |           | | Agent   | |Agent    | | Agent      |                     |
|  | Sonnet4.5 | | Haiku4.5| |Haiku4.5 | | Haiku/Son  |                     |
|  +-----------+ +---------+ +---------+ +------------+                     |
|       |             |          |              |                             |
|       +-------------+----------+--------------+                             |
|                     |                                                       |
|              +------v-------+                                               |
|              | Response     |                                               |
|              | Handler      |                                               |
|              | Agent        |                                               |
|              | Sonnet 4.5   |                                               |
|              +--------------+                                               |
|                                                                             |
|  +------------------------------------------------------------------+      |
|  |                    DATA LAYER                                     |      |
|  |                                                                   |      |
|  |  +----------------+  +--------------+  +--------------------+    |      |
|  |  | Supabase PG    |  | Agent Memory |  | Performance Store  |    |      |
|  |  | (core tables)  |  | (context DB) |  | (analytics)        |    |      |
|  |  +----------------+  +--------------+  +--------------------+    |      |
|  |                                                                   |      |
|  +------------------------------------------------------------------+      |
|                                                                             |
|  +------------------------------------------------------------------+      |
|  |                    EXECUTION LAYER                                |      |
|  |                                                                   |      |
|  |  +-----------+  +------------+  +-----------+  +-------------+   |      |
|  |  | Email     |  | LinkedIn   |  | Webhook   |  | Cron Jobs   |   |      |
|  |  | Sender    |  | Automation |  | Handlers  |  | (scheduler) |   |      |
|  |  | (SMTP/    |  | (API)      |  | (Resend/  |  |             |   |      |
|  |  |  Resend)  |  |            |  |  tracking)|  |             |   |      |
|  |  +-----------+  +------------+  +-----------+  +-------------+   |      |
|  +------------------------------------------------------------------+      |
+============================================================================+
```

### 3.2 Request Flow: Generating a Cold Email

```
User clicks "Generate Email" for Prospect X in Campaign Y
    |
    v
[POST /api/ai/orchestrate]
    |
    v
[Agent Orchestrator]
    |
    +---> 1. Fetch prospect data from Supabase
    |         (prospect, enrichment, website analysis, previous interactions)
    |
    +---> 2. Call CEO Agent (Sonnet 4.5)
    |         Input:  prospect segment, campaign goals, current performance
    |         Output: strategy brief (tone, angle, key points, what to avoid)
    |
    +---> 3. Route to Email Writer Agent (Haiku 4.5)
    |         Input:  prospect data + CEO strategy + performance context
    |         Output: generated email (subject + body + metadata)
    |
    +---> 4. [Optional] Response Handler reviews if this is a follow-up
    |         Input:  previous emails + replies + email output
    |         Output: adjusted email or approval
    |
    +---> 5. Validate output (length, language, personalization score)
    |
    +---> 6. Store in agent_generations table + return to UI
    |
    v
User sees generated email, can edit, then send
```

---

## 4. Agent Definitions & Hierarchy

### 4.1 CEO Agent (Strategic Brain)

**Model**: Claude Sonnet 4.5 (best cost/performance for strategic reasoning)
**Invocation frequency**: Once per campaign setup + once per weekly strategy review + on-demand for high-value prospects

**Responsibilities**:
- Define outreach strategy per prospect segment
- Analyze aggregate performance data and adjust approach
- Set tone, messaging pillars, objection handling frameworks
- Decide channel priority (email first vs LinkedIn first)
- Flag underperforming segments for strategy change
- Generate "strategy briefs" consumed by sub-agents

**What the CEO Agent knows** (context injected per workspace):
- Complete company profile (product, value prop, ICP, differentiators)
- Target audience segments with persona details
- Historical campaign performance (aggregated)
- Competitive positioning notes
- Brand voice guidelines
- Past strategy decisions and their outcomes

### 4.2 Email Writer Agent

**Model**: Claude Haiku 4.5 (high volume, cost-efficient)
**Invocation frequency**: Per prospect per email step (highest volume agent)

**Responsibilities**:
- Write cold emails (initial + follow-ups + breakup)
- Generate subject lines optimized for opens
- Apply CEO Agent strategy to individual prospect context
- Adapt language to prospect's country/language
- Incorporate enrichment data (website analysis, LinkedIn profile)
- Generate A/B variants when configured

### 4.3 LinkedIn Writer Agent

**Model**: Claude Haiku 4.5
**Invocation frequency**: Per prospect per LinkedIn step

**Responsibilities**:
- Write connection request messages (max 300 chars)
- Write follow-up LinkedIn messages
- Adapt to LinkedIn's informal/direct culture vs email's formal style
- Maintain cross-channel coherence (same narrative as email, different format)
- Generate icebreakers from profile data

### 4.4 Response Handler Agent

**Model**: Claude Sonnet 4.5 (needs reasoning for reply classification)
**Invocation frequency**: Per incoming reply (lower volume, higher stakes)

**Responsibilities**:
- Classify reply sentiment (positive/negative/neutral/OOO/bounce)
- Detect objections and map to objection-handling frameworks
- Suggest response drafts
- Decide: continue sequence, pause, escalate to human, or book meeting
- Extract intent signals from replies (interest level, timing, referrals)
- Update prospect status based on reply analysis

### 4.5 Prospect Researcher Agent

**Model**: Claude Haiku 4.5 (standard research) / Sonnet 4.5 (deep research on high-value)
**Invocation frequency**: Per new prospect or pre-outreach enrichment

**Responsibilities**:
- Analyze prospect LinkedIn profile
- Analyze prospect company website
- Identify pain points relevant to the client's product
- Score prospect fit (ICP match)
- Extract key talking points
- Detect recent company news/triggers
- Determine best outreach angle

---

## 5. Multi-Agent Orchestration Pattern

### 5.1 Orchestrator-Worker Pattern

Following Anthropic's recommended pattern, ColdReach uses an **orchestrator-workers** architecture:

```
                    +-------------------+
                    |   ORCHESTRATOR    |
                    |   (TypeScript)    |
                    |                   |
                    |  - Task routing   |
                    |  - Context build  |
                    |  - Result merge   |
                    |  - Error handling |
                    +----+----+----+---+
                         |    |    |
              +----------+    |    +----------+
              |               |               |
         +----v----+    +----v----+    +-----v-----+
         | Agent A |    | Agent B |    | Agent C   |
         | (Email) |    |(LinkedIn|    | (Research) |
         +---------+    +---------+    +-----------+
```

The orchestrator is NOT an LLM -- it is deterministic TypeScript code. This is critical for:
- Predictable behavior and debugging
- Cost control (no unnecessary LLM calls)
- Consistent error handling
- Precise context assembly

### 5.2 Communication Protocol

Agents do not talk to each other directly. All communication flows through the orchestrator:

```typescript
// Agent Orchestrator - Central dispatcher
class AgentOrchestrator {
  private ceoAgent: CEOAgent;
  private emailWriter: EmailWriterAgent;
  private linkedinWriter: LinkedInWriterAgent;
  private responseHandler: ResponseHandlerAgent;
  private prospectResearcher: ProspectResearcherAgent;

  async generateOutreach(task: OutreachTask): Promise<OutreachResult> {
    // Step 1: Gather context
    const prospectContext = await this.buildProspectContext(task.prospectId);
    const campaignContext = await this.buildCampaignContext(task.campaignId);
    const performanceContext = await this.buildPerformanceContext(task.workspaceId, task.campaignId);

    // Step 2: Get strategy from CEO Agent (cached per segment, not per prospect)
    const segmentKey = this.computeSegmentKey(prospectContext);
    const strategy = await this.getCEOStrategy(segmentKey, campaignContext, performanceContext);

    // Step 3: Route to appropriate writer agent
    let result: GeneratedContent;
    switch (task.channel) {
      case "email":
        result = await this.emailWriter.generate({
          prospect: prospectContext,
          strategy,
          stepNumber: task.stepNumber,
          performanceHints: performanceContext.emailHints,
        });
        break;
      case "linkedin":
        result = await this.linkedinWriter.generate({
          prospect: prospectContext,
          strategy,
          messageType: task.linkedinMessageType,
          performanceHints: performanceContext.linkedinHints,
        });
        break;
    }

    // Step 4: Validate and store
    const validated = await this.validateOutput(result, task);
    await this.storeGeneration(validated, task);

    return validated;
  }
}
```

### 5.3 Shared Memory Architecture

Agents share context through a structured memory layer in Supabase, NOT through direct communication:

```
+------------------------------------------------------------------+
|                    SHARED MEMORY LAYER                             |
|                                                                    |
|  +-----------------------+  +---------------------------+         |
|  | WORKSPACE MEMORY      |  | PROSPECT MEMORY           |         |
|  | (per workspace)       |  | (per prospect)            |         |
|  |                       |  |                           |         |
|  | - Company context     |  | - Enrichment data         |         |
|  | - Product description |  | - Website analysis        |         |
|  | - ICP definition      |  | - LinkedIn profile data   |         |
|  | - Brand voice rules   |  | - Previous interactions   |         |
|  | - Segment strategies  |  | - Reply history           |         |
|  | - Performance baselines|  | - Sentiment scores       |         |
|  +-----------------------+  | - Personalization notes   |         |
|                              +---------------------------+         |
|                                                                    |
|  +-----------------------+  +---------------------------+         |
|  | CAMPAIGN MEMORY       |  | PERFORMANCE MEMORY         |         |
|  | (per campaign)        |  | (aggregated)               |         |
|  |                       |  |                            |         |
|  | - Campaign goals      |  | - Open rates by segment    |         |
|  | - Target segments     |  | - Reply rates by tone      |         |
|  | - Sequence config     |  | - Best subject patterns    |         |
|  | - A/B test results    |  | - Best CTA patterns        |         |
|  | - Channel strategy    |  | - Winning approaches       |         |
|  +-----------------------+  | - Objection frequency      |         |
|                              +---------------------------+         |
+------------------------------------------------------------------+
```

### 5.4 CEO Agent Strategy Caching

The CEO Agent is expensive (Sonnet 4.5). To avoid calling it per prospect, we cache strategies per segment:

```
Segment Key = hash(industry + company_size + role_seniority + country)

Example segments:
  "saas_11-50_c-level_france"     -> Strategy A
  "finance_201-1000_manager_uk"   -> Strategy B
  "consulting_1-10_founder_france" -> Strategy C

Strategy cache TTL: 7 days OR until performance data triggers a refresh
Refresh trigger: >20% drop in open rate OR reply rate for a segment
```

---

## 6. Personalization Engine

### 6.1 Personalization Data Sources

```
+-------------------------------------------------------------------+
|                   PERSONALIZATION INPUTS                            |
|                                                                     |
|  Layer 1: STATIC CONTEXT (set once per workspace)                  |
|  - Company description, product, value propositions                |
|  - Brand voice guidelines (formal/informal, specific vocabulary)   |
|  - ICP definition and persona cards                                |
|  - Industry-specific pain points library                           |
|                                                                     |
|  Layer 2: PROSPECT ENRICHMENT (gathered per prospect)              |
|  - LinkedIn profile (title, bio, experience, skills)               |
|  - Company website analysis (products, industry, size, content)    |
|  - Company news / recent events (funding, hiring, product launch)  |
|  - Technologies used (via website analysis)                        |
|  - Location / language / timezone                                  |
|                                                                     |
|  Layer 3: BEHAVIORAL SIGNALS (from interactions)                   |
|  - Opened previous emails? Which subjects worked?                  |
|  - Clicked any links? Which topics attracted?                      |
|  - Replied? What was the sentiment?                                |
|  - LinkedIn: accepted connection? Viewed profile back?             |
|  - Time-of-day engagement patterns                                 |
|                                                                     |
|  Layer 4: SEGMENT INTELLIGENCE (from aggregate data)               |
|  - What works for this industry? (tones, angles, CTAs)             |
|  - What works for this role level? (C-level vs manager vs IC)      |
|  - What works for this company size?                               |
|  - Seasonal patterns (Q4 budget season, summer slowdown)           |
+-------------------------------------------------------------------+
```

### 6.2 Personalization Score

Every generated message receives a personalization score (0-100):

```typescript
interface PersonalizationScore {
  total: number; // 0-100

  // Breakdown
  prospect_name_used: boolean;           // +5
  company_name_used: boolean;            // +5
  role_referenced: boolean;              // +10
  industry_specific_pain_point: boolean; // +15
  company_specific_reference: boolean;   // +20 (from website/news)
  recent_trigger_event: boolean;         // +15 (funding, hiring, etc.)
  mutual_connection_referenced: boolean; // +10
  language_matched: boolean;             // +10
  tone_matched_to_segment: boolean;      // +10
}

// Minimum threshold: 40 for batch sends, 60 for high-value prospects
```

### 6.3 Multi-Language Support

```typescript
interface LanguageConfig {
  prospect_language: "fr" | "en" | "es" | "de" | "it" | "pt";
  formality_level: "tu" | "vous" | "formal_you" | "informal";
  cultural_rules: {
    greeting_style: string;    // "Bonjour {firstName}" vs "Hi {firstName}"
    sign_off_style: string;    // "Cordialement" vs "Best"
    directness_level: number;  // 1-10 (French=4, American=8, German=7)
    humor_acceptable: boolean;
    reference_titles: boolean; // "M." / "Dr." in German culture
  };
}
```

### 6.4 Cross-Channel Coherence

The CEO Agent maintains a **narrative thread** per prospect that spans channels:

```
Prospect: Marie Dupont, CFO at TechCorp

NARRATIVE THREAD:
  Chapter 1 (Email #1): Introduce compliance challenge in growing SaaS companies
  Chapter 2 (LinkedIn connect): Light reference to compliance, focus on CFO community
  Chapter 3 (Email #2): Share case study about similar company saving 40% audit time
  Chapter 4 (LinkedIn msg): Ask about their current audit process
  Chapter 5 (Email #3): Direct proposal, reference their specific tech stack

Each agent receives the narrative thread and generates content that advances
the story without repeating what was said on other channels.
```

---

## 7. Learning Loop

### 7.1 Feedback Data Collection

```
+-------------------------------------------------------------------+
|                    FEEDBACK PIPELINE                                |
|                                                                     |
|  EMAIL SIGNALS:                                                    |
|  - Open tracking (pixel)         -> tracked in emails_sent table   |
|  - Click tracking (link rewrite) -> tracked in emails_sent table   |
|  - Reply detection (IMAP check)  -> tracked via cron/check-replies |
|  - Bounce detection (webhook)    -> tracked via Resend webhook     |
|  - Unsubscribe (link click)      -> tracked via tracking endpoint  |
|                                                                     |
|  LINKEDIN SIGNALS:                                                 |
|  - Connection accepted/rejected  -> tracked in automation_prospects |
|  - Message read (limited API)    -> tracked if available           |
|  - Reply received               -> tracked in automation_prospects  |
|  - Profile view back            -> tracked if detectable            |
|                                                                     |
|  CONVERSION SIGNALS:                                               |
|  - Meeting booked               -> manual/CRM integration          |
|  - Demo completed               -> manual/CRM integration          |
|  - Deal won/lost                -> manual/CRM integration          |
+-------------------------------------------------------------------+
```

### 7.2 Learning Pipeline Architecture

```
Raw Events (emails_sent, automation_actions_log)
    |
    v
[Aggregation Job - Cron every 6 hours]
    |
    +---> Aggregate by segment (industry x role x company_size)
    +---> Aggregate by content pattern (tone x angle x CTA_type)
    +---> Aggregate by timing (day_of_week x time_of_day)
    +---> Aggregate by template/variant (A/B test results)
    |
    v
[agent_performance_metrics table]
    |
    v
[Strategy Review Job - Cron weekly OR on performance trigger]
    |
    +---> CEO Agent analyzes aggregate data
    +---> Generates updated strategy briefs per segment
    +---> Updates agent_strategies table
    +---> Invalidates cached strategies
    |
    v
[Sub-agents use updated strategies for next generation cycle]
```

### 7.3 What Each Agent Learns

**CEO Agent learns**:
- Which segments respond best to which approaches
- Optimal sequence length per segment
- Channel priority (email-first vs LinkedIn-first) per segment
- When to stop (diminishing returns detection)
- Budget allocation across segments

**Email Writer learns**:
- Subject line patterns that get opens (short vs question vs number)
- Email body patterns that get replies (story vs data vs question)
- CTA patterns that convert (soft ask vs hard ask vs curiosity gap)
- Optimal email length per segment
- Best send times

**LinkedIn Writer learns**:
- Connection message patterns that get accepted
- Follow-up cadence that works
- Tone calibration (too formal? too casual?)
- Message length optimization

**Response Handler learns**:
- Common objection patterns and best responses
- Signals that indicate hot vs cold leads
- When to escalate to human vs continue automation

### 7.4 Performance-Driven Prompt Injection

The learning data is injected into agent prompts as structured context:

```typescript
function buildPerformanceContext(workspaceId: string, segmentKey: string): PerformanceContext {
  return {
    // Segment-level performance
    segment_stats: {
      emails_sent: 450,
      open_rate: 42.3,
      reply_rate: 8.1,
      conversion_rate: 2.4,
      avg_sequence_length_to_reply: 2.3,
    },

    // What works
    winning_patterns: {
      best_subject_patterns: [
        { pattern: "Question about {pain_point}", open_rate: 58.2 },
        { pattern: "{firstName}, {specific_reference}", open_rate: 51.4 },
      ],
      best_cta_patterns: [
        { pattern: "Simple question ending", reply_rate: 12.3 },
        { pattern: "Value-first, ask second", reply_rate: 9.8 },
      ],
      best_tone: "semi-formel",
      best_email_length_words: { min: 80, max: 120, optimal: 95 },
    },

    // What doesn't work
    losing_patterns: {
      avoid_subjects: ["Partenariat", "Opportunite"],
      avoid_approaches: ["Starting with product features", "Long introductions"],
      worst_send_times: ["Monday morning", "Friday afternoon"],
    },

    // Recent A/B results
    ab_results: [
      {
        test_name: "Direct vs Soft CTA",
        winner: "soft",
        confidence: 0.92,
        sample_size: 200,
      },
    ],
  };
}
```

---

## 8. Database Schema

### 8.1 New Tables for Multi-Agent System

```sql
-- ============================================================================
-- MIGRATION: 013_multi_agent_system.sql
-- Multi-agent orchestration tables for ColdReach
-- ============================================================================

-- ─── Agent Configurations ───────────────────────────────────────────────────

CREATE TABLE agent_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Agent identity
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'ceo', 'email_writer', 'linkedin_writer',
    'response_handler', 'prospect_researcher'
  )),
  name TEXT NOT NULL,
  description TEXT,

  -- Model configuration
  model TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20250415',
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1024,

  -- System prompt (versioned separately, this is the active pointer)
  active_prompt_version_id UUID,

  -- Agent-specific settings (JSON for flexibility)
  settings JSONB DEFAULT '{}',
  -- e.g., for email_writer: { "max_email_length": 150, "require_question_cta": true }
  -- e.g., for ceo: { "strategy_cache_ttl_hours": 168, "min_sample_size_for_learning": 20 }

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, agent_type)
);

CREATE INDEX idx_agent_configs_workspace ON agent_configs(workspace_id);

-- ─── Prompt Versioning ──────────────────────────────────────────────────────

CREATE TABLE agent_prompt_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_config_id UUID NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,

  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  prompt_metadata JSONB DEFAULT '{}',
  -- metadata: { "change_reason": "improved open rates", "performance_before": {...}, "performance_after": {...} }

  -- Performance tracking for this prompt version
  total_generations INTEGER DEFAULT 0,
  avg_personalization_score NUMERIC(5,2) DEFAULT 0,

  -- For email writer
  avg_open_rate NUMERIC(5,2),
  avg_reply_rate NUMERIC(5,2),
  avg_click_rate NUMERIC(5,2),

  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(agent_config_id, version)
);

CREATE INDEX idx_prompt_versions_agent ON agent_prompt_versions(agent_config_id);
CREATE INDEX idx_prompt_versions_active ON agent_prompt_versions(agent_config_id, is_active);

-- ─── Agent Strategies (CEO Agent output, consumed by sub-agents) ────────────

CREATE TABLE agent_strategies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Segment this strategy applies to
  segment_key TEXT NOT NULL,
  -- Format: "{industry}_{company_size}_{role_seniority}_{country}"
  -- Example: "saas_11-50_c-level_france"

  segment_filters JSONB NOT NULL DEFAULT '{}',
  -- { "industry": ["saas", "tech"], "company_size": ["11-50", "51-200"], "role_seniority": "c-level", "country": "FR" }

  -- Strategy content (generated by CEO Agent)
  strategy JSONB NOT NULL,
  -- {
  --   "primary_angle": "compliance automation for growing teams",
  --   "tone": "semi-formel",
  --   "key_pain_points": ["manual audits", "growing team compliance"],
  --   "value_propositions": ["40% time saved on audits", "real-time compliance dashboard"],
  --   "objection_frameworks": [{"objection": "we already have a process", "response_strategy": "..."}],
  --   "channel_priority": "email_first",
  --   "sequence_length": 4,
  --   "avoid": ["mentioning competitors", "discount offers in first touch"],
  --   "email_guidelines": { "subject_style": "question", "max_length": 120, "cta_style": "soft_question" },
  --   "linkedin_guidelines": { "connection_angle": "industry_peer", "followup_cadence_days": 3 }
  -- }

  -- Performance at time of generation
  based_on_sample_size INTEGER DEFAULT 0,
  performance_snapshot JSONB DEFAULT '{}',

  -- Validity
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,

  generated_by_agent_id UUID REFERENCES agent_configs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, segment_key)
);

CREATE INDEX idx_strategies_workspace ON agent_strategies(workspace_id);
CREATE INDEX idx_strategies_segment ON agent_strategies(workspace_id, segment_key);
CREATE INDEX idx_strategies_active ON agent_strategies(workspace_id, is_active, expires_at);

-- ─── Agent Memory (per-prospect context accumulated over time) ──────────────

CREATE TABLE agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  -- Memory type
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'enrichment',         -- Website/LinkedIn analysis results
    'interaction',        -- Record of a sent email/message
    'reply_analysis',     -- Analysis of a reply received
    'strategy_note',      -- CEO agent note about this prospect
    'personalization',    -- Specific personalization data points
    'narrative_thread'    -- Cross-channel story progression
  )),

  -- Content
  content JSONB NOT NULL,
  -- Varies by type. Examples:
  -- enrichment: { "source": "website", "company_description": "...", "pain_points": [...] }
  -- interaction: { "channel": "email", "step": 1, "subject": "...", "sent_at": "...", "opened": true }
  -- reply_analysis: { "sentiment": "positive", "intent": "interested", "objections": [...], "next_action": "send_case_study" }
  -- narrative_thread: { "chapters": [{ "channel": "email", "step": 1, "topic": "intro compliance" }] }

  -- For ordering and context window management
  sequence_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Some memories can expire (e.g., time-sensitive triggers)
);

CREATE INDEX idx_agent_memory_prospect ON agent_memory(workspace_id, prospect_id);
CREATE INDEX idx_agent_memory_type ON agent_memory(workspace_id, prospect_id, memory_type);
CREATE INDEX idx_agent_memory_order ON agent_memory(prospect_id, sequence_order);

-- ─── Agent Performance Metrics (aggregated) ─────────────────────────────────

CREATE TABLE agent_performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- What this metric measures
  agent_type TEXT NOT NULL,
  metric_period TEXT NOT NULL CHECK (metric_period IN ('daily', 'weekly', 'monthly', 'all_time')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Segment (optional - NULL means workspace-wide)
  segment_key TEXT,

  -- Core metrics
  total_generations INTEGER DEFAULT 0,
  total_tokens_input INTEGER DEFAULT 0,
  total_tokens_output INTEGER DEFAULT 0,
  total_cost_usd NUMERIC(10,4) DEFAULT 0,

  -- Quality metrics
  avg_personalization_score NUMERIC(5,2),

  -- Outcome metrics (for email/linkedin writers)
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0, -- meeting booked
  total_bounced INTEGER DEFAULT 0,

  -- Derived rates
  open_rate NUMERIC(5,2),
  click_rate NUMERIC(5,2),
  reply_rate NUMERIC(5,2),
  conversion_rate NUMERIC(5,2),
  bounce_rate NUMERIC(5,2),

  -- Pattern analysis (populated by learning pipeline)
  winning_patterns JSONB DEFAULT '{}',
  losing_patterns JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, agent_type, metric_period, period_start, segment_key)
);

CREATE INDEX idx_perf_metrics_workspace ON agent_performance_metrics(workspace_id);
CREATE INDEX idx_perf_metrics_type ON agent_performance_metrics(workspace_id, agent_type, metric_period);
CREATE INDEX idx_perf_metrics_segment ON agent_performance_metrics(workspace_id, segment_key, metric_period);

-- ─── Agent Generation Log (detailed per-generation tracking) ────────────────

CREATE TABLE agent_generation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- What was generated
  agent_type TEXT NOT NULL,
  agent_config_id UUID REFERENCES agent_configs(id),
  prompt_version_id UUID REFERENCES agent_prompt_versions(id),

  -- For whom
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Context used
  segment_key TEXT,
  strategy_id UUID REFERENCES agent_strategies(id),

  -- Model details
  model TEXT NOT NULL,
  temperature NUMERIC(3,2),

  -- Input/Output (stored for debugging and learning)
  input_messages JSONB NOT NULL, -- The full messages array sent to Claude
  output_content JSONB NOT NULL, -- The parsed structured output
  raw_output TEXT,               -- Raw text output from Claude

  -- Token tracking (for billing)
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  cache_hit BOOLEAN DEFAULT false, -- Prompt caching used?

  -- Quality
  personalization_score INTEGER,
  validation_passed BOOLEAN DEFAULT true,
  validation_errors JSONB DEFAULT '[]',

  -- Was the output used or edited by the user?
  was_used BOOLEAN DEFAULT false,
  was_edited BOOLEAN DEFAULT false,
  user_satisfaction TEXT CHECK (user_satisfaction IN ('good', 'bad', 'edited')),

  -- Outcome tracking (populated later when we know if the email was opened/replied)
  outcome_open BOOLEAN,
  outcome_click BOOLEAN,
  outcome_reply BOOLEAN,
  outcome_conversion BOOLEAN,

  -- Timing
  generation_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_log_workspace ON agent_generation_log(workspace_id);
CREATE INDEX idx_gen_log_agent ON agent_generation_log(workspace_id, agent_type);
CREATE INDEX idx_gen_log_prospect ON agent_generation_log(prospect_id);
CREATE INDEX idx_gen_log_campaign ON agent_generation_log(campaign_id);
CREATE INDEX idx_gen_log_outcome ON agent_generation_log(workspace_id, agent_type, outcome_reply) WHERE outcome_reply IS NOT NULL;
CREATE INDEX idx_gen_log_created ON agent_generation_log(created_at DESC);

-- ─── A/B Test Configurations ────────────────────────────────────────────────

CREATE TABLE agent_ab_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- What we're testing
  test_type TEXT NOT NULL CHECK (test_type IN (
    'subject_line', 'email_body', 'tone', 'cta_style',
    'send_time', 'linkedin_message', 'sequence_length'
  )),

  -- Variants
  variants JSONB NOT NULL,
  -- [
  --   { "id": "A", "description": "Question subject", "config": { "subject_style": "question" } },
  --   { "id": "B", "description": "Direct subject", "config": { "subject_style": "statement" } }
  -- ]

  -- Traffic split
  traffic_split JSONB DEFAULT '{"A": 50, "B": 50}',

  -- Winner criteria
  primary_metric TEXT DEFAULT 'reply_rate' CHECK (primary_metric IN ('open_rate', 'click_rate', 'reply_rate', 'conversion_rate')),
  min_sample_size INTEGER DEFAULT 50,
  confidence_threshold NUMERIC(3,2) DEFAULT 0.95,

  -- Results
  status TEXT DEFAULT 'running' CHECK (status IN ('draft', 'running', 'completed', 'cancelled')),
  winner_variant TEXT,
  results JSONB DEFAULT '{}',

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ab_tests_workspace ON agent_ab_tests(workspace_id);
CREATE INDEX idx_ab_tests_campaign ON agent_ab_tests(campaign_id);
CREATE INDEX idx_ab_tests_status ON agent_ab_tests(workspace_id, status);

-- ─── RLS Policies ───────────────────────────────────────────────────────────

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_generation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_access" ON agent_configs
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "workspace_access" ON agent_prompt_versions
  FOR ALL USING (agent_config_id IN (
    SELECT id FROM agent_configs WHERE workspace_id IN (SELECT get_user_workspace_ids())
  ));

CREATE POLICY "workspace_access" ON agent_strategies
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "workspace_access" ON agent_memory
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "workspace_access" ON agent_performance_metrics
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "workspace_access" ON agent_generation_log
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "workspace_access" ON agent_ab_tests
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- ─── Grants ─────────────────────────────────────────────────────────────────

GRANT ALL ON agent_configs TO anon, authenticated;
GRANT ALL ON agent_prompt_versions TO anon, authenticated;
GRANT ALL ON agent_strategies TO anon, authenticated;
GRANT ALL ON agent_memory TO anon, authenticated;
GRANT ALL ON agent_performance_metrics TO anon, authenticated;
GRANT ALL ON agent_generation_log TO anon, authenticated;
GRANT ALL ON agent_ab_tests TO anon, authenticated;

-- ─── Triggers ───────────────────────────────────────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_configs
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_strategies
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_performance_metrics
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_ab_tests
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### 8.2 Entity Relationship Summary

```
workspaces
    |
    +--- agent_configs (1 per agent_type per workspace)
    |        |
    |        +--- agent_prompt_versions (version history)
    |
    +--- agent_strategies (cached CEO strategies per segment)
    |
    +--- agent_memory (per-prospect accumulated context)
    |
    +--- agent_performance_metrics (aggregated analytics)
    |
    +--- agent_generation_log (every AI generation with outcome tracking)
    |
    +--- agent_ab_tests (experiment configurations)
    |
    +--- campaigns
    |        |
    |        +--- sequence_steps (reuse existing)
    |        +--- campaign_prospects -> emails_sent (reuse existing)
    |
    +--- prospects (reuse existing)
```

---

## 9. API Flow & Implementation

### 9.1 API Routes Structure

```
/api/agents/
    /config                    GET    - List agent configs for workspace
    /config/[agentType]        GET    - Get specific agent config
    /config/[agentType]        PUT    - Update agent config (prompt, model, settings)

    /orchestrate               POST   - Main orchestration endpoint
    /orchestrate/batch         POST   - Batch generation for campaign

    /generate/email            POST   - Direct email generation
    /generate/linkedin         POST   - Direct LinkedIn message generation
    /generate/research         POST   - Prospect research

    /strategy/review           POST   - Trigger CEO strategy review
    /strategy/[segmentKey]     GET    - Get current strategy for segment

    /performance               GET    - Get performance metrics
    /performance/refresh       POST   - Trigger performance aggregation

    /ab-test                   POST   - Create A/B test
    /ab-test/[id]              GET    - Get A/B test results
    /ab-test/[id]/complete     POST   - Complete test, apply winner

    /memory/[prospectId]       GET    - Get prospect memory
    /memory/[prospectId]       POST   - Add memory entry

    /generations               GET    - List generations with filters
    /generations/[id]/feedback POST   - Submit user feedback on generation
```

### 9.2 Core Orchestration Implementation

```typescript
// /src/lib/agents/orchestrator.ts

import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OutreachTask {
  workspaceId: string;
  prospectId: string;
  campaignId: string;
  channel: "email" | "linkedin";
  stepNumber: number;
  linkedinMessageType?: "connection" | "followup" | "inmail";
  abTestVariant?: string;
}

interface AgentContext {
  prospect: ProspectContext;
  campaign: CampaignContext;
  performance: PerformanceContext;
  strategy: StrategyContext;
  memory: MemoryContext;
}

interface GenerationResult {
  content: Record<string, unknown>;
  metadata: {
    agentType: string;
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

// ─── Model Pricing (per 1M tokens) ─────────────────────────────────────────

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20250415":  { input: 1.00, output: 5.00 },
  "claude-sonnet-4-5-20250415": { input: 3.00, output: 15.00 },
  "claude-opus-4-5-20250415":   { input: 5.00, output: 25.00 },
};

// ─── Agent Orchestrator ─────────────────────────────────────────────────────

export class AgentOrchestrator {
  private anthropic: Anthropic;
  private supabase: ReturnType<typeof createAdminClient>;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    this.supabase = createAdminClient();
  }

  // ── Main Entry Point ──────────────────────────────────────────────────────

  async generateOutreach(task: OutreachTask): Promise<GenerationResult> {
    const startTime = Date.now();

    // 1. Build complete context
    const context = await this.buildContext(task);

    // 2. Get or compute strategy from CEO Agent
    const strategy = await this.getOrComputeStrategy(task.workspaceId, context);
    context.strategy = strategy;

    // 3. Route to appropriate agent
    let result: GenerationResult;
    switch (task.channel) {
      case "email":
        result = await this.callEmailWriter(task, context);
        break;
      case "linkedin":
        result = await this.callLinkedInWriter(task, context);
        break;
      default:
        throw new Error(`Unknown channel: ${task.channel}`);
    }

    // 4. Validate output
    this.validateOutput(result, task, context);

    // 5. Log generation
    result.metadata.generationDurationMs = Date.now() - startTime;
    await this.logGeneration(task, context, result);

    // 6. Update prospect memory
    await this.updateMemory(task, result);

    return result;
  }

  // ── Context Building ──────────────────────────────────────────────────────

  private async buildContext(task: OutreachTask): Promise<AgentContext> {
    // Parallel fetch all context data
    const [prospect, campaign, performance, memory] = await Promise.all([
      this.fetchProspectContext(task.prospectId, task.workspaceId),
      this.fetchCampaignContext(task.campaignId),
      this.fetchPerformanceContext(task.workspaceId, task.campaignId),
      this.fetchMemoryContext(task.prospectId, task.workspaceId),
    ]);

    return {
      prospect,
      campaign,
      performance,
      strategy: {} as StrategyContext, // Filled later
      memory,
    };
  }

  private async fetchProspectContext(prospectId: string, workspaceId: string): Promise<ProspectContext> {
    // Fetch prospect + enrichment + website analysis
    const { data: prospect } = await this.supabase
      .from("prospects")
      .select("*")
      .eq("id", prospectId)
      .eq("workspace_id", workspaceId)
      .single();

    if (!prospect) throw new Error(`Prospect ${prospectId} not found`);

    // Fetch any website enrichment stored in agent_memory
    const { data: enrichments } = await this.supabase
      .from("agent_memory")
      .select("content")
      .eq("prospect_id", prospectId)
      .eq("memory_type", "enrichment")
      .order("created_at", { ascending: false })
      .limit(3);

    return {
      ...prospect,
      enrichments: enrichments?.map((e) => e.content) || [],
    };
  }

  // ── CEO Agent Strategy ────────────────────────────────────────────────────

  private async getOrComputeStrategy(
    workspaceId: string,
    context: AgentContext
  ): Promise<StrategyContext> {
    const segmentKey = this.computeSegmentKey(context.prospect);

    // Check cache
    const { data: cached } = await this.supabase
      .from("agent_strategies")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("segment_key", segmentKey)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached) {
      return { ...cached.strategy, strategyId: cached.id };
    }

    // Generate new strategy via CEO Agent
    return await this.callCEOAgent(workspaceId, segmentKey, context);
  }

  private computeSegmentKey(prospect: ProspectContext): string {
    const industry = (prospect.custom_fields?.industry || prospect.industry || "unknown")
      .toLowerCase().replace(/\s+/g, "_");
    const size = prospect.custom_fields?.company_size || "unknown";
    const seniority = this.inferSeniority(prospect.job_title || "");
    const country = this.inferCountry(prospect.location || "");
    return `${industry}_${size}_${seniority}_${country}`;
  }

  private async callCEOAgent(
    workspaceId: string,
    segmentKey: string,
    context: AgentContext
  ): Promise<StrategyContext> {
    const agentConfig = await this.getAgentConfig(workspaceId, "ceo");
    const promptVersion = await this.getActivePrompt(agentConfig.id);

    // Fetch workspace context
    const { data: workspace } = await this.supabase
      .from("workspaces")
      .select("name, ai_company_context, settings")
      .eq("id", workspaceId)
      .single();

    const systemPrompt = promptVersion.system_prompt;
    const userMessage = this.buildCEOUserMessage(segmentKey, context, workspace);

    const response = await this.anthropic.messages.create({
      model: agentConfig.model, // claude-sonnet-4-5-20250415
      max_tokens: agentConfig.max_tokens,
      temperature: Number(agentConfig.temperature),
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const strategy = JSON.parse(textBlock?.text || "{}");

    // Cache strategy
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day TTL

    const { data: saved } = await this.supabase
      .from("agent_strategies")
      .upsert({
        workspace_id: workspaceId,
        segment_key: segmentKey,
        segment_filters: this.parseSegmentKey(segmentKey),
        strategy,
        based_on_sample_size: context.performance?.totalSent || 0,
        performance_snapshot: context.performance || {},
        expires_at: expiresAt.toISOString(),
        is_active: true,
        generated_by_agent_id: agentConfig.id,
      }, { onConflict: "workspace_id,segment_key" })
      .select()
      .single();

    return { ...strategy, strategyId: saved?.id || null };
  }

  // ── Email Writer Agent ────────────────────────────────────────────────────

  private async callEmailWriter(
    task: OutreachTask,
    context: AgentContext
  ): Promise<GenerationResult> {
    const agentConfig = await this.getAgentConfig(task.workspaceId, "email_writer");
    const promptVersion = await this.getActivePrompt(agentConfig.id);

    const systemPrompt = promptVersion.system_prompt;
    const userMessage = this.buildEmailWriterMessage(task, context);

    const response = await this.anthropic.messages.create({
      model: agentConfig.model, // claude-haiku-4-5-20250415
      max_tokens: agentConfig.max_tokens,
      temperature: Number(agentConfig.temperature),
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = JSON.parse(textBlock?.text || "{}");

    const costUsd = this.calculateCost(
      agentConfig.model,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    return {
      content: parsed,
      metadata: {
        agentType: "email_writer",
        model: agentConfig.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd,
        personalizationScore: this.calculatePersonalizationScore(parsed, context.prospect),
        generationDurationMs: 0, // filled by caller
        strategyId: context.strategy.strategyId || null,
        promptVersionId: promptVersion.id,
        cacheHit: false,
      },
    };
  }

  // ── Cost Calculation ──────────────────────────────────────────────────────

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING["claude-haiku-4-5-20250415"];
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }
}
```

### 9.3 API Route: Main Orchestration Endpoint

```typescript
// /src/app/api/agents/orchestrate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AgentOrchestrator } from "@/lib/agents/orchestrator";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    // Get workspace
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", user.id)
      .single();

    if (!profile?.current_workspace_id) {
      return NextResponse.json({ error: "Aucun workspace selectionne" }, { status: 400 });
    }

    const body = await request.json();
    const { prospectId, campaignId, channel, stepNumber, linkedinMessageType } = body;

    if (!prospectId || !channel) {
      return NextResponse.json({ error: "prospectId et channel sont requis" }, { status: 400 });
    }

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.generateOutreach({
      workspaceId: profile.current_workspace_id,
      prospectId,
      campaignId,
      channel,
      stepNumber: stepNumber || 1,
      linkedinMessageType,
    });

    return NextResponse.json({
      generated: result.content,
      metadata: result.metadata,
    });
  } catch (err) {
    console.error("[agents/orchestrate] Error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la generation" },
      { status: 500 }
    );
  }
}
```

### 9.4 Batch Generation for Campaigns

```typescript
// /src/app/api/agents/orchestrate/batch/route.ts

export async function POST(request: NextRequest) {
  // ... auth checks ...

  const { campaignId, channel, stepNumber, prospectIds } = await request.json();

  // Process in batches of 5 to avoid rate limits
  const BATCH_SIZE = 5;
  const results: GenerationResult[] = [];
  const errors: Array<{ prospectId: string; error: string }> = [];

  for (let i = 0; i < prospectIds.length; i += BATCH_SIZE) {
    const batch = prospectIds.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map((prospectId: string) =>
        orchestrator.generateOutreach({
          workspaceId,
          prospectId,
          campaignId,
          channel,
          stepNumber,
        })
      )
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        errors.push({
          prospectId: batch[j],
          error: result.reason?.message || "Unknown error",
        });
      }
    }

    // Rate limiting pause between batches
    if (i + BATCH_SIZE < prospectIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return NextResponse.json({
    total: prospectIds.length,
    generated: results.length,
    errors: errors.length,
    results,
    errors_detail: errors,
  });
}
```

### 9.5 Cron Job: Performance Aggregation

```typescript
// /src/app/api/cron/agent-performance/route.ts

export async function POST(request: NextRequest) {
  // Auth: cron secret
  // ...

  const supabase = createAdminClient();

  // Get all active workspaces
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id")
    .eq("plan", "pro") // Only for paid workspaces
    .limit(100);

  for (const workspace of workspaces || []) {
    // Aggregate email performance by segment
    const { data: generations } = await supabase
      .from("agent_generation_log")
      .select("agent_type, segment_key, outcome_open, outcome_click, outcome_reply, outcome_conversion, cost_usd, input_tokens, output_tokens, personalization_score")
      .eq("workspace_id", workspace.id)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Group by agent_type + segment_key
    const grouped = groupBy(generations || [], (g) => `${g.agent_type}::${g.segment_key}`);

    for (const [key, items] of Object.entries(grouped)) {
      const [agentType, segmentKey] = key.split("::");
      const sent = items.length;
      const opened = items.filter((i) => i.outcome_open).length;
      const replied = items.filter((i) => i.outcome_reply).length;

      await supabase
        .from("agent_performance_metrics")
        .upsert({
          workspace_id: workspace.id,
          agent_type: agentType,
          metric_period: "weekly",
          period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          period_end: new Date().toISOString().split("T")[0],
          segment_key: segmentKey || null,
          total_generations: sent,
          total_sent: sent,
          total_opened: opened,
          total_replied: replied,
          open_rate: sent > 0 ? (opened / sent) * 100 : 0,
          reply_rate: sent > 0 ? (replied / sent) * 100 : 0,
          total_cost_usd: items.reduce((sum, i) => sum + Number(i.cost_usd || 0), 0),
        }, { onConflict: "workspace_id,agent_type,metric_period,period_start,segment_key" });
    }

    // Check for strategy refresh triggers
    await checkStrategyRefreshTriggers(supabase, workspace.id);
  }

  return NextResponse.json({ success: true });
}

async function checkStrategyRefreshTriggers(supabase: any, workspaceId: string) {
  // Compare this week vs last week performance
  // If open rate dropped >20% for a segment, invalidate cached strategy
  const { data: thisWeek } = await supabase
    .from("agent_performance_metrics")
    .select("segment_key, open_rate, reply_rate")
    .eq("workspace_id", workspaceId)
    .eq("metric_period", "weekly")
    .order("period_start", { ascending: false })
    .limit(50);

  // ... comparison logic, invalidate strategies where performance dropped significantly
}
```

---

## 10. Agent Prompt Structures

### 10.1 CEO Agent System Prompt

```
You are the Chief Executive Officer agent for an outbound sales automation platform.
Your role is to define outreach strategies for specific prospect segments based on performance data and market knowledge.

## YOUR KNOWLEDGE
{workspace_company_context}

## YOUR MISSION
Analyze the provided segment data and performance metrics, then output a comprehensive outreach strategy.

## SEGMENT BEING ANALYZED
- Industry: {segment_industry}
- Company size: {segment_company_size}
- Decision-maker seniority: {segment_seniority}
- Country: {segment_country}

## HISTORICAL PERFORMANCE FOR THIS SEGMENT
{performance_data_json}

## CURRENT CAMPAIGN GOALS
{campaign_goals}

## RULES
1. Base your strategy on DATA, not assumptions. If we have performance data, use it.
2. If we have fewer than 20 data points for this segment, be conservative and follow best practices.
3. Always recommend specific, actionable guidelines -- not vague advice.
4. Consider cross-channel coherence: email and LinkedIn should tell the same story differently.
5. Be specific about what to AVOID based on losing patterns.
6. Output valid JSON only.

## OUTPUT FORMAT
{
  "primary_angle": "The main value proposition angle for this segment",
  "tone": "formel|semi-formel|decontracte",
  "key_pain_points": ["pain_point_1", "pain_point_2", "pain_point_3"],
  "value_propositions": ["vp_1", "vp_2"],
  "objection_frameworks": [
    {
      "objection": "Common objection text",
      "response_strategy": "How to handle it"
    }
  ],
  "channel_priority": "email_first|linkedin_first|simultaneous",
  "recommended_sequence_length": 4,
  "avoid": ["thing_to_avoid_1", "thing_to_avoid_2"],
  "email_guidelines": {
    "subject_style": "question|statement|number|personalized",
    "max_length_words": 120,
    "cta_style": "soft_question|direct_ask|value_offer",
    "personalization_minimum": ["company_name", "pain_point"]
  },
  "linkedin_guidelines": {
    "connection_angle": "industry_peer|mutual_interest|value_share|direct",
    "followup_cadence_days": 3,
    "message_max_length": 300
  },
  "timing_recommendations": {
    "best_send_days": [1, 2, 3],
    "best_send_hours": "9-11",
    "avoid_periods": ["friday_afternoon"]
  },
  "confidence_level": 0.0 to 1.0,
  "reasoning": "Brief explanation of why this strategy was chosen"
}
```

### 10.2 Email Writer Agent System Prompt

```
You are an expert B2B cold email copywriter for the French market.
Your mission is to write highly personalized, concise emails that get replies.

## COMPANY CONTEXT
{company_context}

## STRATEGY FROM LEADERSHIP
{ceo_strategy_json}

## RULES
1. Write in {language} with {formality_level} formality
2. Maximum {max_words} words
3. Subject line: maximum 60 characters, style: {subject_style}
4. Start with "Bonjour {firstName}"
5. Reference at least ONE specific detail about the prospect or their company
6. End with a simple, answerable question as CTA
7. DO NOT mention competitor names
8. DO NOT use marketing jargon ("synergie", "solution innovante", "revolutionner")
9. The email must sound hand-written, not AI-generated
10. Follow the strategy guidelines strictly: angle={primary_angle}, avoid={avoid_list}

## PROSPECT DATA
- Name: {firstName} {lastName}
- Title: {jobTitle}
- Company: {company}
- Industry: {industry}
- Company size: {companySize}
- Enrichment data: {enrichment_json}

## PREVIOUS INTERACTIONS WITH THIS PROSPECT
{memory_interactions}

## WHAT WORKS FOR THIS SEGMENT (from our data)
- Best subject patterns: {winning_subjects}
- Best CTA patterns: {winning_ctas}
- Average open rate: {segment_open_rate}%
- Average reply rate: {segment_reply_rate}%

## WHAT DOES NOT WORK
{losing_patterns}

## THIS IS EMAIL #{step_number} IN THE SEQUENCE
{sequence_position_instructions}

## OUTPUT FORMAT (JSON only, no markdown)
{
  "subject": "Email subject line",
  "body": "Full email body text",
  "personalization_hooks": ["what was personalized and why"],
  "cta_type": "question|value_offer|direct",
  "estimated_read_time_seconds": 30
}
```

### 10.3 Response Handler Agent System Prompt

```
You are an expert in analyzing prospect replies in a B2B outreach context.
Your role is to classify the reply, extract insights, and recommend the next action.

## COMPANY CONTEXT
{company_context}

## THE OUTREACH SEQUENCE SO FAR
{sequence_history}

## THE REPLY TO ANALYZE
From: {prospect_name} ({prospect_email})
Date: {reply_date}
Content:
---
{reply_content}
---

## CLASSIFICATION RULES
1. Classify the reply intent precisely
2. Extract ALL useful information (timing, referrals, objections, interests)
3. Recommend a specific next action
4. If positive interest, draft a response immediately
5. If objection, use the objection framework from the strategy

## OUTPUT FORMAT (JSON only)
{
  "classification": {
    "sentiment": "positive|negative|neutral",
    "intent": "interested|not_interested|ask_later|referral|out_of_office|bounce|unsubscribe|question|objection",
    "urgency": "high|medium|low",
    "confidence": 0.0 to 1.0
  },
  "extracted_info": {
    "timing_hint": "Q3 2026 budget review" or null,
    "referral": { "name": "...", "title": "...", "email": "..." } or null,
    "objections": ["objection_1"],
    "interests": ["what they showed interest in"],
    "questions": ["questions they asked"]
  },
  "recommended_action": {
    "action": "reply|schedule_followup|escalate_to_human|mark_converted|stop_sequence|add_to_nurture",
    "timing": "immediately|in_24h|in_1_week|custom",
    "channel": "email|linkedin|phone",
    "priority": "high|medium|low"
  },
  "draft_response": "A draft response if action is 'reply'" or null,
  "prospect_status_update": "replied|interested|not_interested|converted|nurture",
  "notes_for_next_agent": "Insights for the next email/message in the sequence"
}
```

---

## 11. Cost Analysis

### 11.1 Token Estimates Per Operation

| Operation | Model | Avg Input Tokens | Avg Output Tokens | Cost per Call |
|-----------|-------|-----------------|-------------------|---------------|
| CEO Strategy (per segment) | Sonnet 4.5 | ~2,000 | ~800 | $0.018 |
| Email Generation | Haiku 4.5 | ~1,500 | ~400 | $0.0035 |
| LinkedIn Message | Haiku 4.5 | ~1,200 | ~200 | $0.0022 |
| Prospect Research | Haiku 4.5 | ~2,000 | ~600 | $0.0050 |
| Reply Analysis | Sonnet 4.5 | ~1,800 | ~500 | $0.0129 |
| Icebreaker | Haiku 4.5 | ~1,000 | ~150 | $0.00175 |

### 11.2 Cost Per Prospect Contacted (Full Sequence)

**Standard 4-email + 2-LinkedIn sequence**:

```
Per prospect:
  1x Prospect Research (Haiku)   = $0.005
  1x CEO Strategy (amortized*)   = $0.0004  (* shared across ~50 prospects per segment)
  4x Email Generation (Haiku)    = $0.014
  2x LinkedIn Message (Haiku)    = $0.0044
  1x Reply Analysis (Sonnet)**   = $0.013  (** only if they reply, ~8% reply rate)
  ─────────────────────────────────
  TOTAL per prospect             = ~$0.025 (without reply)
                                 = ~$0.037 (if reply received)
```

**At scale (1,000 prospects/month)**:

```
  1,000 prospects x $0.025 avg   = $25/month in AI costs
  + ~80 reply analyses           = $1.03/month
  + ~4 CEO strategy generations  = $0.072/month
  ────────────────────────────────
  TOTAL                          = ~$26/month in Claude API costs
```

**At scale (10,000 prospects/month)**:

```
  10,000 x $0.025                = $250/month
  + ~800 reply analyses          = $10.32/month
  + ~20 CEO strategy generations = $0.36/month
  ────────────────────────────────
  TOTAL                          = ~$261/month in Claude API costs
```

### 11.3 Cost Optimization Strategies

1. **Prompt caching**: Use Anthropic prompt caching for the system prompt + company context (shared across calls). Saves up to 90% on cached tokens. Estimated savings: 40-60% on input token costs.

2. **CEO strategy caching**: One strategy per segment, cached 7 days. At 20 segments x 4 refreshes/month = 80 CEO calls/month vs 10,000 if called per prospect.

3. **Batch API**: Use Anthropic's Batch API for non-urgent generations (campaign pre-generation), saving 50% on all tokens.

4. **Model routing**: Use Haiku for 90% of calls. Only use Sonnet for CEO strategy and reply analysis. Never use Opus unless explicitly requested for high-value targets.

5. **Context window management**: Trim prospect memory to last 5 interactions. Summarize old interactions instead of including raw content.

### 11.4 Pricing Model for Users

Based on ~$0.025 per prospect AI cost:

| Plan | Monthly Price | Prospects/month | AI Cost | Your Margin |
|------|--------------|-----------------|---------|-------------|
| Starter | 49 EUR | 500 | $12.50 | ~$34 (75%) |
| Growth | 149 EUR | 2,000 | $50 | ~$90 (67%) |
| Scale | 399 EUR | 10,000 | $250 | ~$120 (35%) |
| Enterprise | Custom | 50,000+ | $1,250+ | Negotiated |

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)

**Goal**: Replace current OpenAI calls with Claude-powered agent orchestrator

- [ ] Set up Anthropic SDK in project (`@anthropic-ai/sdk`)
- [ ] Create `agent_configs`, `agent_prompt_versions`, `agent_generation_log` tables
- [ ] Build `AgentOrchestrator` class with direct Claude API calls
- [ ] Implement Email Writer Agent (migrate from current GPT prompts)
- [ ] Implement LinkedIn Writer Agent (migrate from current GPT prompts)
- [ ] Create `/api/agents/orchestrate` endpoint
- [ ] Add token tracking and cost calculation
- [ ] Write default system prompts for each agent
- [ ] UI: Replace current "Generate" buttons to use new orchestrator
- [ ] Tests: Verify output quality matches or exceeds current GPT output

**Dependencies**: Anthropic API key, migration of existing prompts
**Risk**: Output quality regression during migration -- mitigate with A/B comparison

### Phase 2: CEO Agent & Strategy Layer (Weeks 4-5)

**Goal**: Add strategic intelligence layer

- [ ] Create `agent_strategies` table
- [ ] Implement CEO Agent with segment-based strategy generation
- [ ] Build segment key computation logic
- [ ] Implement strategy caching with TTL
- [ ] Wire strategy into Email Writer and LinkedIn Writer agents
- [ ] Create `/api/agents/strategy/review` endpoint
- [ ] UI: Strategy dashboard showing current strategies per segment
- [ ] Tests: Verify strategy improves personalization scores

**Dependencies**: Phase 1 complete, sufficient prospect data for segment analysis

### Phase 3: Shared Memory & Personalization (Weeks 6-7)

**Goal**: Agents share context and build prospect knowledge

- [ ] Create `agent_memory` table
- [ ] Implement memory write on each generation and interaction
- [ ] Implement narrative thread tracking (cross-channel coherence)
- [ ] Build prospect memory retrieval with context window management
- [ ] Implement personalization scoring algorithm
- [ ] Wire memory into all agent prompts
- [ ] UI: Prospect detail view showing AI memory/context
- [ ] Tests: Verify multi-channel narrative coherence

**Dependencies**: Phase 2 complete

### Phase 4: Response Handler & Learning Loop (Weeks 8-10)

**Goal**: Close the feedback loop

- [ ] Implement Response Handler Agent
- [ ] Create `agent_performance_metrics` table
- [ ] Build performance aggregation cron job (every 6 hours)
- [ ] Build outcome tracking: link email opens/clicks/replies back to generation_log
- [ ] Implement strategy refresh triggers (performance drop detection)
- [ ] Wire performance data into all agent prompts
- [ ] Create `/api/cron/agent-performance` endpoint
- [ ] UI: Performance dashboard with per-agent and per-segment analytics
- [ ] Tests: Verify learning loop correctly identifies winning patterns

**Dependencies**: Phase 3 complete, sufficient email tracking data (>100 emails sent)

### Phase 5: A/B Testing & Optimization (Weeks 11-12)

**Goal**: Systematic testing and optimization

- [ ] Create `agent_ab_tests` table
- [ ] Implement A/B test creation and traffic splitting
- [ ] Implement statistical significance calculation
- [ ] Auto-apply winners when confidence threshold reached
- [ ] Prompt versioning with performance tracking per version
- [ ] UI: A/B test management interface
- [ ] Tests: Verify correct traffic splitting and winner detection

**Dependencies**: Phase 4 complete, sufficient volume for statistical significance

### Phase 6: MCP Migration (Weeks 13-16) [OPTIONAL]

**Goal**: Migrate agents to standalone MCP servers for modularity

- [ ] Install `@modelcontextprotocol/sdk`
- [ ] Refactor each agent into an MCP server with tools/resources/prompts
- [ ] Implement Streamable HTTP transport for inter-agent communication
- [ ] Build MCP client in orchestrator
- [ ] Session management with `Mcp-Session-Id`
- [ ] Deploy agents as independent services (Docker containers)
- [ ] Load testing and performance benchmarking vs direct API calls
- [ ] Documentation for custom agent creation

**Dependencies**: All previous phases stable, clear need for independent scaling

---

## 13. Differentiation Strategy

### 13.1 What Makes ColdReach Different from "GPT Writing Emails"

| Feature | Generic AI Email Tools | ColdReach |
|---------|----------------------|-----------|
| Personalization depth | Name + company merge fields | Multi-layer: enrichment + website analysis + behavioral signals + segment intelligence |
| Strategic intelligence | None (user writes prompts) | CEO Agent defines strategy per segment based on data |
| Cross-channel coherence | Separate tools for email/LinkedIn | Unified narrative thread maintained across channels |
| Learning | None (same prompt every time) | Continuous feedback loop: performance data feeds back into prompts |
| Adaptation | Manual prompt tweaking | Automatic strategy adjustment when performance drops |
| A/B testing | Basic subject line testing | Full multi-variable testing (tone, angle, CTA, timing, length) with auto-apply |
| Context accumulation | Stateless (each email generated fresh) | Prospect memory: agents know every past interaction |
| Quality control | None | Personalization scoring with minimum thresholds |
| Cost efficiency | One model for everything | Model routing: Haiku for volume, Sonnet for strategy, cached strategies |

### 13.2 Key Differentiators to Market

1. **"Your AI sales team that learns"** -- Not a tool, a team of specialized AI agents
2. **"One voice, every channel"** -- Same narrative across email and LinkedIn
3. **"Gets smarter every week"** -- Performance data drives strategy changes
4. **"Deep personalization, not merge tags"** -- Every message is unique based on real prospect research
5. **"Strategic AI, not just a chatbot"** -- CEO Agent thinks about segment strategy, not just individual emails

### 13.3 Competitive Moat

The true moat is **accumulated learning data per workspace**. The longer a client uses ColdReach:
- More performance data -> better CEO strategies
- More prospect interactions -> richer memory context
- More A/B tests completed -> optimized messaging patterns
- More reply data -> better Response Handler classification

This makes switching costs high: leaving means losing all learned intelligence.

---

## Appendix A: Integration with Existing Codebase

The current codebase already has:
- `src/lib/ai/prompts.ts` -- System prompts (to be migrated to agent_prompt_versions table)
- `src/lib/ai/message-generator.ts` -- OpenAI-based generators (to be replaced by agent orchestrator)
- `src/app/api/ai/generate-email/route.ts` -- Email generation endpoint (to be replaced)
- `src/app/api/ai/generate-message/route.ts` -- LinkedIn message generation (to be replaced)
- `src/app/api/ai/analyze-profile/route.ts` -- Profile analysis (to be replaced)
- `ai_generations` table -- Already exists, will be superseded by `agent_generation_log`
- Automation pipeline -- Already exists in `src/app/api/cron/automation/route.ts`, will integrate with orchestrator

**Migration strategy**: Build the new agent system alongside the existing one. Add a feature flag `USE_AGENT_ORCHESTRATOR` in workspace settings. Gradually migrate workspaces once quality is validated.

## Appendix B: Environment Variables Required

```env
# Anthropic (replaces or supplements OpenAI)
ANTHROPIC_API_KEY=sk-ant-...

# Feature flags
AGENT_ORCHESTRATOR_ENABLED=true
AGENT_CEO_MODEL=claude-sonnet-4-5-20250415
AGENT_WRITER_MODEL=claude-haiku-4-5-20250415
AGENT_RESPONSE_HANDLER_MODEL=claude-sonnet-4-5-20250415
AGENT_RESEARCHER_MODEL=claude-haiku-4-5-20250415

# Performance cron
AGENT_PERFORMANCE_CRON_SECRET=...
AGENT_STRATEGY_REFRESH_CRON_SECRET=...
```

---

## Sources & References

- [MCP Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Next.js MCP Integration Guide](https://nextjs.org/docs/app/guides/mcp)
- [Vercel MCP Template](https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Anthropic: Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Anthropic Cookbook: Orchestrator-Workers Pattern](https://github.com/anthropics/anthropic-cookbook/blob/main/patterns/agents/orchestrator_workers.ipynb)
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [MCP Primitives: Tools, Resources, Prompts](https://workos.com/blog/mcp-features-guide)
- [MCP Streamable HTTP Transport](https://github.com/ferrants/mcp-streamable-http-typescript-server)
