-- ============================================================================
-- 002_prospects.sql
-- Cold Outreach SaaS - Prospects, Tags, Custom Fields & Import Batches
-- ============================================================================

-- ============================================================================
-- 0. HELPER FUNCTION - get_user_workspace_ids()
-- Returns all workspace IDs the current user belongs to (via workspace_members)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
$$;

-- ============================================================================
-- 1. PROSPECTS
-- ============================================================================

CREATE TABLE public.prospects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    first_name          TEXT,
    last_name           TEXT,
    company             TEXT,
    job_title           TEXT,
    phone               TEXT,
    linkedin_url        TEXT,
    website             TEXT,
    location            TEXT,
    custom_fields       JSONB NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'bounced', 'unsubscribed', 'replied', 'converted')),
    source              TEXT NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('manual', 'csv_import', 'api', 'linkedin')),
    last_contacted_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (workspace_id, email)
);

-- ============================================================================
-- 2. TAGS
-- ============================================================================

CREATE TABLE public.tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    color           TEXT NOT NULL DEFAULT '#6366f1',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (workspace_id, name)
);

-- ============================================================================
-- 3. PROSPECT_TAGS (junction table)
-- ============================================================================

CREATE TABLE public.prospect_tags (
    prospect_id     UUID NOT NULL REFERENCES public.prospects (id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
    PRIMARY KEY (prospect_id, tag_id)
);

-- ============================================================================
-- 4. CUSTOM_FIELD_DEFINITIONS
-- ============================================================================

CREATE TABLE public.custom_field_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    field_name      TEXT NOT NULL,
    field_type      TEXT NOT NULL DEFAULT 'text'
                        CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select')),
    options         JSONB NOT NULL DEFAULT '[]',
    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    display_order   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (workspace_id, field_name)
);

-- ============================================================================
-- 5. IMPORT_BATCHES
-- ============================================================================

CREATE TABLE public.import_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    user_id         UUID REFERENCES auth.users (id),
    file_name       TEXT,
    total_rows      INT NOT NULL DEFAULT 0,
    imported_rows   INT NOT NULL DEFAULT 0,
    skipped_rows    INT NOT NULL DEFAULT 0,
    duplicate_rows  INT NOT NULL DEFAULT 0,
    error_rows      INT NOT NULL DEFAULT 0,
    column_mapping  JSONB,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    errors          JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

CREATE INDEX idx_prospects_workspace_id
    ON public.prospects (workspace_id);

CREATE INDEX idx_prospects_workspace_email
    ON public.prospects (workspace_id, email);

CREATE INDEX idx_prospects_workspace_status
    ON public.prospects (workspace_id, status);

CREATE INDEX idx_prospects_custom_fields
    ON public.prospects USING GIN (custom_fields);

CREATE INDEX idx_tags_workspace_id
    ON public.tags (workspace_id);

CREATE INDEX idx_prospect_tags_tag_id
    ON public.prospect_tags (tag_id);

CREATE INDEX idx_custom_field_definitions_workspace_id
    ON public.custom_field_definitions (workspace_id);

CREATE INDEX idx_import_batches_workspace_id
    ON public.import_batches (workspace_id);

-- ============================================================================
-- 7. UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER set_prospects_updated_at
    BEFORE UPDATE ON public.prospects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 8. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.prospects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches          ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. RLS POLICIES - PROSPECTS
-- ============================================================================

CREATE POLICY "Users can view prospects in their workspaces"
    ON public.prospects
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create prospects in their workspaces"
    ON public.prospects
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update prospects in their workspaces"
    ON public.prospects
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete prospects in their workspaces"
    ON public.prospects
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 10. RLS POLICIES - TAGS
-- ============================================================================

CREATE POLICY "Users can view tags in their workspaces"
    ON public.tags
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create tags in their workspaces"
    ON public.tags
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update tags in their workspaces"
    ON public.tags
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete tags in their workspaces"
    ON public.tags
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 11. RLS POLICIES - PROSPECT_TAGS
-- Allowed if the prospect belongs to a workspace the user is a member of
-- ============================================================================

CREATE POLICY "Users can view prospect tags in their workspaces"
    ON public.prospect_tags
    FOR SELECT
    USING (
        prospect_id IN (
            SELECT id FROM public.prospects
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can create prospect tags in their workspaces"
    ON public.prospect_tags
    FOR INSERT
    WITH CHECK (
        prospect_id IN (
            SELECT id FROM public.prospects
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can delete prospect tags in their workspaces"
    ON public.prospect_tags
    FOR DELETE
    USING (
        prospect_id IN (
            SELECT id FROM public.prospects
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

-- ============================================================================
-- 12. RLS POLICIES - CUSTOM_FIELD_DEFINITIONS
-- ============================================================================

CREATE POLICY "Users can view custom fields in their workspaces"
    ON public.custom_field_definitions
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create custom fields in their workspaces"
    ON public.custom_field_definitions
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update custom fields in their workspaces"
    ON public.custom_field_definitions
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete custom fields in their workspaces"
    ON public.custom_field_definitions
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 13. RLS POLICIES - IMPORT_BATCHES
-- ============================================================================

CREATE POLICY "Users can view import batches in their workspaces"
    ON public.import_batches
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create import batches in their workspaces"
    ON public.import_batches
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update import batches in their workspaces"
    ON public.import_batches
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete import batches in their workspaces"
    ON public.import_batches
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 14. GRANTS
-- ============================================================================

GRANT SELECT ON public.prospects TO anon, authenticated;
GRANT ALL    ON public.prospects TO authenticated;

GRANT SELECT ON public.tags TO anon, authenticated;
GRANT ALL    ON public.tags TO authenticated;

GRANT SELECT ON public.prospect_tags TO anon, authenticated;
GRANT ALL    ON public.prospect_tags TO authenticated;

GRANT SELECT ON public.custom_field_definitions TO anon, authenticated;
GRANT ALL    ON public.custom_field_definitions TO authenticated;

GRANT SELECT ON public.import_batches TO anon, authenticated;
GRANT ALL    ON public.import_batches TO authenticated;
