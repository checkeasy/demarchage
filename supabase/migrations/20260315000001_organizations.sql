-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    website         TEXT,
    domain          TEXT,
    industry        TEXT,
    city            TEXT,
    country         TEXT,
    phone           TEXT,
    description     TEXT,
    custom_fields   JSONB NOT NULL DEFAULT '{}',
    contact_count   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

-- Add organization_id to prospects
ALTER TABLE public.prospects
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations (id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_workspace ON public.organizations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON public.organizations (workspace_id, domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_org ON public.prospects (organization_id) WHERE organization_id IS NOT NULL;

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- RLS policies following the existing pattern with get_user_workspace_ids()
DROP POLICY IF EXISTS "Users can view organizations in their workspaces" ON public.organizations;
CREATE POLICY "Users can view organizations in their workspaces"
    ON public.organizations FOR SELECT
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

DROP POLICY IF EXISTS "Users can manage organizations in their workspaces" ON public.organizations;
CREATE POLICY "Users can manage organizations in their workspaces"
    ON public.organizations FOR ALL
    USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- Contact count trigger
CREATE OR REPLACE FUNCTION public.update_organization_contact_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.organization_id IS DISTINCT FROM NEW.organization_id THEN
            IF OLD.organization_id IS NOT NULL THEN
                UPDATE public.organizations SET contact_count = GREATEST(0, contact_count - 1) WHERE id = OLD.organization_id;
            END IF;
            IF NEW.organization_id IS NOT NULL THEN
                UPDATE public.organizations SET contact_count = contact_count + 1 WHERE id = NEW.organization_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'INSERT' AND NEW.organization_id IS NOT NULL THEN
        UPDATE public.organizations SET contact_count = contact_count + 1 WHERE id = NEW.organization_id;
    ELSIF TG_OP = 'DELETE' AND OLD.organization_id IS NOT NULL THEN
        UPDATE public.organizations SET contact_count = GREATEST(0, contact_count - 1) WHERE id = OLD.organization_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS maintain_org_contact_count ON public.prospects;
CREATE TRIGGER maintain_org_contact_count
    AFTER INSERT OR UPDATE OF organization_id OR DELETE ON public.prospects
    FOR EACH ROW EXECUTE FUNCTION public.update_organization_contact_count();
