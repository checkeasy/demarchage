-- ============================================================================
-- 004_execution.sql
-- Cold Outreach SaaS - Campaign Execution, Emails Sent, Tracking & Queue
-- ============================================================================

-- ============================================================================
-- 1. CAMPAIGN_PROSPECTS (enrollment of prospects into campaigns)
-- ============================================================================

CREATE TABLE public.campaign_prospects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
    prospect_id         UUID NOT NULL REFERENCES public.prospects (id) ON DELETE CASCADE,
    current_step_id     UUID REFERENCES public.sequence_steps (id),
    status              TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'completed', 'replied', 'bounced', 'unsubscribed', 'error')),
    next_send_at        TIMESTAMPTZ,
    has_opened          BOOLEAN NOT NULL DEFAULT FALSE,
    has_clicked         BOOLEAN NOT NULL DEFAULT FALSE,
    has_replied         BOOLEAN NOT NULL DEFAULT FALSE,
    enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (campaign_id, prospect_id)
);

-- ============================================================================
-- 2. EMAILS_SENT
-- ============================================================================

CREATE TABLE public.emails_sent (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_prospect_id    UUID NOT NULL REFERENCES public.campaign_prospects (id) ON DELETE CASCADE,
    step_id                 UUID REFERENCES public.sequence_steps (id),
    ab_variant_id           UUID REFERENCES public.ab_variants (id),
    email_account_id        UUID REFERENCES public.email_accounts (id),
    from_email              TEXT,
    to_email                TEXT,
    subject                 TEXT,
    body_html               TEXT,
    body_text               TEXT,
    tracking_id             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    resend_message_id       TEXT,
    status                  TEXT NOT NULL DEFAULT 'queued'
                                CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed', 'complained')),
    queued_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at                 TIMESTAMPTZ,
    delivered_at            TIMESTAMPTZ,
    opened_at               TIMESTAMPTZ,
    clicked_at              TIMESTAMPTZ,
    replied_at              TIMESTAMPTZ,
    bounced_at              TIMESTAMPTZ,
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. TRACKING_EVENTS
-- ============================================================================

CREATE TABLE public.tracking_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_sent_id   UUID NOT NULL REFERENCES public.emails_sent (id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL
                        CHECK (event_type IN ('open', 'click', 'reply', 'bounce', 'complaint', 'unsubscribe')),
    clicked_url     TEXT,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- campaign_prospects
CREATE INDEX idx_campaign_prospects_campaign_id
    ON public.campaign_prospects (campaign_id);

CREATE INDEX idx_campaign_prospects_prospect_id
    ON public.campaign_prospects (prospect_id);

CREATE INDEX idx_campaign_prospects_next_send_active
    ON public.campaign_prospects (next_send_at)
    WHERE status = 'active';

CREATE INDEX idx_campaign_prospects_status
    ON public.campaign_prospects (status);

-- emails_sent
CREATE INDEX idx_emails_sent_campaign_prospect_id
    ON public.emails_sent (campaign_prospect_id);

CREATE INDEX idx_emails_sent_step_id
    ON public.emails_sent (step_id);

CREATE INDEX idx_emails_sent_tracking_id
    ON public.emails_sent (tracking_id);

CREATE INDEX idx_emails_sent_status
    ON public.emails_sent (status);

CREATE INDEX idx_emails_sent_email_account_id
    ON public.emails_sent (email_account_id);

-- tracking_events
CREATE INDEX idx_tracking_events_email_sent_id
    ON public.tracking_events (email_sent_id);

CREATE INDEX idx_tracking_events_event_type
    ON public.tracking_events (event_type);

-- ============================================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER set_campaign_prospects_updated_at
    BEFORE UPDATE ON public.campaign_prospects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 6. EMAIL_SEND_QUEUE VIEW
-- Retrieves all campaign prospects ready to be sent right now
-- ============================================================================

CREATE OR REPLACE VIEW public.email_send_queue AS
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
    ea.email_address    AS from_email_address,
    ea.display_name     AS from_display_name,
    ea.daily_limit      AS account_daily_limit
FROM public.campaign_prospects cp
JOIN public.campaigns c      ON c.id  = cp.campaign_id
JOIN public.prospects p      ON p.id  = cp.prospect_id
JOIN public.email_accounts ea ON ea.id = c.email_account_id
WHERE cp.status = 'active'
  AND cp.next_send_at <= NOW()
  AND c.status = 'active'
  AND ea.is_active = TRUE
  AND p.status = 'active';

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.campaign_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails_sent       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events   ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. RLS POLICIES - CAMPAIGN_PROSPECTS
-- Access through campaign's workspace membership
-- ============================================================================

CREATE POLICY "Users can view campaign prospects in their workspaces"
    ON public.campaign_prospects
    FOR SELECT
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can create campaign prospects in their workspaces"
    ON public.campaign_prospects
    FOR INSERT
    WITH CHECK (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can update campaign prospects in their workspaces"
    ON public.campaign_prospects
    FOR UPDATE
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    )
    WITH CHECK (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can delete campaign prospects in their workspaces"
    ON public.campaign_prospects
    FOR DELETE
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

-- ============================================================================
-- 9. RLS POLICIES - EMAILS_SENT
-- Access through campaign_prospect -> campaign -> workspace
-- ============================================================================

CREATE POLICY "Users can view sent emails in their workspaces"
    ON public.emails_sent
    FOR SELECT
    USING (
        campaign_prospect_id IN (
            SELECT cp.id FROM public.campaign_prospects cp
            JOIN public.campaigns c ON c.id = cp.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can create sent emails in their workspaces"
    ON public.emails_sent
    FOR INSERT
    WITH CHECK (
        campaign_prospect_id IN (
            SELECT cp.id FROM public.campaign_prospects cp
            JOIN public.campaigns c ON c.id = cp.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can update sent emails in their workspaces"
    ON public.emails_sent
    FOR UPDATE
    USING (
        campaign_prospect_id IN (
            SELECT cp.id FROM public.campaign_prospects cp
            JOIN public.campaigns c ON c.id = cp.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    )
    WITH CHECK (
        campaign_prospect_id IN (
            SELECT cp.id FROM public.campaign_prospects cp
            JOIN public.campaigns c ON c.id = cp.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can delete sent emails in their workspaces"
    ON public.emails_sent
    FOR DELETE
    USING (
        campaign_prospect_id IN (
            SELECT cp.id FROM public.campaign_prospects cp
            JOIN public.campaigns c ON c.id = cp.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

-- ============================================================================
-- 10. RLS POLICIES - TRACKING_EVENTS
-- Access through email_sent -> campaign_prospect -> campaign -> workspace
-- ============================================================================

CREATE POLICY "Users can view tracking events in their workspaces"
    ON public.tracking_events
    FOR SELECT
    USING (
        email_sent_id IN (
            SELECT es.id FROM public.emails_sent es
            JOIN public.campaign_prospects cp ON cp.id = es.campaign_prospect_id
            JOIN public.campaigns c ON c.id = cp.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can create tracking events in their workspaces"
    ON public.tracking_events
    FOR INSERT
    WITH CHECK (
        email_sent_id IN (
            SELECT es.id FROM public.emails_sent es
            JOIN public.campaign_prospects cp ON cp.id = es.campaign_prospect_id
            JOIN public.campaigns c ON c.id = cp.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can delete tracking events in their workspaces"
    ON public.tracking_events
    FOR DELETE
    USING (
        email_sent_id IN (
            SELECT es.id FROM public.emails_sent es
            JOIN public.campaign_prospects cp ON cp.id = es.campaign_prospect_id
            JOIN public.campaigns c ON c.id = cp.campaign_id
            WHERE c.workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

-- ============================================================================
-- 11. GRANTS
-- ============================================================================

GRANT SELECT ON public.campaign_prospects TO anon, authenticated;
GRANT ALL    ON public.campaign_prospects TO authenticated;

GRANT SELECT ON public.emails_sent TO anon, authenticated;
GRANT ALL    ON public.emails_sent TO authenticated;

GRANT SELECT ON public.tracking_events TO anon, authenticated;
GRANT ALL    ON public.tracking_events TO authenticated;

GRANT SELECT ON public.email_send_queue TO anon, authenticated;
