-- ============================================================================
-- 012: Fix email_send_queue view
-- Add missing columns: signature_html, custom_fields, current_step_order
-- ============================================================================

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
    ea.email_address    AS from_email_address,
    ea.display_name     AS from_display_name,
    ea.signature_html,
    ea.daily_limit      AS account_daily_limit,
    ss.step_order       AS current_step_order
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
