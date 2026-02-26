import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrchestrator } from '@/lib/agents/orchestrator';

// POST: Main generation endpoint
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
    const { prospectId, campaignId, channel, stepNumber, linkedinMessageType } = body;

    // Validate required fields
    if (!prospectId) {
      return NextResponse.json(
        { error: 'Le champ "prospectId" est requis' },
        { status: 400 }
      );
    }

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Le champ "campaignId" est requis' },
        { status: 400 }
      );
    }

    if (!channel || !['email', 'linkedin'].includes(channel)) {
      return NextResponse.json(
        { error: 'Le champ "channel" est requis et doit etre "email" ou "linkedin"' },
        { status: 400 }
      );
    }

    if (stepNumber === undefined || stepNumber === null) {
      return NextResponse.json(
        { error: 'Le champ "stepNumber" est requis' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();

    const result = await orchestrator.generateOutreach({
      workspaceId,
      prospectId,
      campaignId,
      channel,
      stepNumber,
      linkedinMessageType,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Agents] Orchestrate error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('api_key')) {
        return NextResponse.json(
          { error: 'Cle API OpenAI invalide ou manquante' },
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
      { error: 'Erreur interne du serveur lors de la generation' },
      { status: 500 }
    );
  }
}
