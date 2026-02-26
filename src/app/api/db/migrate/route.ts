import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  const supabase = createAdminClient();

  // Get workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 500 });
  }

  // Check if columns already exist by trying to query them
  const { error: checkError } = await supabase
    .from('prospects')
    .select('country, pipeline_stage, loss_reason, notes, nb_properties, organization')
    .limit(1);

  if (!checkError) {
    return NextResponse.json({ message: 'Migration already applied - columns exist', workspace_id: workspace.id });
  }

  // Columns don't exist yet - we need to add them via direct SQL
  // Since we can't run DDL through the Supabase client, we'll use a workaround:
  // Create a temporary RPC function that runs the migration
  const migrationStatements = [
    "ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'France'",
    "ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'to_contact'",
    "ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS loss_reason TEXT",
    "ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS nb_properties INT",
    "ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS organization TEXT",
  ];

  return NextResponse.json({
    error: 'Cannot run DDL via Supabase client. Run these SQL statements in the Supabase SQL Editor:',
    sql: migrationStatements,
    full_sql: `
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/eykdqbpdxyowpvbflzcn/sql)
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'France';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'to_contact';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS loss_reason TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS nb_properties INT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS organization TEXT;

ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_status_check;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_status_check
  CHECK (status IN ('active','bounced','unsubscribed','replied','converted','lost','standby','to_contact'));

ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_source_check;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_source_check
  CHECK (source IN ('manual','csv_import','api','linkedin','google_maps','crm_import'));

CREATE INDEX IF NOT EXISTS idx_prospects_country ON public.prospects (workspace_id, country);
CREATE INDEX IF NOT EXISTS idx_prospects_pipeline ON public.prospects (workspace_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_prospects_organization ON public.prospects (workspace_id, organization);
    `,
    workspace_id: workspace.id,
  }, { status: 400 });
}
