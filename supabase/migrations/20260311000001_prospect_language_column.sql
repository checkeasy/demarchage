-- Add language column to prospects for multi-language outreach
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Index for language-based filtering
CREATE INDEX IF NOT EXISTS idx_prospects_language
  ON public.prospects (workspace_id, language);

-- Backfill language from country field
UPDATE public.prospects
SET language = CASE
  WHEN country IN (
    'France', 'Belgium', 'Belgique', 'Switzerland', 'Suisse',
    'Luxembourg', 'Monaco', 'Senegal', 'Morocco', 'Maroc',
    'Tunisia', 'Tunisie', 'Cameroon', 'Cameroun', 'Congo',
    'Madagascar', 'Mali', 'Niger', 'Burkina Faso', 'Togo',
    'Benin', 'Gabon', 'Haiti', 'Reunion', 'Guadeloupe',
    'Martinique', 'Guyane', 'Mayotte', 'Cote d''Ivoire'
  ) THEN 'fr'
  WHEN country IN (
    'Spain', 'Espagne', 'Mexico', 'Mexique', 'Colombia', 'Colombie',
    'Argentina', 'Argentine', 'Chile', 'Chili', 'Peru', 'Perou',
    'Venezuela', 'Ecuador', 'Equateur', 'Bolivia', 'Bolivie',
    'Paraguay', 'Uruguay', 'Costa Rica', 'Panama', 'Cuba',
    'Dominican Republic', 'Republique Dominicaine',
    'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua'
  ) THEN 'es'
  ELSE 'en'
END
WHERE language IS NULL OR language = 'en';
