-- ============================================================================
-- PROSPECT ENRICHMENT FIELDS + BUSINESS ALERTS
-- Google Places, Airbnb, published_at for web_watch_results
-- ============================================================================

-- Add published_at to web_watch_results
ALTER TABLE public.web_watch_results
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Add enrichment columns to prospects
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS google_review_count INT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS airbnb_url TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;

-- Indexes for enrichment
CREATE INDEX IF NOT EXISTS idx_prospects_google_place_id ON public.prospects (google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_google_rating ON public.prospects (google_rating) WHERE google_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_last_enriched ON public.prospects (last_enriched_at);

-- ============================================================================
-- BUSINESS ALERTS TABLE (BODACC / SIRENE / Web Watch)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    alert_type      TEXT NOT NULL, -- new_company, funding, hiring
    company_name    TEXT NOT NULL,
    siren           TEXT,
    city            TEXT,
    naf_code        TEXT,
    source          TEXT NOT NULL, -- bodacc, sirene, web_watch
    data            JSONB DEFAULT '{}',
    is_processed    BOOLEAN NOT NULL DEFAULT FALSE,
    prospect_id     UUID REFERENCES public.prospects (id) ON DELETE SET NULL,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_alerts_workspace ON public.business_alerts (workspace_id, is_processed, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_alerts_siren ON public.business_alerts (siren) WHERE siren IS NOT NULL;

-- RLS
ALTER TABLE public.business_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage alerts in their workspace"
    ON public.business_alerts FOR ALL
    USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));
