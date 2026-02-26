-- ============================================================================
-- 001_core_tables.sql
-- Cold Outreach SaaS - Core Tables, RLS Policies, Triggers & Indexes
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. WORKSPACES
-- ============================================================================

CREATE TABLE public.workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    owner_id        UUID NOT NULL REFERENCES auth.users (id),
    plan            TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    settings        JSONB NOT NULL DEFAULT jsonb_build_object(
                        'timezone', 'Europe/Paris',
                        'daily_sending_limit', 200,
                        'sending_window_start', '08:00',
                        'sending_window_end', '19:00',
                        'sending_days', ARRAY['mon','tue','wed','thu','fri']
                    ),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. PROFILES (extends auth.users)
-- ============================================================================

CREATE TABLE public.profiles (
    id                   UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    full_name            TEXT,
    avatar_url           TEXT,
    current_workspace_id UUID REFERENCES public.workspaces (id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. WORKSPACE_MEMBERS (junction table)
-- ============================================================================

CREATE TABLE public.workspace_members (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role          TEXT NOT NULL DEFAULT 'member'
                      CHECK (role IN ('owner', 'admin', 'member')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);

-- ============================================================================
-- 4. EMAIL_ACCOUNTS (connected sending accounts)
-- ============================================================================

CREATE TABLE public.email_accounts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    email_address           TEXT NOT NULL,
    display_name            TEXT,

    -- SMTP configuration
    smtp_host               TEXT,
    smtp_port               INT,
    smtp_user               TEXT,
    smtp_pass_encrypted     TEXT,

    -- IMAP configuration
    imap_host               TEXT,
    imap_port               INT,
    imap_user               TEXT,
    imap_pass_encrypted     TEXT,

    -- Provider info
    provider                TEXT NOT NULL DEFAULT 'custom'
                                CHECK (provider IN ('gmail', 'outlook', 'custom')),
    resend_api_key_encrypted TEXT,

    -- Display & limits
    signature_html          TEXT,
    daily_limit             INT NOT NULL DEFAULT 50,

    -- Warmup
    warmup_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    warmup_daily_target     INT,
    warmup_current_volume   INT NOT NULL DEFAULT 0,

    -- Health
    health_score            INT NOT NULL DEFAULT 100,

    -- Status
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX idx_email_accounts_workspace_id ON public.email_accounts (workspace_id);
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members (workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members (user_id);
CREATE INDEX idx_workspaces_owner_id ON public.workspaces (owner_id);

-- ============================================================================
-- 6. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER set_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_email_accounts_updated_at
    BEFORE UPDATE ON public.email_accounts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 7. AUTO-CREATE PROFILE ON AUTH.USERS INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 8. AUTO-CREATE DEFAULT WORKSPACE ON PROFILE INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_workspace_id UUID;
    workspace_slug   TEXT;
BEGIN
    -- Generate a unique slug from the user id
    workspace_slug := 'ws-' || REPLACE(NEW.id::TEXT, '-', '');

    -- Create the default workspace
    INSERT INTO public.workspaces (id, name, slug, owner_id)
    VALUES (
        gen_random_uuid(),
        COALESCE(NULLIF(NEW.full_name, ''), 'My Workspace') || '''s Workspace',
        workspace_slug,
        NEW.id
    )
    RETURNING id INTO new_workspace_id;

    -- Add the user as owner in workspace_members
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');

    -- Set the current_workspace_id on the profile
    UPDATE public.profiles
    SET current_workspace_id = new_workspace_id
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- ============================================================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.workspaces       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts   ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. RLS POLICIES - WORKSPACES
-- Users can see workspaces they are members of
-- ============================================================================

CREATE POLICY "Users can view workspaces they belong to"
    ON public.workspaces
    FOR SELECT
    USING (
        id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Owners can update their workspaces"
    ON public.workspaces
    FOR UPDATE
    USING (
        id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
              AND role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
              AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Authenticated users can create workspaces"
    ON public.workspaces
    FOR INSERT
    WITH CHECK (
        auth.uid() = owner_id
    );

CREATE POLICY "Owners can delete their workspaces"
    ON public.workspaces
    FOR DELETE
    USING (
        owner_id = auth.uid()
    );

-- ============================================================================
-- 11. RLS POLICIES - PROFILES
-- Users can see and update only their own profile
-- ============================================================================

CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (
        id = auth.uid()
    );

CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (
        id = auth.uid()
    )
    WITH CHECK (
        id = auth.uid()
    );

-- Allow the trigger (SECURITY DEFINER) to insert profiles;
-- normal users should not insert profiles directly.
CREATE POLICY "Service role can insert profiles"
    ON public.profiles
    FOR INSERT
    WITH CHECK (
        id = auth.uid()
    );

-- ============================================================================
-- 12. RLS POLICIES - WORKSPACE_MEMBERS
-- Users can see members of workspaces they belong to
-- ============================================================================

CREATE POLICY "Users can view members of their workspaces"
    ON public.workspace_members
    FOR SELECT
    USING (
        user_id = auth.uid()
    );

CREATE POLICY "Admins can add members to their workspaces"
    ON public.workspace_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can update members in their workspaces"
    ON public.workspace_members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can remove members from their workspaces"
    ON public.workspace_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
        OR user_id = auth.uid()  -- members can leave
    );

-- ============================================================================
-- 13. RLS POLICIES - EMAIL_ACCOUNTS
-- Users can CRUD email accounts in workspaces they belong to
-- ============================================================================

CREATE POLICY "Users can view email accounts in their workspaces"
    ON public.email_accounts
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create email accounts in their workspaces"
    ON public.email_accounts
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update email accounts in their workspaces"
    ON public.email_accounts
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete email accounts in their workspaces"
    ON public.email_accounts
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- 14. GRANT USAGE (for anon and authenticated roles used by Supabase)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.workspaces TO anon, authenticated;
GRANT ALL    ON public.workspaces TO authenticated;

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT ALL    ON public.profiles TO authenticated;

GRANT SELECT ON public.workspace_members TO anon, authenticated;
GRANT ALL    ON public.workspace_members TO authenticated;

GRANT SELECT ON public.email_accounts TO anon, authenticated;
GRANT ALL    ON public.email_accounts TO authenticated;
