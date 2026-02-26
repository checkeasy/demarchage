-- ============================================================================
-- Ensure prospect columns from migration 009 exist + add new import sources
-- ============================================================================

-- 1. Add columns that may be missing (migration 009 was marked applied but not executed)
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'France';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'to_contact';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS loss_reason TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS nb_properties INT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS organization TEXT;

-- 2. Expand status CHECK to include all needed values
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_status_check;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_status_check
  CHECK (status IN ('active','bounced','unsubscribed','replied','converted','lost','standby','to_contact'));

-- 3. Expand source CHECK to include crm_import and directory_import
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_source_check;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_source_check
  CHECK (source IN ('manual','csv_import','api','linkedin','google_maps','crm_import','directory_import'));

-- 4. Indexes for cross-source deduplication
CREATE INDEX IF NOT EXISTS idx_prospects_country ON public.prospects (workspace_id, country);
CREATE INDEX IF NOT EXISTS idx_prospects_pipeline ON public.prospects (workspace_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_prospects_organization ON public.prospects (workspace_id, organization);
CREATE INDEX IF NOT EXISTS idx_prospects_website ON public.prospects (workspace_id, website) WHERE website IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_org_lower ON public.prospects (workspace_id, lower(organization)) WHERE organization IS NOT NULL;
