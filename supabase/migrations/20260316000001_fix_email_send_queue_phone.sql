-- Fix: add prospect_phone to email_send_queue view
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
    p.phone             AS prospect_phone,
    p.custom_fields,
    p.email_score AS email_validity_score,
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
