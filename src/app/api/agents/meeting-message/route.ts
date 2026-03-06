import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrchestrator } from '@/lib/agents/orchestrator';

// POST: Generate a meeting booking message for a hot prospect
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
    const { prospectId, channel, bookingUrl } = body;

    if (!prospectId) {
      return NextResponse.json(
        { error: 'Le champ "prospectId" est requis' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();

    const result = await orchestrator.generateMeetingMessage(
      workspaceId,
      prospectId,
      channel || 'email',
      bookingUrl
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Agents] Meeting message error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('api_key')) {
        return NextResponse.json(
          { error: 'Cle API Anthropic invalide ou manquante' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Limite de requetes atteinte. Veuillez reessayer dans quelques instants.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la generation du message RDV' },
      { status: 500 }
    );
  }
}
