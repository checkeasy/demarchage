// =============================================================================
// POST /api/whatsapp/send
// Envoie un message WhatsApp a un prospect
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWhatsAppClient } from '@/lib/whatsapp/client';
import { canPerformAction, recordAction, logWhatsAppAction } from '@/lib/whatsapp/rate-limiter';
import { WhatsAppActionType, WhatsAppError } from '@/lib/whatsapp/types';

export async function POST(request: NextRequest) {
  try {
    // --- Authentification ---
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non autorise. Veuillez vous connecter.' },
        { status: 401 }
      );
    }

    // --- Parse du body ---
    const body = await request.json();
    const { workspace_id, phone_number, message, prospect_id } = body as {
      workspace_id: string;
      phone_number: string;
      message: string;
      prospect_id?: string;
    };

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'workspace_id est requis' },
        { status: 400 }
      );
    }

    if (!phone_number) {
      return NextResponse.json(
        { error: 'phone_number est requis' },
        { status: 400 }
      );
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le message ne peut pas etre vide' },
        { status: 400 }
      );
    }

    // --- Verifier l'acces au workspace ---
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'Acces au workspace non autorise' },
        { status: 403 }
      );
    }

    // --- Verifier le rate limit ---
    const accountId = `whatsapp_${workspace_id}`;
    const canSend = await canPerformAction(accountId, WhatsAppActionType.MESSAGE);

    if (!canSend) {
      await logWhatsAppAction({
        workspaceId: workspace_id,
        prospectId: prospect_id,
        phoneNumber: phone_number,
        status: 'rate_limited',
      });

      return NextResponse.json(
        {
          error: 'Quota de messages WhatsApp epuise pour aujourd\'hui.',
          code: 'QUOTA_EXCEEDED',
        },
        { status: 429 }
      );
    }

    // --- Envoyer le message ---
    const client = await getWhatsAppClient(workspace_id);
    const result = await client.sendMessage(phone_number, message);

    // --- Enregistrer l'action ---
    await recordAction(accountId, WhatsAppActionType.MESSAGE);

    await logWhatsAppAction({
      workspaceId: workspace_id,
      prospectId: prospect_id,
      phoneNumber: phone_number,
      messageText: message,
      status: 'success',
      waMessageId: result.messageId,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('[API WhatsApp Send] Erreur:', err);

    if (err instanceof WhatsAppError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.errorType,
        },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne lors de l\'envoi du message WhatsApp' },
      { status: 500 }
    );
  }
}
