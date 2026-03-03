// =============================================================================
// POST /api/linkedin/connect
// Envoie une demande de connexion LinkedIn
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInClientForUser } from '@/lib/linkedin/client';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LinkedInError, LinkedInErrorType } from '@/lib/linkedin/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const body = await request.json();
    const { profileId, profileUrl, message } = body as {
      profileId: string;
      profileUrl?: string;
      message?: string;
    };

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId est requis' },
        { status: 400 }
      );
    }

    if (message && message.length > 300) {
      return NextResponse.json(
        { error: 'Le message ne peut pas depasser 300 caracteres' },
        { status: 400 }
      );
    }

    // Resolve workspace for DB-stored LinkedIn cookies
    let workspaceId = body.workspace_id as string | undefined;
    if (!workspaceId) {
      const admin = createAdminClient();
      const { data: ws } = await admin.from('workspaces').select('id').limit(1).single();
      workspaceId = ws?.id;
    }

    const client = await getLinkedInClientForUser(user.id, workspaceId || '');

    // Extraire le publicIdentifier depuis profileUrl ou profileId
    let publicId = profileId;
    if (profileUrl) {
      const match = profileUrl.match(/\/in\/([^/?]+)/);
      if (match) publicId = match[1];
    }

    // Vérifier le statut de connexion
    try {
      const status = await client.checkConnectionStatus(publicId);
      if (status.status === 'connected') {
        return NextResponse.json(
          { error: 'Deja connecte a cette personne' },
          { status: 409 }
        );
      }
      if (status.status === 'pending_outgoing') {
        return NextResponse.json(
          { error: 'Demande de connexion deja en attente' },
          { status: 409 }
        );
      }
    } catch {
      // Non bloquant
    }

    // Envoyer la demande
    const result = await client.sendConnectionRequest(profileId, message);

    return NextResponse.json({
      success: true,
      invitationId: result.invitationId,
    });
  } catch (err) {
    console.error('[API LinkedIn Connect] Erreur:', err);

    if (err instanceof LinkedInError) {
      const status =
        err.errorType === LinkedInErrorType.SESSION_EXPIRED ? 401
          : err.errorType === LinkedInErrorType.RATE_LIMITED ? 429
            : err.errorType === LinkedInErrorType.FORBIDDEN ? 403
              : 500;

      return NextResponse.json({ error: err.message, code: err.errorType }, { status });
    }

    return NextResponse.json(
      { error: 'Erreur interne lors de la connexion' },
      { status: 500 }
    );
  }
}
