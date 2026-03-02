import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrchestrator } from '@/lib/agents/orchestrator';
import type { GenerationResult } from '@/lib/agents/types';

// Small delay between calls to avoid rate limits
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST: Batch generation for multiple prospects
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
    const { prospectIds, campaignId, channel, stepNumber, linkedinMessageType } = body;

    // Validate required fields
    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json(
        { error: 'Le champ "prospectIds" est requis et doit etre un tableau non vide' },
        { status: 400 }
      );
    }

    if (prospectIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 prospects par lot' },
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
    const results: GenerationResult[] = [];
    const errors: { prospectId: string; error: string }[] = [];

    // Process sequentially to avoid rate limits
    for (let i = 0; i < prospectIds.length; i++) {
      const prospectId = prospectIds[i];

      try {
        const result = await orchestrator.generateOutreach({
          workspaceId,
          prospectId,
          campaignId,
          channel,
          stepNumber,
          linkedinMessageType,
        });

        results.push(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
        console.error(`[Agents] Batch error for prospect ${prospectId}:`, errorMessage);
        errors.push({ prospectId, error: errorMessage });
      }

      // Add delay between calls to avoid rate limits (except after the last one)
      if (i < prospectIds.length - 1) {
        await delay(500);
      }
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        total: prospectIds.length,
        succeeded: results.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    console.error('[Agents] Batch orchestrate error:', error);

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
      { error: 'Erreur interne du serveur lors de la generation par lot' },
      { status: 500 }
    );
  }
}
