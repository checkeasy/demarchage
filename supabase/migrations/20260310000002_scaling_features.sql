-- ============================================================================
-- SCALING FEATURES MIGRATION
-- Phase 6: Email account rotation (campaign_email_accounts junction table)
-- Phase 8: Domain reputation monitoring (account_health_logs table)
-- Phase 9: Custom tracking domain (tracking_domain column)
-- Phase 10: Provider-specific rate limits (provider_daily_max column)
-- ============================================================================

-- 1. Campaign email accounts junction table for rotation
CREATE TABLE IF NOT EXISTS public.campaign_email_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
    email_account_id UUID NOT NULL REFERENCES public.email_accounts (id) ON DELETE CASCADE,
    priority        INT NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    emails_sent_today INT NOT NULL DEFAULT 0,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(campaign_id, email_account_id)
);

-- Enable RLS
ALTER TABLE public.campaign_email_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view campaign email accounts in their workspaces' AND tablename = 'campaign_email_accounts') THEN
    CREATE POLICY "Users can view campaign email accounts in their workspaces"
        ON public.campaign_email_accounts FOR SELECT
        USING (campaign_id IN (SELECT id FROM public.campaigns WHERE workspace_id IN (SELECT public.get_user_workspace_ids())));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage campaign email accounts in their workspaces' AND tablename = 'campaign_email_accounts') THEN
    CREATE POLICY "Users can manage campaign email accounts in their workspaces"
        ON public.campaign_email_accounts FOR ALL
        USING (campaign_id IN (SELECT id FROM public.campaigns WHERE workspace_id IN (SELECT public.get_user_workspace_ids())));
  END IF;
END $$;

-- 2. Account health logs for domain reputation monitoring
CREATE TABLE IF NOT EXISTS public.account_health_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_account_id UUID NOT NULL REFERENCES public.email_accounts (id) ON DELETE CASCADE,
    log_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    emails_sent     INT NOT NULL DEFAULT 0,
    emails_bounced  INT NOT NULL DEFAULT 0,
    emails_complained INT NOT NULL DEFAULT 0,
    bounce_rate     NUMERIC(5,2) DEFAULT 0,
    complaint_rate  NUMERIC(5,4) DEFAULT 0,
    health_score    INT NOT NULL DEFAULT 100,
    auto_disabled   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(email_account_id, log_date)
);

ALTER TABLE public.account_health_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view health logs in their workspaces' AND tablename = 'account_health_logs') THEN
    CREATE POLICY "Users can view health logs in their workspaces"
        ON public.account_health_logs FOR SELECT
        USING (email_account_id IN (SELECT id FROM public.email_accounts WHERE workspace_id IN (SELECT public.get_user_workspace_ids())));
  END IF;
END $$;

-- 3. Add tracking_domain and provider_daily_max to email_accounts
ALTER TABLE public.email_accounts
    ADD COLUMN IF NOT EXISTS tracking_domain TEXT,
    ADD COLUMN IF NOT EXISTS provider_daily_max INT;

-- Set default provider limits based on existing provider values
-- (applied once, user can override)
UPDATE public.email_accounts
SET provider_daily_max = CASE
    WHEN provider = 'gmail' THEN 500
    WHEN provider = 'outlook' THEN 300
    ELSE 1000
END
WHERE provider_daily_max IS NULL;

-- 4. Add smtp_verified flag to email verification results
ALTER TABLE public.prospects
    ADD COLUMN IF NOT EXISTS email_smtp_verified BOOLEAN;

-- 5. Update email_send_queue view to include new fields
DROP VIEW IF EXISTS public.email_send_queue;
CREATE VIEW public.email_send_queue AS
SELECT
    cp.id               AS campaign_prospect_id,
    cp.campaign_id,
    cp.prospect_id,
    cp.current_step_id,
    cp.next_send_at,
    c.workspace_id,
    c.email_account_id,
    c.timezone,
    c.sending_window_start,
    c.sending_window_end,
    c.sending_days,
    c.daily_limit       AS campaign_daily_limit,
    c.track_opens,
    c.track_clicks,
    p.email             AS prospect_email,
    p.first_name        AS prospect_first_name,
    p.last_name         AS prospect_last_name,
    p.company           AS prospect_company,
    p.custom_fields,
    p.email_validity_score,
    p.website           AS prospect_website,
    p.linkedin_url      AS prospect_linkedin_url,
    p.job_title         AS prospect_job_title,
    p.organization      AS prospect_organization,
    p.industry          AS prospect_industry,
    p.city              AS prospect_city,
    p.notes             AS prospect_notes,
    p.location          AS prospect_location,
    ea.email_address    AS from_email_address,
    ea.display_name     AS from_display_name,
    ea.signature_html,
    ea.daily_limit      AS account_daily_limit,
    ea.provider         AS email_provider,
    ea.booking_url,
    ea.smtp_host,
    ea.smtp_port,
    ea.smtp_user,
    ea.smtp_pass_encrypted,
    ea.warmup_enabled,
    ea.warmup_daily_target,
    ea.warmup_current_volume,
    ea.tracking_domain,
    ea.provider_daily_max,
    ea.health_score     AS account_health_score,
    ss.step_order       AS current_step_order,
    ss.use_ai_generation,
    ss.ai_prompt_context
FROM public.campaign_prospects cp
JOIN public.campaigns c        ON c.id  = cp.campaign_id
JOIN public.prospects p        ON p.id  = cp.prospect_id
JOIN public.email_accounts ea  ON ea.id = c.email_account_id
LEFT JOIN public.sequence_steps ss ON ss.id = cp.current_step_id
WHERE cp.status = 'active'
  AND cp.next_send_at <= NOW()
  AND c.status = 'active'
  AND ea.is_active = TRUE
  AND p.status = 'active';

-- 6. RPC function to pick next rotation account for a campaign
CREATE OR REPLACE FUNCTION public.get_rotation_account(p_campaign_id UUID)
RETURNS TABLE (
    email_account_id UUID,
    email_address TEXT,
    display_name TEXT,
    smtp_host TEXT,
    smtp_port INT,
    smtp_user TEXT,
    smtp_pass_encrypted TEXT,
    signature_html TEXT,
    daily_limit INT,
    provider TEXT,
    booking_url TEXT,
    warmup_enabled BOOLEAN,
    warmup_current_volume INT,
    warmup_daily_target INT,
    tracking_domain TEXT,
    provider_daily_max INT,
    health_score INT
) LANGUAGE sql STABLE AS $$
    SELECT
        ea.id AS email_account_id,
        ea.email_address,
        ea.display_name,
        ea.smtp_host,
        ea.smtp_port,
        ea.smtp_user,
        ea.smtp_pass_encrypted,
        ea.signature_html,
        ea.daily_limit,
        ea.provider::TEXT,
        ea.booking_url,
        ea.warmup_enabled,
        ea.warmup_current_volume,
        ea.warmup_daily_target,
        ea.tracking_domain,
        ea.provider_daily_max,
        ea.health_score
    FROM public.campaign_email_accounts cea
    JOIN public.email_accounts ea ON ea.id = cea.email_account_id
    WHERE cea.campaign_id = p_campaign_id
      AND cea.is_active = TRUE
      AND ea.is_active = TRUE
      AND ea.health_score > 30
    ORDER BY cea.last_used_at ASC NULLS FIRST, cea.priority ASC
    LIMIT 1;
$$;
