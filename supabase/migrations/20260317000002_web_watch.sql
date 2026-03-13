-- ============================================================================
-- WEB WATCH / VEILLE SYSTEM
-- Daily web monitoring on user-defined topics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.web_watches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    topic           TEXT NOT NULL,
    keywords        TEXT[] NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    frequency       TEXT NOT NULL DEFAULT 'daily',  -- daily, weekly
    last_run_at     TIMESTAMPTZ,
    created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.web_watch_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    watch_id        UUID NOT NULL REFERENCES public.web_watches (id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    url             TEXT,
    snippet         TEXT,
    source          TEXT,  -- google_news, duckduckgo, etc.
    relevance_score INT NOT NULL DEFAULT 50,
    prospect_id     UUID REFERENCES public.prospects (id) ON DELETE SET NULL,
    signal_created  BOOLEAN NOT NULL DEFAULT FALSE,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_web_watches_workspace ON public.web_watches (workspace_id);
CREATE INDEX IF NOT EXISTS idx_web_watch_results_workspace ON public.web_watch_results (workspace_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_watch_results_watch ON public.web_watch_results (watch_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_watch_results_unread ON public.web_watch_results (workspace_id, is_read) WHERE is_read = FALSE;

-- RLS
ALTER TABLE public.web_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_watch_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage watches in their workspace"
    ON public.web_watches FOR ALL
    USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "Users can manage watch results in their workspace"
    ON public.web_watch_results FOR ALL
    USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));
