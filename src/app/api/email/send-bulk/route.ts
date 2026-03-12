import { NextRequest, NextResponse } from 'next/server';
import { sendBulkGmail } from '@/lib/email/gmail-sender';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    // Get workspace
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient.from('profiles').select('current_workspace_id').eq('id', user.id).single();
    if (!profile?.current_workspace_id) {
      return NextResponse.json({ error: 'No workspace' }, { status: 403 });
    }

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

    // Validate each recipient
    for (const r of recipients) {
      if (typeof r.to !== 'string' || typeof r.subject !== 'string' || typeof r.body !== 'string') {
        return NextResponse.json(
          { error: 'Chaque recipient doit avoir to, subject et body comme chaines de caracteres' },
          { status: 400 }
        );
      }
      if (!emailRegex.test(r.to)) {
        return NextResponse.json(
          { error: `Adresse email invalide: ${r.to}` },
          { status: 400 }
        );
      }
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
