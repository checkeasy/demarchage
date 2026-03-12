-- Add contact_type column to prospects
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'prospect'
  CHECK (contact_type IN (
    'prospect',
    'lead_chaud',
    'client',
    'ancien_client',
    'partenaire',
    'concurrent',
    'influenceur',
    'a_recontacter',
    'mauvaise_cible'
  ));

-- Index for filtering by contact_type
CREATE INDEX IF NOT EXISTS idx_prospects_contact_type ON public.prospects (contact_type);
