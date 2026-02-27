-- =============================================================================
-- Migration: Colonnes de segmentation pour prospects
-- Ajoute industry, city, employee_count, tags, lead_score
-- Backfill depuis custom_fields et location
-- =============================================================================

-- 1. Ajouter les nouvelles colonnes
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS employee_count TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS lead_score INTEGER;

-- 2. CHECK constraint pour lead_score (0-100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prospects_lead_score_check'
  ) THEN
    ALTER TABLE public.prospects
      ADD CONSTRAINT prospects_lead_score_check
      CHECK (lead_score IS NULL OR (lead_score >= 0 AND lead_score <= 100));
  END IF;
END $$;

-- 3. Indexes pour filtrage performant
CREATE INDEX IF NOT EXISTS idx_prospects_industry ON public.prospects (workspace_id, industry);
CREATE INDEX IF NOT EXISTS idx_prospects_city ON public.prospects (workspace_id, city);
CREATE INDEX IF NOT EXISTS idx_prospects_employee_count ON public.prospects (workspace_id, employee_count);
CREATE INDEX IF NOT EXISTS idx_prospects_tags ON public.prospects USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_prospects_lead_score ON public.prospects (workspace_id, lead_score);

-- 4. Backfill industry depuis custom_fields
UPDATE public.prospects
SET industry = custom_fields->>'industry'
WHERE industry IS NULL
  AND custom_fields->>'industry' IS NOT NULL
  AND custom_fields->>'industry' != '';

-- 5. Backfill employee_count depuis custom_fields.company_size
UPDATE public.prospects
SET employee_count = custom_fields->>'company_size'
WHERE employee_count IS NULL
  AND custom_fields->>'company_size' IS NOT NULL
  AND custom_fields->>'company_size' != '';

-- 6. Backfill city depuis location (premier segment avant virgule)
UPDATE public.prospects
SET city = TRIM(SPLIT_PART(location, ',', 1))
WHERE city IS NULL
  AND location IS NOT NULL
  AND location != ''
  AND POSITION(',' IN location) > 0;

-- Pour les locations sans virgule, utiliser le texte entier comme ville
UPDATE public.prospects
SET city = TRIM(location)
WHERE city IS NULL
  AND location IS NOT NULL
  AND location != ''
  AND POSITION(',' IN location) = 0;
