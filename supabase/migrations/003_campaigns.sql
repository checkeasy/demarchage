-- ============================================================================
-- 003_campaigns.sql
-- Cold Outreach SaaS - Campaigns, Sequence Steps & A/B Variants
-- ============================================================================

-- ============================================================================
-- 1. CAMPAIGNS
-- ============================================================================

CREATE TABLE public.campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    email_account_id    UUID REFERENCES public.email_accounts (id),

    -- Scheduling
    timezone            TEXT NOT NULL DEFAULT 'Europe/Paris',
    sending_window_start TIME NOT NULL DEFAULT '08:00',
    sending_window_end   TIME NOT NULL DEFAULT '18:00',
    sending_days        INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    daily_limit         INT,

    -- Tracking options
    track_opens         BOOLEAN NOT NULL DEFAULT TRUE,
    track_clicks        BOOLEAN NOT NULL DEFAULT TRUE,
    stop_on_reply       BOOLEAN NOT NULL DEFAULT TRUE,

    -- Aggregate stats (denormalized for performance)
    total_prospects     INT NOT NULL DEFAULT 0,
    total_sent          INT NOT NULL DEFAULT 0,
    total_opened        INT NOT NULL DEFAULT 0,
    total_clicked       INT NOT NULL DEFAULT 0,
    total_replied       INT NOT NULL DEFAULT 0,
    total_bounced       INT NOT NULL DEFAULT 0,
    total_unsubscribed  INT NOT NULL DEFAULT 0,

    -- Metadata
    created_by          UUID REFERENCES auth.users (id),
    launched_at         TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. SEQUENCE_STEPS
-- ============================================================================

CREATE TABLE public.sequence_steps (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id             UUID NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
    step_order              INT NOT NULL,
    step_type               TEXT NOT NULL
                                CHECK (step_type IN ('email', 'linkedin_connect', 'linkedin_message', 'delay', 'condition')),

    -- Delay configuration
    delay_days              INT NOT NULL DEFAULT 0,
    delay_hours             INT NOT NULL DEFAULT 0,

    -- Email content
    subject                 TEXT,
    body_html               TEXT,
    body_text               TEXT,

    -- LinkedIn content
    linkedin_message        TEXT,

    -- A/B testing
    ab_enabled              BOOLEAN NOT NULL DEFAULT FALSE,
    ab_winner_metric        TEXT NOT NULL DEFAULT 'open_rate'
                                CHECK (ab_winner_metric IN ('open_rate', 'click_rate', 'reply_rate')),
    ab_winner_after_hours   INT NOT NULL DEFAULT 24,
    ab_winner_variant_id    UUID,

    -- Conditional branching
    condition_type          TEXT,
    condition_true_step_id  UUID,
    condition_false_step_id UUID,

    -- Status
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (campaign_id, step_order)
);

-- ============================================================================
-- 3. AB_VARIANTS
-- ============================================================================

CREATE TABLE public.ab_variants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id         UUID NOT NULL REFERENCES public.sequence_steps (id) ON DELETE CASCADE,
    variant_label   TEXT NOT NULL DEFAULT 'A',
    subject         TEXT,
    body_html       TEXT,
    body_text       TEXT,
    weight          INT NOT NULL DEFAULT 50,

    -- Stats (denormalized)
    total_sent      INT NOT NULL DEFAULT 0,
    total_opened    INT NOT NULL DEFAULT 0,
    total_clicked   INT NOT NULL DEFAULT 0,
    total_replied   INT NOT NULL DEFAULT 0,

    is_winner       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX idx_campaigns_workspace_id
    ON public.campaigns (workspace_id);

CREATE INDEX idx_campaigns_status
    ON public.campaigns (status);

CREATE INDEX idx_campaigns_email_account_id
    ON public.campaigns (email_account_id);

CREATE INDEX idx_sequence_steps_campaign_id
    ON public.sequence_steps (campaign_id);

CREATE INDEX idx_ab_variants_step_id
    ON public.ab_variants (step_id);

-- ============================================================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER set_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_sequence_steps_updated_at
    BEFORE UPDATE ON public.sequence_steps
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.campaigns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_variants    ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. RLS POLICIES - CAMPAIGNS
-- ============================================================================

CREATE POLICY "Users can view campaigns in their workspaces"
    ON public.campaigns
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create campaigns in their workspaces"
    ON public.campaigns
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update campaigns in their workspaces"
    ON public.campaigns
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete campaigns in their workspaces"
    ON public.campaigns
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 8. RLS POLICIES - SEQUENCE_STEPS
-- Access through campaign's workspace membership
-- ============================================================================

CREATE POLICY "Users can view sequence steps in their workspaces"
    ON public.sequence_steps
    FOR SELECT
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can create sequence steps in their workspaces"
    ON public.sequence_steps
    FOR INSERT
    WITH CHECK (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can update sequence steps in their workspaces"
    ON public.sequence_steps
    FOR UPDATE
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    )
    WITH CHECK (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can delete sequence steps in their workspaces"
    ON public.sequence_steps
    FOR DELETE
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

-- ============================================================================
-- 9. RLS POLICIES - AB_VARIANTS
-- Access through step -> campaign -> workspace membership
-- ============================================================================

CREATE POLICY "Users can view ab variants in their workspaces"
    ON public.ab_variants
    FOR SELECT
    USING (
        step_id IN (
            SELECT ss.id FROM public.sequence_steps ss
            JOIN public.campaigns c ON c.id = ss.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can create ab variants in their workspaces"
    ON public.ab_variants
    FOR INSERT
    WITH CHECK (
        step_id IN (
            SELECT ss.id FROM public.sequence_steps ss
            JOIN public.campaigns c ON c.id = ss.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can update ab variants in their workspaces"
    ON public.ab_variants
    FOR UPDATE
    USING (
        step_id IN (
            SELECT ss.id FROM public.sequence_steps ss
            JOIN public.campaigns c ON c.id = ss.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    )
    WITH CHECK (
        step_id IN (
            SELECT ss.id FROM public.sequence_steps ss
            JOIN public.campaigns c ON c.id = ss.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can delete ab variants in their workspaces"
    ON public.ab_variants
    FOR DELETE
    USING (
        step_id IN (
            SELECT ss.id FROM public.sequence_steps ss
            JOIN public.campaigns c ON c.id = ss.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

-- ============================================================================
-- 10. GRANTS
-- ============================================================================

GRANT SELECT ON public.campaigns TO anon, authenticated;
GRANT ALL    ON public.campaigns TO authenticated;

GRANT SELECT ON public.sequence_steps TO anon, authenticated;
GRANT ALL    ON public.sequence_steps TO authenticated;

GRANT SELECT ON public.ab_variants TO anon, authenticated;
GRANT ALL    ON public.ab_variants TO authenticated;
