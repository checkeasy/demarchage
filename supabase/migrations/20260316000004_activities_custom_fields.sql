-- Add custom_fields column to activities for Pipedrive sync metadata
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';

-- Index for fast pipedrive_id lookup
CREATE INDEX IF NOT EXISTS idx_activities_pipedrive_id
  ON public.activities USING btree (((custom_fields->>'pipedrive_id')::int))
  WHERE custom_fields->>'pipedrive_id' IS NOT NULL;
