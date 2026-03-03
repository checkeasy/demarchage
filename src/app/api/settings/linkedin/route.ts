import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { LinkedInClient } from '@/lib/linkedin/client';

function maskValue(value: string): string {
  if (!value || value.length < 10) return '***';
  return value.slice(0, 6) + '...' + value.slice(-4);
}

async function getUserAndWorkspace(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_workspace_id) return null;

  return { userId: user.id, workspaceId: profile.current_workspace_id };
}

export async function GET() {
  const supabase = await createClient();
  const ctx = await getUserAndWorkspace(supabase);
  if (!ctx) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Lire depuis linkedin_accounts filtre par user_id
  const { data: account } = await admin
    .from('linkedin_accounts')
    .select('li_at_cookie, jsessionid_cookie')
    .eq('user_id', ctx.userId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('is_active', true)
    .limit(1)
    .single();

  const liAt = account?.li_at_cookie || '';
  const jsessionId = account?.jsessionid_cookie || '';

  return NextResponse.json({
    configured: !!(liAt && jsessionId),
    li_at_masked: liAt ? maskValue(liAt) : '',
    jsessionid_masked: jsessionId ? maskValue(jsessionId) : '',
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const ctx = await getUserAndWorkspace(supabase);
  if (!ctx) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const body = await request.json();
  const admin = createAdminClient();

  // Test connection
  if (body.action === 'test') {
    const liAt = body.li_at as string;
    const jsessionId = body.jsessionid as string;

    if (!liAt || !jsessionId) {
      return NextResponse.json({
        success: false,
        status: 'missing',
        message: 'Les deux cookies sont requis',
      });
    }

    try {
      const client = new LinkedInClient({ liAt, jsessionId });
      const result = await client.searchPeople({ keywords: 'test', count: 1 });

      return NextResponse.json({
        success: true,
        status: 'connected',
        message: `Connexion reussie (${result.total} resultats trouves)`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      const isExpired = message.includes('expir') || message.includes('session') || message.includes('401') || message.includes('403');

      return NextResponse.json({
        success: false,
        status: isExpired ? 'expired' : 'error',
        message,
      });
    }
  }

  // Save cookies → linkedin_accounts per user
  const liAt = body.li_at as string;
  const jsessionId = body.jsessionid as string;

  if (!liAt || !jsessionId) {
    return NextResponse.json({ error: 'Les deux cookies sont requis' }, { status: 400 });
  }

  // Check if user already has a linkedin account for this workspace
  const { data: existing } = await admin
    .from('linkedin_accounts')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('workspace_id', ctx.workspaceId)
    .limit(1)
    .single();

  if (existing) {
    // Update existing
    const { error } = await admin
      .from('linkedin_accounts')
      .update({
        li_at_cookie: liAt,
        jsessionid_cookie: jsessionId,
        session_valid: true,
        session_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Insert new
    const { error } = await admin
      .from('linkedin_accounts')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        name: 'Compte principal',
        li_at_cookie: liAt,
        jsessionid_cookie: jsessionId,
        session_valid: true,
        session_checked_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
