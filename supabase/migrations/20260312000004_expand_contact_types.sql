-- Expand contact_type to include hospitality sub-categories
-- Drop old constraint and recreate with new values
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_contact_type_check;

ALTER TABLE public.prospects
  ADD CONSTRAINT prospects_contact_type_check
  CHECK (contact_type IN (
    'prospect',
    'lead_chaud',
    'client',
    'ancien_client',
    'partenaire',
    'concurrent',
    'influenceur',
    'a_recontacter',
    'mauvaise_cible',
    'hotel',
    'camping',
    'gite',
    'residence',
    'auberge',
    'conciergerie_luxe',
    'conciergerie_entreprise'
  ));
