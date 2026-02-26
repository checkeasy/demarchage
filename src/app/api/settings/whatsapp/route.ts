// =============================================================================
// GET/POST /api/settings/whatsapp
// Gestion de la connexion WhatsApp (QR code, statut, deconnexion)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getWhatsAppClientStatus,
  initializeWhatsAppClient,
  disconnectWhatsAppClient,
} from '@/lib/whatsapp/client';

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  return profile?.current_workspace_id || null;
}

export async function GET() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const info = getWhatsAppClientStatus(workspaceId);

  return NextResponse.json({
    status: info.status,
    phoneNumber: info.phoneNumber || null,
    qrCodeDataUrl: info.qrCode || null,
    lastError: info.lastError || null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === 'initialize') {
    try {
      const info = await initializeWhatsAppClient(workspaceId);
      return NextResponse.json({
        success: true,
        ...info,
      });
    } catch (err) {
      return NextResponse.json({
        success: false,
        status: 'error',
        lastError: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    }
  }

  if (action === 'disconnect') {
    await disconnectWhatsAppClient(workspaceId);
    return NextResponse.json({
      success: true,
      status: 'disconnected',
    });
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
}
