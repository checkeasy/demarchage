-- Lead Magnets table for storing generated one-pagers per ICP segment
CREATE TABLE IF NOT EXISTS lead_magnets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  segment_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  lead_magnet_type TEXT NOT NULL CHECK (lead_magnet_type IN ('checklist', 'mini_guide', 'template', 'audit_framework')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_magnets_workspace ON lead_magnets(workspace_id);

ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage lead magnets in their workspace"
  ON lead_magnets FOR ALL
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));
