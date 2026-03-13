-- ============================================================================
-- 20260312100001_call_outcomes_and_deal_contacts.sql
-- Feature 1: Call outcomes on activities
-- Feature 2: Deal contacts (multi-participants)
-- Feature 3: Email tracking columns on deals
-- ============================================================================

-- ============================================================================
-- 1. CALL OUTCOMES on activities
-- ============================================================================

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS call_outcome TEXT
  CHECK (call_outcome IN ('connected', 'no_answer', 'left_message', 'left_voicemail', 'wrong_number', 'busy', 'callback_scheduled'));

CREATE INDEX IF NOT EXISTS idx_activities_call_outcome
  ON public.activities (workspace_id, call_outcome)
  WHERE call_outcome IS NOT NULL;

-- ============================================================================
-- 2. DEAL_CONTACTS table (multi-participants on deals)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deal_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id         UUID NOT NULL REFERENCES public.deals (id) ON DELETE CASCADE,
    prospect_id     UUID NOT NULL REFERENCES public.prospects (id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'contact'
                    CHECK (role IN ('primary', 'contact', 'decision_maker', 'influencer', 'champion', 'blocker')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (deal_id, prospect_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal_id
    ON public.deal_contacts (deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_contacts_prospect_id
    ON public.deal_contacts (prospect_id);

-- RLS
ALTER TABLE public.deal_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deal contacts in their workspaces"
    ON public.deal_contacts
    FOR SELECT
    USING (
        deal_id IN (SELECT id FROM public.deals WHERE workspace_id IN (SELECT public.get_user_workspace_ids()))
    );

CREATE POLICY "Users can create deal contacts in their workspaces"
    ON public.deal_contacts
    FOR INSERT
    WITH CHECK (
        deal_id IN (SELECT id FROM public.deals WHERE workspace_id IN (SELECT public.get_user_workspace_ids()))
    );

CREATE POLICY "Users can update deal contacts in their workspaces"
    ON public.deal_contacts
    FOR UPDATE
    USING (
        deal_id IN (SELECT id FROM public.deals WHERE workspace_id IN (SELECT public.get_user_workspace_ids()))
    )
    WITH CHECK (
        deal_id IN (SELECT id FROM public.deals WHERE workspace_id IN (SELECT public.get_user_workspace_ids()))
    );

CREATE POLICY "Users can delete deal contacts in their workspaces"
    ON public.deal_contacts
    FOR DELETE
    USING (
        deal_id IN (SELECT id FROM public.deals WHERE workspace_id IN (SELECT public.get_user_workspace_ids()))
    );

CREATE POLICY "Service role full access to deal_contacts"
    ON public.deal_contacts
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Grants
GRANT SELECT ON public.deal_contacts TO anon, authenticated;
GRANT ALL    ON public.deal_contacts TO authenticated;

-- ============================================================================
-- 3. EMAIL TRACKING columns on deals
-- ============================================================================

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_email_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_count INT NOT NULL DEFAULT 0;

-- RPC to increment deal email count atomically
CREATE OR REPLACE FUNCTION public.increment_deal_email_count(p_deal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.deals
  SET email_count = email_count + 1,
      last_email_sent_at = NOW()
  WHERE id = p_deal_id;
END;
$$;
