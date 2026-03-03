-- =============================================================================
-- Migration: Per-user credentials (LinkedIn, Email, WhatsApp)
-- Ajoute user_id aux tables linkedin_accounts et email_accounts
-- Migre les cookies LinkedIn de workspaces.settings vers linkedin_accounts
-- =============================================================================

-- 1A. Ajouter user_id a linkedin_accounts
ALTER TABLE public.linkedin_accounts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_user ON public.linkedin_accounts(user_id);

-- 1B. Ajouter user_id a email_accounts
ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON public.email_accounts(user_id);

-- 1C. Backfill: attribuer les comptes existants au owner du workspace
UPDATE public.linkedin_accounts la
SET user_id = w.owner_id
FROM public.workspaces w
WHERE la.workspace_id = w.id
  AND la.user_id IS NULL;

UPDATE public.email_accounts ea
SET user_id = w.owner_id
FROM public.workspaces w
WHERE ea.workspace_id = w.id
  AND ea.user_id IS NULL;

-- 1D. Migrer les cookies LinkedIn de workspaces.settings vers linkedin_accounts
-- (pour les workspaces qui ont des cookies mais pas encore de ligne linkedin_accounts)
INSERT INTO public.linkedin_accounts (workspace_id, user_id, name, li_at_cookie, jsessionid_cookie)
SELECT
  w.id,
  w.owner_id,
  'Compte principal',
  w.settings->>'linkedin_li_at',
  w.settings->>'linkedin_jsessionid'
FROM public.workspaces w
WHERE w.settings->>'linkedin_li_at' IS NOT NULL
  AND w.settings->>'linkedin_li_at' != ''
  AND w.settings->>'linkedin_jsessionid' IS NOT NULL
  AND w.settings->>'linkedin_jsessionid' != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.linkedin_accounts la
    WHERE la.workspace_id = w.id AND la.user_id = w.owner_id
  );
