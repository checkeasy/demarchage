-- ============================================================================
-- 20260226000004_prospect_activities.sql
-- Prospect Activities / Timeline - Tracks all interactions with prospects
-- Used by: check-replies API, ProspectTimeline, AI reply analysis
-- ============================================================================

-- ============================================================================
-- 1. PROSPECT_ACTIVITIES TABLE
-- ============================================================================

CREATE TABLE public.prospect_activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    prospect_id     UUID NOT NULL REFERENCES public.prospects (id) ON DELETE CASCADE,

    -- Activity classification
    activity_type   TEXT NOT NULL
                        CHECK (activity_type IN (
                            -- Email activities
                            'email_sent', 'email_opened', 'email_clicked',
                            'email_bounced', 'reply_received',
                            -- LinkedIn activities
                            'linkedin_connect_sent', 'linkedin_connect_accepted',
                            'linkedin_message_sent', 'linkedin_reply_received',
                            'linkedin_profile_viewed',
                            -- WhatsApp activities
                            'whatsapp_sent', 'whatsapp_delivered', 'whatsapp_read',
                            'whatsapp_reply_received',
                            -- AI activities
                            'ai_reply_analysis', 'ai_research',
                            -- Manual activities
                            'note_added', 'status_changed', 'call_logged',
                            'meeting_scheduled', 'meeting_completed'
                        )),

    channel         TEXT CHECK (channel IN ('email', 'linkedin', 'whatsapp', 'phone', 'manual', 'ai')),

    -- Context references
    campaign_id     UUID REFERENCES public.campaigns (id) ON DELETE SET NULL,
    sequence_id     UUID REFERENCES public.automation_sequences (id) ON DELETE SET NULL,

    -- Content
    subject         TEXT,
    body            TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',

    -- AI analysis flag
    ai_analyzed     BOOLEAN DEFAULT NULL,

    -- Actor (who performed the action)
    performed_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Primary lookup: all activities for a prospect
CREATE INDEX idx_prospect_activities_prospect_id
    ON public.prospect_activities (prospect_id, created_at DESC);

-- Workspace-level queries
CREATE INDEX idx_prospect_activities_workspace_id
    ON public.prospect_activities (workspace_id, created_at DESC);

-- Filter by type (for check-replies, AI analysis)
CREATE INDEX idx_prospect_activities_type
    ON public.prospect_activities (activity_type, ai_analyzed);

-- Campaign/sequence tracking
CREATE INDEX idx_prospect_activities_campaign
    ON public.prospect_activities (campaign_id) WHERE campaign_id IS NOT NULL;

CREATE INDEX idx_prospect_activities_sequence
    ON public.prospect_activities (sequence_id) WHERE sequence_id IS NOT NULL;

-- Metadata GIN index for JSONB queries
CREATE INDEX idx_prospect_activities_metadata
    ON public.prospect_activities USING GIN (metadata);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.prospect_activities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view activities in their workspaces"
    ON public.prospect_activities
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create activities in their workspaces"
    ON public.prospect_activities
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update activities in their workspaces"
    ON public.prospect_activities
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete activities in their workspaces"
    ON public.prospect_activities
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- Service role bypass for cron/automation (admin client)
CREATE POLICY "Service role full access to activities"
    ON public.prospect_activities
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

GRANT SELECT ON public.prospect_activities TO anon, authenticated;
GRANT ALL    ON public.prospect_activities TO authenticated;
