import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrchestrator } from '@/lib/agents/orchestrator';

// POST: Get AI strategy recommendation for a segment of prospects
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { segmentStats, prospectIds } = body;

    if (!segmentStats || !prospectIds || !Array.isArray(prospectIds)) {
      return NextResponse.json(
        { error: 'segmentStats et prospectIds sont requis' },
        { status: 400 }
      );
    }

    // Fetch a sample of prospects for context
    const sampleIds = prospectIds.slice(0, 5);
    const { data: sampleProspects } = await supabase
      .from('prospects')
      .select('first_name, last_name, email, organization, job_title, nb_properties, country, custom_fields')
      .in('id', sampleIds);

    const orchestrator = getOrchestrator();

    // Use CEO agent to generate strategy
    const strategyResult = await orchestrator.generateOutreach({
      workspaceId,
      prospectId: sampleIds[0],
      campaignId: 'strategy-request',
      channel: 'email',
      stepNumber: 0,
    });

    // Build a richer strategy response
    const strategy = {
      ...strategyResult.content,
      segment_stats: segmentStats,
      sample_prospects: sampleProspects?.map(p => ({
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        organization: p.organization,
        nb_properties: p.nb_properties,
        country: p.country,
      })),
      recommended_sequence: {
        length: 7,
        channels: ['email', 'linkedin'],
        delays: [0, 3, 4, 7, 3, 7, 5],
        steps: [
          { type: 'email', label: 'Email de curiosite' },
          { type: 'delay', days: 3 },
          { type: 'email', label: 'Email de valeur' },
          { type: 'delay', days: 4 },
          { type: 'linkedin_connect', label: 'Connexion LinkedIn' },
          { type: 'delay', days: 7 },
          { type: 'email', label: 'Email de breakup' },
        ],
      },
    };

    return NextResponse.json({ success: true, strategy });
  } catch (error) {
    console.error('[Agents] Strategy error:', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de la generation de la strategie' },
      { status: 500 }
    );
  }
}
