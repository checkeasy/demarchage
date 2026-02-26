-- =============================================================================
-- Migration: Integration WhatsApp
-- Ajoute le support WhatsApp dans les campagnes, automations et rate limiting
-- =============================================================================

-- 1. Ajouter 'whatsapp' aux step types des campagnes
ALTER TABLE public.sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_step_type_check;

ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_step_type_check
  CHECK (step_type IN ('email', 'linkedin_connect', 'linkedin_message', 'delay', 'condition', 'whatsapp'));

-- Ajouter la colonne whatsapp_message
ALTER TABLE public.sequence_steps
  ADD COLUMN IF NOT EXISTS whatsapp_message TEXT;

-- 2. Ajouter 'whatsapp' aux action types des automations
ALTER TABLE public.automation_steps
  DROP CONSTRAINT IF EXISTS automation_steps_action_type_check;

ALTER TABLE public.automation_steps
  ADD CONSTRAINT automation_steps_action_type_check
  CHECK (action_type IN ('view_profile', 'connect', 'message', 'email', 'wait', 'check_accepted', 'like_post', 'whatsapp'));

-- 3. Ajouter 'whatsapp' aux logs d'actions automation
ALTER TABLE public.automation_actions_log
  DROP CONSTRAINT IF EXISTS automation_actions_log_action_type_check;

ALTER TABLE public.automation_actions_log
  ADD CONSTRAINT automation_actions_log_action_type_check
  CHECK (action_type IN ('search', 'view_profile', 'connect', 'message', 'email', 'withdraw', 'like_post', 'check_accepted', 'whatsapp'));

-- 4. Table de rate limiting WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'message',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, action_type, date)
);

ALTER TABLE public.whatsapp_rate_limits ENABLE ROW LEVEL SECURITY;

-- 5. Table de logs WhatsApp (audit/analytics)
CREATE TABLE IF NOT EXISTS public.whatsapp_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  phone_number TEXT,
  message_text TEXT,
  action_type TEXT NOT NULL DEFAULT 'message',
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'rate_limited', 'invalid_number')),
  error_message TEXT,
  wa_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_workspace ON whatsapp_action_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_prospect ON whatsapp_action_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created ON whatsapp_action_logs(created_at DESC);

ALTER TABLE public.whatsapp_action_logs ENABLE ROW LEVEL SECURITY;
