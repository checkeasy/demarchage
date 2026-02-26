-- ============================================================================
-- Migration 009: Google Maps Scraping Support
-- Adds 'google_maps' as a prospect source and creates a search cache table
-- ============================================================================

-- 1. Update the source constraint on prospects to include 'google_maps'
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_source_check;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_source_check
    CHECK (source IN ('manual', 'csv_import', 'api', 'linkedin', 'google_maps'));

-- 2. Create cache table for Maps search results
CREATE TABLE IF NOT EXISTS public.maps_search_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    search_query    TEXT NOT NULL,
    search_location TEXT,
    results_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
    results_count   INT NOT NULL DEFAULT 0,
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    UNIQUE (workspace_id, search_query, search_location)
);

CREATE INDEX IF NOT EXISTS idx_maps_search_cache_workspace
    ON public.maps_search_cache (workspace_id);
CREATE INDEX IF NOT EXISTS idx_maps_search_cache_query
    ON public.maps_search_cache (search_query, search_location);
CREATE INDEX IF NOT EXISTS idx_maps_search_cache_expires
    ON public.maps_search_cache (expires_at);

-- 3. RLS policies
ALTER TABLE public.maps_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view maps cache in their workspaces"
    ON public.maps_search_cache FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Users can insert maps cache in their workspaces"
    ON public.maps_search_cache FOR INSERT
    WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Users can delete maps cache in their workspaces"
    ON public.maps_search_cache FOR DELETE
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- 4. Grant permissions
GRANT SELECT, INSERT, DELETE ON public.maps_search_cache TO authenticated;
