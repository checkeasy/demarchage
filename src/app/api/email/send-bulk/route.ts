import { NextRequest, NextResponse } from 'next/server';
import { sendBulkGmail } from '@/lib/email/gmail-sender';

export async function POST(request: NextRequest) {
  try {
    const { recipients, delayMs } = await request.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'recipients (array) est requis' },
        { status: 400 }
      );
    }

    if (recipients.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 emails par lot' },
        { status: 400 }
      );
    }

    const emails = recipients.map((r: { to: string; subject: string; body: string }) => ({
      to: r.to,
      subject: r.subject,
      html: r.body,
    }));

    const result = await sendBulkGmail(emails, delayMs || 3000);

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      results: result.results,
    });
  } catch (err) {
    console.error('[API email/send-bulk] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
