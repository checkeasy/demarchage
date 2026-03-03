// =============================================================================
// POST /api/whatsapp/check-number
// Verifie si un numero de telephone est enregistre sur WhatsApp
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWhatsAppClient, formatPhoneNumber } from '@/lib/whatsapp/client';
import { WhatsAppError } from '@/lib/whatsapp/types';

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { workspace_id, phone_number } = body as {
      workspace_id: string;
      phone_number: string;
    };

    if (!workspace_id || !phone_number) {
      return NextResponse.json(
        { error: 'workspace_id et phone_number sont requis' },
        { status: 400 }
      );
    }

    const client = await getWhatsAppClient(user.id);
    const registered = await client.checkNumberRegistered(phone_number);
    const formatted = formatPhoneNumber(phone_number).replace('@c.us', '');

    return NextResponse.json({
      registered,
      formattedNumber: formatted,
    });
  } catch (err) {
    if (err instanceof WhatsAppError) {
      return NextResponse.json(
        { error: err.message, code: err.errorType },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la verification du numero' },
      { status: 500 }
    );
  }
}
