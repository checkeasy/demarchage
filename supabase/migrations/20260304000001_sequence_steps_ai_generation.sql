-- Ajouter generation IA sur les etapes de campagne
ALTER TABLE sequence_steps
  ADD COLUMN IF NOT EXISTS use_ai_generation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_prompt_context TEXT;

COMMENT ON COLUMN sequence_steps.use_ai_generation IS 'Si true, le contenu est genere par IA pour chaque prospect';
COMMENT ON COLUMN sequence_steps.ai_prompt_context IS 'Instructions supplementaires pour orienter la generation IA';
