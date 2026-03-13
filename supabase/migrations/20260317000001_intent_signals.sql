-- ============================================================================
-- INTENT SIGNALS SYSTEM
-- Inspired by Gojiberry AI: track prospect buying signals to prioritize outreach
-- ============================================================================

-- Signal types: job_change, funding, hiring, competitor_engagement, content_engagement,
--   website_visit, technology_change, social_engagement, event_attendance, warm_intro

CREATE TABLE IF NOT EXISTS public.prospect_signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    prospect_id     UUID NOT NULL REFERENCES public.prospects (id) ON DELETE CASCADE,
    signal_type     TEXT NOT NULL,
    signal_source   TEXT NOT NULL DEFAULT 'manual',  -- manual, linkedin, web_scrape, enrichment, pipedrive
    title           TEXT NOT NULL,
    description     TEXT,
    signal_score    INT NOT NULL DEFAULT 10 CHECK (signal_score BETWEEN 1 AND 100),
    signal_data     JSONB NOT NULL DEFAULT '{}',
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,  -- NULL = never expires
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prospect_signals_workspace ON public.prospect_signals (workspace_id);
CREATE INDEX IF NOT EXISTS idx_prospect_signals_prospect ON public.prospect_signals (prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_signals_type ON public.prospect_signals (signal_type);
CREATE INDEX IF NOT EXISTS idx_prospect_signals_active ON public.prospect_signals (workspace_id, is_active, detected_at DESC);

-- RLS
ALTER TABLE public.prospect_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signals in their workspace"
    ON public.prospect_signals FOR SELECT
    USING (workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert signals in their workspace"
    ON public.prospect_signals FOR INSERT
    WITH CHECK (workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ));

CREATE POLICY "Users can update signals in their workspace"
    ON public.prospect_signals FOR UPDATE
    USING (workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete signals in their workspace"
    ON public.prospect_signals FOR DELETE
    USING (workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ));

-- View: prospects with active signal count and total signal score
CREATE OR REPLACE VIEW public.prospect_signal_scores AS
SELECT
    p.id AS prospect_id,
    p.workspace_id,
    COUNT(ps.id) FILTER (WHERE ps.is_active AND (ps.expires_at IS NULL OR ps.expires_at > NOW())) AS active_signal_count,
    COALESCE(SUM(ps.signal_score) FILTER (WHERE ps.is_active AND (ps.expires_at IS NULL OR ps.expires_at > NOW())), 0) AS total_signal_score,
    MAX(ps.detected_at) FILTER (WHERE ps.is_active) AS last_signal_at
FROM public.prospects p
LEFT JOIN public.prospect_signals ps ON ps.prospect_id = p.id
GROUP BY p.id, p.workspace_id;
