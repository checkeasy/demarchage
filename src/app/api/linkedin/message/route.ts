// =============================================================================
// POST /api/linkedin/message
// Envoie un message LinkedIn à une connexion de 1er degré
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLinkedInClient } from '@/lib/linkedin/client';
import { canPerformAction, recordAction, logLinkedInAction } from '@/lib/linkedin/rate-limiter';
import { LinkedInActionType, LinkedInError, LinkedInErrorType } from '@/lib/linkedin/types';

export async function POST(request: NextRequest) {
  try {
    // --- Authentification ---
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non autorisé. Veuillez vous connecter.' },
        { status: 401 }
      );
    }

    // --- Parse du body ---
    const body = await request.json();
    const { workspace_id, profile_urn, public_id, message } = body as {
      workspace_id: string;
      profile_urn: string;
      public_id?: string;
      message: string;
    };

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'workspace_id est requis' },
        { status: 400 }
      );
    }

    if (!profile_urn) {
      return NextResponse.json(
        { error: 'profile_urn est requis (URN ou ID du profil LinkedIn)' },
        { status: 400 }
      );
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le message ne peut pas être vide' },
        { status: 400 }
      );
    }

    if (message.length > 8000) {
      return NextResponse.json(
        {
          error: 'Le message ne peut pas dépasser 8000 caractères',
          currentLength: message.length,
          maxLength: 8000,
        },
        { status: 400 }
      );
    }

    // --- Vérifier l'accès au workspace ---
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'Accès au workspace non autorisé' },
        { status: 403 }
      );
    }

    // --- Vérifier le rate limit ---
    const accountId = `linkedin_${workspace_id}`;
    const canMessage = await canPerformAction(accountId, LinkedInActionType.MESSAGE);

    if (!canMessage) {
      await logLinkedInAction({
        workspaceId: workspace_id,
        accountId,
        actionType: LinkedInActionType.MESSAGE,
        targetProfileId: profile_urn,
        targetPublicId: public_id || null,
        status: 'rate_limited',
      });

      return NextResponse.json(
        {
          error: 'Quota de messages LinkedIn épuisé pour aujourd\'hui. Réessayez demain.',
          code: 'QUOTA_EXCEEDED',
        },
        { status: 429 }
      );
    }

    // --- Vérifier que la personne est une connexion de 1er degré ---
    const client = getLinkedInClient();

    if (public_id) {
      try {
        const connectionInfo = await client.checkConnectionStatus(public_id);

        if (connectionInfo.status !== 'connected') {
          return NextResponse.json(
            {
              error: 'Vous ne pouvez envoyer un message qu\'à vos connexions de 1er degré. Envoyez d\'abord une demande de connexion.',
              code: 'NOT_CONNECTED',
              connectionStatus: connectionInfo.status,
            },
            { status: 400 }
          );
        }
      } catch {
        // Non bloquant - on tente l'envoi quand même
        console.warn('[LinkedIn Message] Impossible de vérifier le statut de connexion');
      }
    }

    // --- Envoyer le message ---
    const result = await client.sendMessage(profile_urn, message);

    // --- Enregistrer l'action ---
    await recordAction(accountId, LinkedInActionType.MESSAGE);

    await logLinkedInAction({
      workspaceId: workspace_id,
      accountId,
      actionType: LinkedInActionType.MESSAGE,
      targetProfileId: profile_urn,
      targetPublicId: public_id || null,
      status: 'success',
      payload: {
        messageLength: message.length,
      },
    });

    return NextResponse.json({
      success: result.success,
      message: 'Message envoyé avec succès',
    });
  } catch (err) {
    console.error('[API LinkedIn Message] Erreur:', err);

    if (err instanceof LinkedInError) {
      const status =
        err.errorType === LinkedInErrorType.SESSION_EXPIRED
          ? 401
          : err.errorType === LinkedInErrorType.RATE_LIMITED
            ? 429
            : err.errorType === LinkedInErrorType.FORBIDDEN
              ? 403
              : err.errorType === LinkedInErrorType.NOT_FOUND
                ? 404
                : 500;

      return NextResponse.json(
        {
          error: err.message,
          code: err.errorType,
        },
        { status }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne lors de l\'envoi du message LinkedIn' },
      { status: 500 }
    );
  }
}
