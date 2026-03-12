-- Add custom_fields JSONB to notes (for Pipedrive metadata / dedup)
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';

-- Index for fast dedup lookup by pipedrive_id
CREATE INDEX IF NOT EXISTS idx_notes_pipedrive_id
  ON public.notes USING btree (((custom_fields->>'pipedrive_id')::int))
  WHERE custom_fields->>'pipedrive_id' IS NOT NULL;
