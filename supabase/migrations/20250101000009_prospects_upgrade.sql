-- ============================================================================
-- 008_prospects_upgrade.sql
-- Add country, pipeline_stage, loss_reason, notes, nb_properties, organization
-- Expand status and source constraints
-- ============================================================================

-- 1. Add new columns
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'France';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'to_contact';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS loss_reason TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS nb_properties INT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS organization TEXT;

-- 2. Drop old CHECK constraints and add new ones
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_status_check;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_status_check
  CHECK (status IN ('active','bounced','unsubscribed','replied','converted','lost','standby','to_contact'));

ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_source_check;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_source_check
  CHECK (source IN ('manual','csv_import','api','linkedin','google_maps','crm_import'));

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_prospects_country ON public.prospects (workspace_id, country);
CREATE INDEX IF NOT EXISTS idx_prospects_pipeline ON public.prospects (workspace_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_prospects_organization ON public.prospects (workspace_id, organization);
