-- ============================================================================
-- 20260227000001_crm_core.sql
-- CRM Core Tables - Pipeline stages, Deals, Activities, Notes
-- Used by: CRM pipeline board, deal management, activity tracking
-- ============================================================================

-- ============================================================================
-- 1. PIPELINE_STAGES_CONFIG TABLE
-- ============================================================================

CREATE TABLE public.pipeline_stages_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    color           TEXT NOT NULL DEFAULT '#6366f1',
    display_order   INT NOT NULL DEFAULT 0,
    is_won          BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, slug)
);

-- ============================================================================
-- 1b. PIPELINE_STAGES_CONFIG INDEXES
-- ============================================================================

CREATE INDEX idx_pipeline_stages_config_workspace_order
    ON public.pipeline_stages_config (workspace_id, display_order);

-- ============================================================================
-- 1c. PIPELINE_STAGES_CONFIG RLS
-- ============================================================================

ALTER TABLE public.pipeline_stages_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pipeline stages in their workspaces"
    ON public.pipeline_stages_config
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create pipeline stages in their workspaces"
    ON public.pipeline_stages_config
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update pipeline stages in their workspaces"
    ON public.pipeline_stages_config
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete pipeline stages in their workspaces"
    ON public.pipeline_stages_config
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- Service role bypass for cron/automation (admin client)
CREATE POLICY "Service role full access to pipeline stages"
    ON public.pipeline_stages_config
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 1d. PIPELINE_STAGES_CONFIG GRANTS
-- ============================================================================

GRANT SELECT ON public.pipeline_stages_config TO anon, authenticated;
GRANT ALL    ON public.pipeline_stages_config TO authenticated;

-- ============================================================================
-- 2. DEALS TABLE
-- ============================================================================

CREATE TABLE public.deals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    value           NUMERIC(12, 2),
    currency        TEXT NOT NULL DEFAULT 'EUR',
    stage_id        UUID NOT NULL REFERENCES public.pipeline_stages_config (id),
    prospect_id     UUID REFERENCES public.prospects (id) ON DELETE SET NULL,
    owner_id        UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    expected_close_date DATE,
    probability     INT DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    won_at          TIMESTAMPTZ,
    lost_at         TIMESTAMPTZ,
    loss_reason     TEXT,
    notes           TEXT,
    custom_fields   JSONB NOT NULL DEFAULT '{}',
    last_activity_at TIMESTAMPTZ,
    stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2b. DEALS INDEXES
-- ============================================================================

-- Workspace-level queries
CREATE INDEX idx_deals_workspace_id
    ON public.deals (workspace_id);

-- Stage lookup (pipeline board)
CREATE INDEX idx_deals_stage_id
    ON public.deals (stage_id);

-- Prospect link
CREATE INDEX idx_deals_prospect_id
    ON public.deals (prospect_id) WHERE prospect_id IS NOT NULL;

-- Owner lookup
CREATE INDEX idx_deals_owner_id
    ON public.deals (owner_id) WHERE owner_id IS NOT NULL;

-- Status filter
CREATE INDEX idx_deals_workspace_status
    ON public.deals (workspace_id, status);

-- Forecast: open deals by expected close date
CREATE INDEX idx_deals_workspace_close_date
    ON public.deals (workspace_id, expected_close_date) WHERE status = 'open';

-- ============================================================================
-- 2c. DEALS TRIGGER
-- ============================================================================

CREATE TRIGGER set_deals_updated_at
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 2d. DEALS RLS
-- ============================================================================

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deals in their workspaces"
    ON public.deals
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create deals in their workspaces"
    ON public.deals
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update deals in their workspaces"
    ON public.deals
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete deals in their workspaces"
    ON public.deals
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- Service role bypass for cron/automation (admin client)
CREATE POLICY "Service role full access to deals"
    ON public.deals
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 2e. DEALS GRANTS
-- ============================================================================

GRANT SELECT ON public.deals TO anon, authenticated;
GRANT ALL    ON public.deals TO authenticated;

-- ============================================================================
-- 3. ACTIVITIES TABLE
-- ============================================================================

CREATE TABLE public.activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    activity_type   TEXT NOT NULL CHECK (activity_type IN ('call', 'meeting', 'email', 'task', 'follow_up', 'demo')),
    title           TEXT NOT NULL,
    description     TEXT,
    deal_id         UUID REFERENCES public.deals (id) ON DELETE CASCADE,
    prospect_id     UUID REFERENCES public.prospects (id) ON DELETE CASCADE,
    assigned_to     UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    due_date        TIMESTAMPTZ,
    duration_minutes INT,
    is_done         BOOLEAN NOT NULL DEFAULT FALSE,
    done_at         TIMESTAMPTZ,
    priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    outcome         TEXT,
    created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3b. ACTIVITIES INDEXES
-- ============================================================================

-- Workspace-level queries
CREATE INDEX idx_activities_workspace_id
    ON public.activities (workspace_id);

-- Deal link
CREATE INDEX idx_activities_deal_id
    ON public.activities (deal_id) WHERE deal_id IS NOT NULL;

-- Prospect link
CREATE INDEX idx_activities_prospect_id
    ON public.activities (prospect_id) WHERE prospect_id IS NOT NULL;

-- My open tasks (assigned_to + pending)
CREATE INDEX idx_activities_assigned_pending
    ON public.activities (assigned_to, is_done, due_date) WHERE is_done = FALSE;

-- Workspace upcoming activities
CREATE INDEX idx_activities_workspace_due
    ON public.activities (workspace_id, due_date) WHERE is_done = FALSE;

-- Activity type filter
CREATE INDEX idx_activities_workspace_type
    ON public.activities (workspace_id, activity_type);

-- ============================================================================
-- 3c. ACTIVITIES TRIGGER
-- ============================================================================

CREATE TRIGGER set_activities_updated_at
    BEFORE UPDATE ON public.activities
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 3d. ACTIVITIES RLS
-- ============================================================================

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities in their workspaces"
    ON public.activities
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create activities in their workspaces"
    ON public.activities
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update activities in their workspaces"
    ON public.activities
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete activities in their workspaces"
    ON public.activities
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- Service role bypass for cron/automation (admin client)
CREATE POLICY "Service role full access to activities"
    ON public.activities
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3e. ACTIVITIES GRANTS
-- ============================================================================

GRANT SELECT ON public.activities TO anon, authenticated;
GRANT ALL    ON public.activities TO authenticated;

-- ============================================================================
-- 4. NOTES TABLE
-- ============================================================================

CREATE TABLE public.notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    deal_id         UUID REFERENCES public.deals (id) ON DELETE CASCADE,
    prospect_id     UUID REFERENCES public.prospects (id) ON DELETE CASCADE,
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4b. NOTES INDEXES
-- ============================================================================

-- Deal notes lookup
CREATE INDEX idx_notes_deal_id
    ON public.notes (deal_id) WHERE deal_id IS NOT NULL;

-- Prospect notes lookup
CREATE INDEX idx_notes_prospect_id
    ON public.notes (prospect_id) WHERE prospect_id IS NOT NULL;

-- ============================================================================
-- 4c. NOTES TRIGGER
-- ============================================================================

CREATE TRIGGER set_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4d. NOTES RLS
-- ============================================================================

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes in their workspaces"
    ON public.notes
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create notes in their workspaces"
    ON public.notes
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update notes in their workspaces"
    ON public.notes
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete notes in their workspaces"
    ON public.notes
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- Service role bypass for cron/automation (admin client)
CREATE POLICY "Service role full access to notes"
    ON public.notes
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4e. NOTES GRANTS
-- ============================================================================

GRANT SELECT ON public.notes TO anon, authenticated;
GRANT ALL    ON public.notes TO authenticated;

-- ============================================================================
-- 5. SEED DEFAULT PIPELINE STAGES FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_default_pipeline_stages(ws_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.pipeline_stages_config (workspace_id, name, slug, color, display_order, is_won, is_lost) VALUES
        (ws_id, 'A contacter',       'to_contact',     '#06b6d4', 1, FALSE, FALSE),
        (ws_id, 'Contacte',          'contacted',      '#60a5fa', 2, FALSE, FALSE),
        (ws_id, 'En negociation',    'negotiation',    '#818cf8', 3, FALSE, FALSE),
        (ws_id, 'Demo planifiee',    'demo_scheduled', '#a78bfa', 4, FALSE, FALSE),
        (ws_id, 'Demo faite',        'demo_done',      '#c084fc', 5, FALSE, FALSE),
        (ws_id, 'Essai',             'trial',          '#f59e0b', 6, FALSE, FALSE),
        (ws_id, 'Gagne',             'won',            '#22c55e', 7, TRUE,  FALSE),
        (ws_id, 'Perdu',             'lost',           '#ef4444', 8, FALSE, TRUE);
END;
$$;
