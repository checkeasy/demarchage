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

interface GenerateMessageRequest {
  type: 'connection' | 'followup' | 'email_sequence' | 'icebreaker';
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
    const { type, profile, context = {}, options = {} } = body;

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

    // Route to the appropriate generator
    let result: unknown;

    switch (type) {
      case 'connection': {
        result = await generateConnectionMessage(profile, context);
        break;
      }

      case 'followup': {
        result = await generateFollowUpMessage(
          profile,
          context,
          options.previousMessages || []
        );
        break;
      }

      case 'email_sequence': {
        result = await generateEmailSequence(
          profile,
          context,
          options.numSteps || 4
        );
        break;
      }

      case 'icebreaker': {
        result = await generateIcebreaker(
          profile,
          options.websiteData
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

    // Handle OpenAI-specific errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Cle API OpenAI invalide ou manquante' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Limite de requetes OpenAI atteinte. Veuillez reessayer dans quelques instants.' },
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
