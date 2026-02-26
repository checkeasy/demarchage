-- ============================================================================
-- 005_inbox.sql
-- Cold Outreach SaaS - Inbox Threads & Messages
-- ============================================================================

-- ============================================================================
-- 1. INBOX_THREADS
-- ============================================================================

CREATE TABLE public.inbox_threads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    prospect_id         UUID REFERENCES public.prospects (id) ON DELETE SET NULL,
    campaign_id         UUID REFERENCES public.campaigns (id) ON DELETE SET NULL,
    email_account_id    UUID REFERENCES public.email_accounts (id),
    subject             TEXT,
    last_message_at     TIMESTAMPTZ,
    message_count       INT NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'replied', 'closed', 'snoozed')),
    assigned_to         UUID REFERENCES auth.users (id),
    snoozed_until       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INBOX_MESSAGES
-- ============================================================================

CREATE TABLE public.inbox_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID NOT NULL REFERENCES public.inbox_threads (id) ON DELETE CASCADE,
    direction           TEXT NOT NULL
                            CHECK (direction IN ('inbound', 'outbound')),
    from_email          TEXT,
    to_email            TEXT,
    subject             TEXT,
    body_html           TEXT,
    body_text           TEXT,
    email_sent_id       UUID REFERENCES public.emails_sent (id),
    message_id_header   TEXT,
    in_reply_to_header  TEXT,
    references_header   TEXT,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX idx_inbox_threads_workspace_id
    ON public.inbox_threads (workspace_id);

CREATE INDEX idx_inbox_threads_prospect_id
    ON public.inbox_threads (prospect_id);

CREATE INDEX idx_inbox_threads_campaign_id
    ON public.inbox_threads (campaign_id);

CREATE INDEX idx_inbox_threads_email_account_id
    ON public.inbox_threads (email_account_id);

CREATE INDEX idx_inbox_threads_status
    ON public.inbox_threads (status);

CREATE INDEX idx_inbox_threads_assigned_to
    ON public.inbox_threads (assigned_to);

CREATE INDEX idx_inbox_threads_last_message_at
    ON public.inbox_threads (last_message_at DESC);

CREATE INDEX idx_inbox_messages_thread_id
    ON public.inbox_messages (thread_id);

CREATE INDEX idx_inbox_messages_email_sent_id
    ON public.inbox_messages (email_sent_id);

CREATE INDEX idx_inbox_messages_direction
    ON public.inbox_messages (direction);

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER set_inbox_threads_updated_at
    BEFORE UPDATE ON public.inbox_threads
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.inbox_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES - INBOX_THREADS
-- ============================================================================

CREATE POLICY "Users can view inbox threads in their workspaces"
    ON public.inbox_threads
    FOR SELECT
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can create inbox threads in their workspaces"
    ON public.inbox_threads
    FOR INSERT
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can update inbox threads in their workspaces"
    ON public.inbox_threads
    FOR UPDATE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    )
    WITH CHECK (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

CREATE POLICY "Users can delete inbox threads in their workspaces"
    ON public.inbox_threads
    FOR DELETE
    USING (
        workspace_id IN (SELECT public.get_user_workspace_ids())
    );

-- ============================================================================
-- 7. RLS POLICIES - INBOX_MESSAGES
-- Access through thread's workspace membership
-- ============================================================================

CREATE POLICY "Users can view inbox messages in their workspaces"
    ON public.inbox_messages
    FOR SELECT
    USING (
        thread_id IN (
            SELECT id FROM public.inbox_threads
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can create inbox messages in their workspaces"
    ON public.inbox_messages
    FOR INSERT
    WITH CHECK (
        thread_id IN (
            SELECT id FROM public.inbox_threads
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can update inbox messages in their workspaces"
    ON public.inbox_messages
    FOR UPDATE
    USING (
        thread_id IN (
            SELECT id FROM public.inbox_threads
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    )
    WITH CHECK (
        thread_id IN (
            SELECT id FROM public.inbox_threads
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

CREATE POLICY "Users can delete inbox messages in their workspaces"
    ON public.inbox_messages
    FOR DELETE
    USING (
        thread_id IN (
            SELECT id FROM public.inbox_threads
            WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
        )
    );

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT SELECT ON public.inbox_threads TO anon, authenticated;
GRANT ALL    ON public.inbox_threads TO authenticated;

GRANT SELECT ON public.inbox_messages TO anon, authenticated;
GRANT ALL    ON public.inbox_messages TO authenticated;
