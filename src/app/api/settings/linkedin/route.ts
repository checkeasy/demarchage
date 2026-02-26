import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { LinkedInClient } from '@/lib/linkedin/client';

function maskValue(value: string): string {
  if (!value || value.length < 10) return '***';
  return value.slice(0, 6) + '...' + value.slice(-4);
}

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

  const admin = createAdminClient();
  const { data: workspace } = await admin
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();

  const settings = (workspace?.settings || {}) as Record<string, unknown>;
  const liAt = (settings.linkedin_li_at as string) || '';
  const jsessionId = (settings.linkedin_jsessionid as string) || '';

  return NextResponse.json({
    configured: !!(liAt && jsessionId),
    li_at_masked: liAt ? maskValue(liAt) : '',
    jsessionid_masked: jsessionId ? maskValue(jsessionId) : '',
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) {
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

  // Save cookies
  const liAt = body.li_at as string;
  const jsessionId = body.jsessionid as string;

  if (!liAt || !jsessionId) {
    return NextResponse.json({ error: 'Les deux cookies sont requis' }, { status: 400 });
  }

  // Get current settings to merge
  const { data: workspace } = await admin
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();

  const currentSettings = (workspace?.settings || {}) as Record<string, unknown>;

  const { error } = await admin
    .from('workspaces')
    .update({
      settings: {
        ...currentSettings,
        linkedin_li_at: liAt,
        linkedin_jsessionid: jsessionId,
      },
    })
    .eq('id', workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
