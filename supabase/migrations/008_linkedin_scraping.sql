-- ============================================================================
-- 008_linkedin_scraping.sql
-- Cold Outreach SaaS - LinkedIn Scraping Rate Limits & Action Logs
-- ============================================================================

-- ============================================================================
-- 1. LINKEDIN_RATE_LIMITS
-- Stocke les compteurs quotidiens par compte LinkedIn et type d'action
-- ============================================================================

CREATE TABLE public.linkedin_rate_limits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      TEXT NOT NULL,
    action_type     TEXT NOT NULL
                        CHECK (action_type IN ('search', 'view', 'connect', 'message', 'withdraw')),
    date            DATE NOT NULL,
    count           INT NOT NULL DEFAULT 0,
    daily_limit     INT NOT NULL DEFAULT 25,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (account_id, action_type, date)
);

-- ============================================================================
-- 2. LINKEDIN_ACTION_LOGS
-- Journal d'audit de toutes les actions LinkedIn effectuées
-- ============================================================================

CREATE TABLE public.linkedin_action_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    account_id          TEXT NOT NULL,
    action_type         TEXT NOT NULL
                            CHECK (action_type IN ('search', 'view', 'connect', 'message', 'withdraw')),
    target_profile_id   TEXT,
    target_public_id    TEXT,
    payload             JSONB,
    status              TEXT NOT NULL DEFAULT 'success'
                            CHECK (status IN ('success', 'failed', 'rate_limited')),
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- linkedin_rate_limits
CREATE INDEX idx_linkedin_rate_limits_account_date
    ON public.linkedin_rate_limits (account_id, date);

CREATE INDEX idx_linkedin_rate_limits_lookup
    ON public.linkedin_rate_limits (account_id, action_type, date);

-- linkedin_action_logs
CREATE INDEX idx_linkedin_action_logs_workspace_id
    ON public.linkedin_action_logs (workspace_id);

CREATE INDEX idx_linkedin_action_logs_account_id
    ON public.linkedin_action_logs (account_id);

CREATE INDEX idx_linkedin_action_logs_created_at
    ON public.linkedin_action_logs (created_at DESC);

CREATE INDEX idx_linkedin_action_logs_action_type
    ON public.linkedin_action_logs (action_type);

CREATE INDEX idx_linkedin_action_logs_status
    ON public.linkedin_action_logs (status);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.linkedin_rate_limits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_action_logs  ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS POLICIES - LINKEDIN_RATE_LIMITS
-- Accès uniquement via service_role (admin) pour les rate limits
-- ============================================================================

CREATE POLICY "Service role full access on linkedin_rate_limits"
    ON public.linkedin_rate_limits
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 6. RLS POLICIES - LINKEDIN_ACTION_LOGS
-- ============================================================================

CREATE POLICY "Users can view linkedin action logs in their workspaces"
    ON public.linkedin_action_logs
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Service role can insert linkedin action logs"
    ON public.linkedin_action_logs
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT ALL ON public.linkedin_rate_limits TO service_role;
GRANT SELECT ON public.linkedin_action_logs TO authenticated;
GRANT ALL ON public.linkedin_action_logs TO service_role;

-- ============================================================================
-- 8. CLEANUP: auto-delete rate limit records older than 30 days
-- (run via pg_cron or manually)
-- ============================================================================

-- To be used with pg_cron:
-- SELECT cron.schedule('cleanup_linkedin_rate_limits', '0 3 * * *',
--   $$DELETE FROM public.linkedin_rate_limits WHERE date < CURRENT_DATE - INTERVAL '30 days'$$
-- );
