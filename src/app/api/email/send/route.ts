import { NextRequest, NextResponse } from 'next/server';
import { sendGmail } from '@/lib/email/gmail-sender';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, from, replyTo } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'to, subject et body sont requis' },
        { status: 400 }
      );
    }

    const result = await sendGmail({
      to,
      subject,
      html: body,
      from,
      replyTo,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erreur lors de l\'envoi' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('[API email/send] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
