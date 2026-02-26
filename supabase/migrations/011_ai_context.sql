-- ============================================================================
-- 011_ai_context.sql
-- Add AI company context to workspaces for personalized email generation
-- ============================================================================

ALTER TABLE public.workspaces
    ADD COLUMN IF NOT EXISTS ai_company_context TEXT;

COMMENT ON COLUMN public.workspaces.ai_company_context IS
    'Description detaillee de l''entreprise, son offre, ses cibles. Utilisee par l''IA pour personnaliser les emails de prospection.';
