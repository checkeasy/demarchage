-- ============================================================================
-- 20260312000001_outreach_missions.sql
-- Outreach Missions - AI-driven prospection campaigns
-- ============================================================================

-- ============================================================================
-- 1. OUTREACH_MISSIONS TABLE
-- ============================================================================

CREATE TABLE public.outreach_missions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id             UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    name                     TEXT NOT NULL,
    description              TEXT,
    original_prompt          TEXT NOT NULL,
    search_keywords          TEXT[] DEFAULT '{}',
    target_profile           JSONB DEFAULT '{}',
    language                 TEXT NOT NULL DEFAULT 'fr',
    campaign_email_id        UUID REFERENCES public.campaigns (id) ON DELETE SET NULL,
    campaign_linkedin_id     UUID REFERENCES public.campaigns (id) ON DELETE SET NULL,
    campaign_multichannel_id UUID REFERENCES public.campaigns (id) ON DELETE SET NULL,
    status                   TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('draft','active','paused','completed','archived')),
    total_prospects          INT NOT NULL DEFAULT 0,
    total_enrolled           INT NOT NULL DEFAULT 0,
    created_by               UUID REFERENCES auth.users (id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. ADD mission_id TO PROSPECTS
-- ============================================================================

ALTER TABLE public.prospects
    ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES public.outreach_missions (id) ON DELETE SET NULL;

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX idx_missions_workspace ON public.outreach_missions (workspace_id);
CREATE INDEX idx_missions_status ON public.outreach_missions (status);
CREATE INDEX idx_prospects_mission ON public.prospects (mission_id) WHERE mission_id IS NOT NULL;

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER set_outreach_missions_updated_at
    BEFORE UPDATE ON public.outreach_missions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. RLS
-- ============================================================================

ALTER TABLE public.outreach_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view missions in their workspaces"
    ON public.outreach_missions
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create missions in their workspaces"
    ON public.outreach_missions
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update missions in their workspaces"
    ON public.outreach_missions
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete missions in their workspaces"
    ON public.outreach_missions
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );
