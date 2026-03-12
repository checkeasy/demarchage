import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Get the user's workspace
  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single();
  if (!profile?.current_workspace_id) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const workspaceId = profile.current_workspace_id;

  // Check if columns already exist by trying to query them
  const { error: checkError } = await supabase
    .from('prospects')
    .select('country, pipeline_stage, loss_reason, notes, nb_properties, organization')
    .limit(1);

  if (!checkError) {
    return NextResponse.json({
      message: 'Migration check completed',
      columns_exist: true,
    });
  }

  // Columns don't exist yet - migration needs to be run via SQL editor
  return NextResponse.json({
    message: 'Migration check completed',
    columns_exist: false,
    action_required: 'Run the pending migration via the Supabase SQL Editor.',
  }, { status: 400 });
}
