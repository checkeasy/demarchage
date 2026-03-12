import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendGmail } from '@/lib/email/gmail-sender';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      );
    }

    // Get workspace
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient.from('profiles').select('current_workspace_id').eq('id', user.id).single();
    if (!profile?.current_workspace_id) {
      return NextResponse.json({ error: 'No workspace' }, { status: 403 });
    }
    const workspaceId = profile.current_workspace_id;

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

    // If an email_account_id is provided, look up the from address (with workspace isolation)
    let fromEmail: string | undefined;
    if (email_account_id) {
      const { data: account } = await adminClient
        .from('email_accounts')
        .select('email_address, display_name')
        .eq('id', email_account_id)
        .eq('workspace_id', workspaceId)
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
