-- ============================================================================
-- 006_linkedin.sql
-- Cold Outreach SaaS - LinkedIn Tasks & Connections
-- ============================================================================

-- ============================================================================
-- 1. LINKEDIN_TASKS
-- ============================================================================

CREATE TABLE public.linkedin_tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    campaign_prospect_id    UUID NOT NULL REFERENCES public.campaign_prospects (id) ON DELETE CASCADE,
    prospect_id             UUID NOT NULL REFERENCES public.prospects (id) ON DELETE CASCADE,
    step_id                 UUID REFERENCES public.sequence_steps (id),
    task_type               TEXT NOT NULL
                                CHECK (task_type IN ('connect', 'message', 'view_profile', 'endorse')),
    message                 TEXT,
    status                  TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'completed', 'skipped', 'failed')),
    priority                INT NOT NULL DEFAULT 0,
    due_at                  TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    completed_by            UUID REFERENCES auth.users (id),
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. LINKEDIN_CONNECTIONS
-- ============================================================================

CREATE TABLE public.linkedin_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    prospect_id         UUID NOT NULL REFERENCES public.prospects (id) ON DELETE CASCADE,
    linkedin_url        TEXT,
    connection_status   TEXT NOT NULL DEFAULT 'not_connected'
                            CHECK (connection_status IN ('not_connected', 'pending', 'connected', 'rejected')),
    connected_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (workspace_id, prospect_id)
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- linkedin_tasks
CREATE INDEX idx_linkedin_tasks_workspace_id
    ON public.linkedin_tasks (workspace_id);

CREATE INDEX idx_linkedin_tasks_campaign_prospect_id
    ON public.linkedin_tasks (campaign_prospect_id);

CREATE INDEX idx_linkedin_tasks_prospect_id
    ON public.linkedin_tasks (prospect_id);

CREATE INDEX idx_linkedin_tasks_status
    ON public.linkedin_tasks (status);

CREATE INDEX idx_linkedin_tasks_due_at
    ON public.linkedin_tasks (due_at)
    WHERE status = 'pending';

CREATE INDEX idx_linkedin_tasks_task_type
    ON public.linkedin_tasks (task_type);

-- linkedin_connections
CREATE INDEX idx_linkedin_connections_workspace_id
    ON public.linkedin_connections (workspace_id);

CREATE INDEX idx_linkedin_connections_prospect_id
    ON public.linkedin_connections (prospect_id);

CREATE INDEX idx_linkedin_connections_status
    ON public.linkedin_connections (connection_status);

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER set_linkedin_connections_updated_at
    BEFORE UPDATE ON public.linkedin_connections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.linkedin_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES - LINKEDIN_TASKS
-- ============================================================================

CREATE POLICY "Users can view linkedin tasks in their workspaces"
    ON public.linkedin_tasks
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create linkedin tasks in their workspaces"
    ON public.linkedin_tasks
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update linkedin tasks in their workspaces"
    ON public.linkedin_tasks
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete linkedin tasks in their workspaces"
    ON public.linkedin_tasks
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 7. RLS POLICIES - LINKEDIN_CONNECTIONS
-- ============================================================================

CREATE POLICY "Users can view linkedin connections in their workspaces"
    ON public.linkedin_connections
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create linkedin connections in their workspaces"
    ON public.linkedin_connections
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update linkedin connections in their workspaces"
    ON public.linkedin_connections
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete linkedin connections in their workspaces"
    ON public.linkedin_connections
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT SELECT ON public.linkedin_tasks TO anon, authenticated;
GRANT ALL    ON public.linkedin_tasks TO authenticated;

GRANT SELECT ON public.linkedin_connections TO anon, authenticated;
GRANT ALL    ON public.linkedin_connections TO authenticated;
