import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';

// GET: Get performance metrics for agents
export async function GET(request: NextRequest) {
  try {
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'weekly';
    const agentType = searchParams.get('agent_type');
    const segmentKey = searchParams.get('segment_key');

    // Build query
    let query = supabase
      .from('agent_performance_metrics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('period', period)
      .order('calculated_at', { ascending: false });

    if (agentType) {
      query = query.eq('agent_type', agentType);
    }

    if (segmentKey) {
      query = query.eq('segment_key', segmentKey);
    }

    const { data: metrics, error } = await query;

    if (error) {
      console.error('[Agents] Performance metrics error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ metrics: metrics || [] });
  } catch (error) {
    console.error('[Agents] Performance metrics error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
