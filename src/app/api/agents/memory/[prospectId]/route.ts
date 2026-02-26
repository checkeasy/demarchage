import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Get all memory entries for a prospect
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  try {
    const { prospectId } = await params;

    if (!prospectId) {
      return NextResponse.json(
        { error: 'Le parametre "prospectId" est requis' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = profile?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Aucun workspace actif' }, { status: 400 });
    }

    // Verify the prospect belongs to this workspace
    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .select('id')
      .eq('id', prospectId)
      .eq('workspace_id', workspaceId)
      .single();

    if (prospectError || !prospect) {
      return NextResponse.json(
        { error: 'Prospect introuvable dans ce workspace' },
        { status: 404 }
      );
    }

    // Fetch memory entries for this prospect
    const { data: memories, error } = await supabase
      .from('agent_memory')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Agents] Memory fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ memories: memories || [] });
  } catch (error) {
    console.error('[Agents] Memory fetch error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
