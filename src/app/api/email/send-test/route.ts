import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendGmail } from '@/lib/email/gmail-sender';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      );
    }

    const { to, subject, body_text, body_html, email_account_id } =
      await request.json();

    if (!to || !subject) {
      return NextResponse.json(
        { error: 'to et subject sont requis' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Adresse email invalide' },
        { status: 400 }
      );
    }

    // If an email_account_id is provided, look up the from address
    let fromEmail: string | undefined;
    if (email_account_id) {
      const { data: account } = await supabase
        .from('email_accounts')
        .select('email_address, display_name')
        .eq('id', email_account_id)
        .single();

      if (account) {
        fromEmail = account.display_name
          ? `${account.display_name} <${account.email_address}>`
          : account.email_address;
      }
    }

    const html = body_html || `<p>${(body_text || '').replace(/\n/g, '</p><p>')}</p>`;
    const text = body_text || html.replace(/<[^>]*>/g, '');

    const result = await sendGmail({
      to,
      subject,
      html,
      text,
      from: fromEmail,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erreur lors de l'envoi" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('[API email/send-test] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
