import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateConnectionMessage,
  generateFollowUpMessage,
  generateEmailSequence,
  generateIcebreaker,
  type ProspectProfile,
  type MessageContext,
  type PreviousMessage,
  type WebsiteDataForIcebreaker,
} from '@/lib/ai/message-generator';
import type { WorkspaceAIContext } from '@/lib/ai/prompts';

interface GenerateMessageRequest {
  type: 'connection' | 'followup' | 'email_sequence' | 'icebreaker';
  workspace_id?: string;
  profile: ProspectProfile;
  context?: MessageContext;
  options?: {
    previousMessages?: PreviousMessage[];
    numSteps?: number;
    websiteData?: WebsiteDataForIcebreaker;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non autorise' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: GenerateMessageRequest = await request.json();
    const { type, workspace_id, profile, context = {}, options = {} } = body;

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: 'Le champ "type" est requis (connection | followup | email_sequence | icebreaker)' },
        { status: 400 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Le champ "profile" est requis' },
        { status: 400 }
      );
    }

    // Load workspace AI context
    // ai_company_context is a column on workspaces table
    // ai_tone, ai_target_audience are inside settings JSONB
    let wsCtx: WorkspaceAIContext = {};
    if (workspace_id) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('name, ai_company_context, settings')
        .eq('id', workspace_id)
        .single();
      if (ws) {
        const s = (ws.settings || {}) as Record<string, unknown>;
        wsCtx = {
          companyName: ws.name || undefined,
          companyContext: (ws as Record<string, unknown>).ai_company_context as string || undefined,
          aiTone: (s.ai_tone as string) || undefined,
          targetAudience: (s.ai_target_audience as string) || undefined,
        };
      }
    }

    // Route to the appropriate generator
    let result: unknown;

    switch (type) {
      case 'connection': {
        result = await generateConnectionMessage(profile, context, wsCtx);
        break;
      }

      case 'followup': {
        result = await generateFollowUpMessage(
          profile,
          context,
          options.previousMessages || [],
          wsCtx
        );
        break;
      }

      case 'email_sequence': {
        result = await generateEmailSequence(
          profile,
          context,
          options.numSteps || 4,
          wsCtx
        );
        break;
      }

      case 'icebreaker': {
        result = await generateIcebreaker(
          profile,
          options.websiteData,
          wsCtx
        );
        break;
      }

      default: {
        return NextResponse.json(
          {
            error: `Type "${type}" non supporte. Types valides: connection, followup, email_sequence, icebreaker`,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      type,
      data: result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erreur generation de message:', error);

    // Handle Anthropic-specific errors
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('api_key')) {
        return NextResponse.json(
          { error: 'Cle API Anthropic invalide ou manquante' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Limite de requetes Anthropic atteinte. Veuillez reessayer dans quelques instants.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la generation du message' },
      { status: 500 }
    );
  }
}
