// =============================================================================
// GET/POST /api/settings/whatsapp
// Gestion de la connexion WhatsApp (QR code, statut, deconnexion)
// Per-user : chaque utilisateur a sa propre session WhatsApp
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getWhatsAppClientStatus,
  initializeWhatsAppClient,
  disconnectWhatsAppClient,
} from '@/lib/whatsapp/client';

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function GET() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const info = getWhatsAppClientStatus(userId);

  return NextResponse.json({
    status: info.status,
    phoneNumber: info.phoneNumber || null,
    qrCodeDataUrl: info.qrCode || null,
    lastError: info.lastError || null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === 'initialize') {
    try {
      const info = await initializeWhatsAppClient(userId);
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
    await disconnectWhatsAppClient(userId);
    return NextResponse.json({
      success: true,
      status: 'disconnected',
    });
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
}
