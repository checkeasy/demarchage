-- ============================================================================
-- 013_multi_agent_system.sql
-- Multi-Agent AI System - Agent Configs, Prompts, Strategies, Memory,
-- Performance Metrics, Generation Logs & A/B Tests
-- ============================================================================

-- ============================================================================
-- 1. AGENT_CONFIGS
-- ============================================================================

CREATE TABLE public.agent_configs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    agent_type              TEXT NOT NULL
                                CHECK (agent_type IN ('ceo', 'email_writer', 'linkedin_writer', 'response_handler', 'prospect_researcher')),
    name                    TEXT NOT NULL,
    description             TEXT,
    model                   TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    temperature             NUMERIC(3,2) DEFAULT 0.7,
    max_tokens              INTEGER DEFAULT 1024,
    active_prompt_version_id UUID,
    settings                JSONB DEFAULT '{}',
    is_active               BOOLEAN DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (workspace_id, agent_type)
);

-- ============================================================================
-- 2. AGENT_PROMPT_VERSIONS
-- ============================================================================

CREATE TABLE public.agent_prompt_versions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_config_id             UUID NOT NULL REFERENCES public.agent_configs (id) ON DELETE CASCADE,
    version                     INTEGER NOT NULL,
    system_prompt               TEXT NOT NULL,
    prompt_metadata             JSONB DEFAULT '{}',
    total_generations           INTEGER DEFAULT 0,
    avg_personalization_score   NUMERIC(5,2) DEFAULT 0,
    avg_open_rate               NUMERIC(5,2),
    avg_reply_rate              NUMERIC(5,2),
    avg_click_rate              NUMERIC(5,2),
    created_by                  UUID REFERENCES auth.users (id),
    is_active                   BOOLEAN DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (agent_config_id, version)
);

-- Now add the FK from agent_configs to agent_prompt_versions
ALTER TABLE public.agent_configs
    ADD CONSTRAINT fk_agent_configs_active_prompt_version
    FOREIGN KEY (active_prompt_version_id)
    REFERENCES public.agent_prompt_versions (id)
    ON DELETE SET NULL;

-- ============================================================================
-- 3. AGENT_STRATEGIES
-- ============================================================================

CREATE TABLE public.agent_strategies (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    segment_key             TEXT NOT NULL,
    segment_filters         JSONB NOT NULL DEFAULT '{}',
    strategy                JSONB NOT NULL,
    based_on_sample_size    INTEGER DEFAULT 0,
    performance_snapshot    JSONB DEFAULT '{}',
    expires_at              TIMESTAMPTZ NOT NULL,
    is_active               BOOLEAN DEFAULT true,
    generated_by_agent_id   UUID REFERENCES public.agent_configs (id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (workspace_id, segment_key)
);

-- ============================================================================
-- 4. AGENT_MEMORY
-- ============================================================================

CREATE TABLE public.agent_memory (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    prospect_id         UUID NOT NULL REFERENCES public.prospects (id) ON DELETE CASCADE,
    memory_type         TEXT NOT NULL
                            CHECK (memory_type IN ('enrichment', 'interaction', 'reply_analysis', 'strategy_note', 'personalization', 'narrative_thread')),
    content             JSONB NOT NULL,
    sequence_order      INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ
);

-- ============================================================================
-- 5. AGENT_PERFORMANCE_METRICS
-- ============================================================================

CREATE TABLE public.agent_performance_metrics (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id                UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    agent_type                  TEXT NOT NULL,
    metric_period               TEXT NOT NULL
                                    CHECK (metric_period IN ('daily', 'weekly', 'monthly', 'all_time')),
    period_start                DATE NOT NULL,
    period_end                  DATE NOT NULL,
    segment_key                 TEXT,
    total_generations           INTEGER DEFAULT 0,
    total_tokens_input          INTEGER DEFAULT 0,
    total_tokens_output         INTEGER DEFAULT 0,
    total_cost_usd              NUMERIC(10,4) DEFAULT 0,
    avg_personalization_score   NUMERIC(5,2),
    total_sent                  INTEGER DEFAULT 0,
    total_opened                INTEGER DEFAULT 0,
    total_clicked               INTEGER DEFAULT 0,
    total_replied               INTEGER DEFAULT 0,
    total_converted             INTEGER DEFAULT 0,
    total_bounced               INTEGER DEFAULT 0,
    open_rate                   NUMERIC(5,2),
    click_rate                  NUMERIC(5,2),
    reply_rate                  NUMERIC(5,2),
    conversion_rate             NUMERIC(5,2),
    bounce_rate                 NUMERIC(5,2),
    winning_patterns            JSONB DEFAULT '{}',
    losing_patterns             JSONB DEFAULT '{}',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE NULLS NOT DISTINCT (workspace_id, agent_type, metric_period, period_start, segment_key)
);

-- ============================================================================
-- 6. AGENT_GENERATION_LOG
-- ============================================================================

CREATE TABLE public.agent_generation_log (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    agent_type              TEXT NOT NULL,
    agent_config_id         UUID REFERENCES public.agent_configs (id),
    prompt_version_id       UUID REFERENCES public.agent_prompt_versions (id),
    prospect_id             UUID REFERENCES public.prospects (id) ON DELETE SET NULL,
    campaign_id             UUID REFERENCES public.campaigns (id) ON DELETE SET NULL,
    segment_key             TEXT,
    strategy_id             UUID REFERENCES public.agent_strategies (id),
    model                   TEXT NOT NULL,
    temperature             NUMERIC(3,2),
    input_messages          JSONB NOT NULL,
    output_content          JSONB NOT NULL,
    raw_output              TEXT,
    input_tokens            INTEGER NOT NULL DEFAULT 0,
    output_tokens           INTEGER NOT NULL DEFAULT 0,
    total_tokens            INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    cost_usd                NUMERIC(10,6) DEFAULT 0,
    cache_hit               BOOLEAN DEFAULT false,
    personalization_score   INTEGER,
    validation_passed       BOOLEAN DEFAULT true,
    validation_errors       JSONB DEFAULT '[]',
    was_used                BOOLEAN DEFAULT false,
    was_edited              BOOLEAN DEFAULT false,
    user_satisfaction       TEXT
                                CHECK (user_satisfaction IN ('good', 'bad', 'edited')),
    outcome_open            BOOLEAN,
    outcome_click           BOOLEAN,
    outcome_reply           BOOLEAN,
    outcome_conversion      BOOLEAN,
    generation_duration_ms  INTEGER,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. AGENT_AB_TESTS
-- ============================================================================

CREATE TABLE public.agent_ab_tests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    campaign_id             UUID REFERENCES public.campaigns (id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    description             TEXT,
    test_type               TEXT NOT NULL
                                CHECK (test_type IN ('subject_line', 'email_body', 'tone', 'cta_style', 'send_time', 'linkedin_message', 'sequence_length')),
    variants                JSONB NOT NULL,
    traffic_split           JSONB DEFAULT '{"A": 50, "B": 50}',
    primary_metric          TEXT DEFAULT 'reply_rate'
                                CHECK (primary_metric IN ('open_rate', 'click_rate', 'reply_rate', 'conversion_rate')),
    min_sample_size         INTEGER DEFAULT 50,
    confidence_threshold    NUMERIC(3,2) DEFAULT 0.95,
    status                  TEXT DEFAULT 'running'
                                CHECK (status IN ('draft', 'running', 'completed', 'cancelled')),
    winner_variant          TEXT,
    results                 JSONB DEFAULT '{}',
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. INDEXES
-- ============================================================================

-- agent_configs
CREATE INDEX idx_agent_configs_workspace_id
    ON public.agent_configs (workspace_id);

-- agent_prompt_versions
CREATE INDEX idx_agent_prompt_versions_agent_config_id
    ON public.agent_prompt_versions (agent_config_id);

-- agent_strategies
CREATE INDEX idx_agent_strategies_workspace_id
    ON public.agent_strategies (workspace_id);

CREATE INDEX idx_agent_strategies_segment_key
    ON public.agent_strategies (segment_key);

CREATE INDEX idx_agent_strategies_active_expires
    ON public.agent_strategies (is_active, expires_at);

-- agent_memory
CREATE INDEX idx_agent_memory_workspace_prospect
    ON public.agent_memory (workspace_id, prospect_id);

CREATE INDEX idx_agent_memory_workspace_prospect_type
    ON public.agent_memory (workspace_id, prospect_id, memory_type);

CREATE INDEX idx_agent_memory_prospect_sequence
    ON public.agent_memory (prospect_id, sequence_order);

-- agent_performance_metrics
CREATE INDEX idx_agent_perf_metrics_workspace_id
    ON public.agent_performance_metrics (workspace_id);

CREATE INDEX idx_agent_perf_metrics_agent_type
    ON public.agent_performance_metrics (agent_type);

CREATE INDEX idx_agent_perf_metrics_period
    ON public.agent_performance_metrics (metric_period, period_start);

-- agent_generation_log
CREATE INDEX idx_agent_gen_log_workspace_id
    ON public.agent_generation_log (workspace_id);

CREATE INDEX idx_agent_gen_log_agent_type
    ON public.agent_generation_log (agent_type);

CREATE INDEX idx_agent_gen_log_prospect_id
    ON public.agent_generation_log (prospect_id);

CREATE INDEX idx_agent_gen_log_campaign_id
    ON public.agent_generation_log (campaign_id);

CREATE INDEX idx_agent_gen_log_outcome_reply
    ON public.agent_generation_log (outcome_reply);

-- agent_ab_tests
CREATE INDEX idx_agent_ab_tests_workspace_id
    ON public.agent_ab_tests (workspace_id);

CREATE INDEX idx_agent_ab_tests_campaign_id
    ON public.agent_ab_tests (campaign_id);

CREATE INDEX idx_agent_ab_tests_status
    ON public.agent_ab_tests (status);

-- ============================================================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER set_agent_configs_updated_at
    BEFORE UPDATE ON public.agent_configs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_agent_strategies_updated_at
    BEFORE UPDATE ON public.agent_strategies
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_agent_performance_metrics_updated_at
    BEFORE UPDATE ON public.agent_performance_metrics
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_agent_ab_tests_updated_at
    BEFORE UPDATE ON public.agent_ab_tests
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 10. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.agent_configs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompt_versions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_strategies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance_metrics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_generation_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_ab_tests              ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. RLS POLICIES - AGENT_CONFIGS
-- ============================================================================

CREATE POLICY "Users can view agent configs in their workspaces"
    ON public.agent_configs
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create agent configs in their workspaces"
    ON public.agent_configs
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update agent configs in their workspaces"
    ON public.agent_configs
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete agent configs in their workspaces"
    ON public.agent_configs
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 12. RLS POLICIES - AGENT_PROMPT_VERSIONS
-- Access through agent_config -> workspace membership
-- ============================================================================

CREATE POLICY "Users can view agent prompt versions in their workspaces"
    ON public.agent_prompt_versions
    FOR SELECT
    USING (
        agent_config_id IN (
            SELECT id FROM public.agent_configs
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can create agent prompt versions in their workspaces"
    ON public.agent_prompt_versions
    FOR INSERT
    WITH CHECK (
        agent_config_id IN (
            SELECT id FROM public.agent_configs
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can update agent prompt versions in their workspaces"
    ON public.agent_prompt_versions
    FOR UPDATE
    USING (
        agent_config_id IN (
            SELECT id FROM public.agent_configs
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    )
    WITH CHECK (
        agent_config_id IN (
            SELECT id FROM public.agent_configs
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can delete agent prompt versions in their workspaces"
    ON public.agent_prompt_versions
    FOR DELETE
    USING (
        agent_config_id IN (
            SELECT id FROM public.agent_configs
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

-- ============================================================================
-- 13. RLS POLICIES - AGENT_STRATEGIES
-- ============================================================================

CREATE POLICY "Users can view agent strategies in their workspaces"
    ON public.agent_strategies
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create agent strategies in their workspaces"
    ON public.agent_strategies
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update agent strategies in their workspaces"
    ON public.agent_strategies
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete agent strategies in their workspaces"
    ON public.agent_strategies
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 14. RLS POLICIES - AGENT_MEMORY
-- ============================================================================

CREATE POLICY "Users can view agent memory in their workspaces"
    ON public.agent_memory
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create agent memory in their workspaces"
    ON public.agent_memory
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update agent memory in their workspaces"
    ON public.agent_memory
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete agent memory in their workspaces"
    ON public.agent_memory
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 15. RLS POLICIES - AGENT_PERFORMANCE_METRICS
-- ============================================================================

CREATE POLICY "Users can view agent performance metrics in their workspaces"
    ON public.agent_performance_metrics
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create agent performance metrics in their workspaces"
    ON public.agent_performance_metrics
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update agent performance metrics in their workspaces"
    ON public.agent_performance_metrics
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete agent performance metrics in their workspaces"
    ON public.agent_performance_metrics
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 16. RLS POLICIES - AGENT_GENERATION_LOG
-- ============================================================================

CREATE POLICY "Users can view agent generation logs in their workspaces"
    ON public.agent_generation_log
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create agent generation logs in their workspaces"
    ON public.agent_generation_log
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update agent generation logs in their workspaces"
    ON public.agent_generation_log
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete agent generation logs in their workspaces"
    ON public.agent_generation_log
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 17. RLS POLICIES - AGENT_AB_TESTS
-- ============================================================================

CREATE POLICY "Users can view agent ab tests in their workspaces"
    ON public.agent_ab_tests
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create agent ab tests in their workspaces"
    ON public.agent_ab_tests
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update agent ab tests in their workspaces"
    ON public.agent_ab_tests
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete agent ab tests in their workspaces"
    ON public.agent_ab_tests
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 18. GRANTS
-- ============================================================================

GRANT SELECT ON public.agent_configs TO anon, authenticated;
GRANT ALL    ON public.agent_configs TO authenticated;

GRANT SELECT ON public.agent_prompt_versions TO anon, authenticated;
GRANT ALL    ON public.agent_prompt_versions TO authenticated;

GRANT SELECT ON public.agent_strategies TO anon, authenticated;
GRANT ALL    ON public.agent_strategies TO authenticated;

GRANT SELECT ON public.agent_memory TO anon, authenticated;
GRANT ALL    ON public.agent_memory TO authenticated;

GRANT SELECT ON public.agent_performance_metrics TO anon, authenticated;
GRANT ALL    ON public.agent_performance_metrics TO authenticated;

GRANT SELECT ON public.agent_generation_log TO anon, authenticated;
GRANT ALL    ON public.agent_generation_log TO authenticated;

GRANT SELECT ON public.agent_ab_tests TO anon, authenticated;
GRANT ALL    ON public.agent_ab_tests TO authenticated;
