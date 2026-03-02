import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET - List activities for a prospect
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: activities, error } = await admin
      .from('prospect_activities')
      .select('id, activity_type, channel, subject, body, metadata, created_at')
      .eq('prospect_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[API Activities GET]', error);
      return NextResponse.json({ error: 'Erreur lecture activites' }, { status: 500 });
    }

    return NextResponse.json({ activities: activities || [] });
  } catch (err) {
    console.error('[API Activities GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 }
    );
  }
}

// POST - Add a manual activity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const body = await request.json();
    const { activity_type, channel, subject, body: actBody, metadata, created_at } = body;

    if (!activity_type) {
      return NextResponse.json({ error: 'activity_type requis' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get prospect's workspace_id
    const { data: prospect } = await admin
      .from('prospects')
      .select('workspace_id')
      .eq('id', id)
      .single();

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 });
    }

    const { data: activity, error } = await admin
      .from('prospect_activities')
      .insert({
        workspace_id: prospect.workspace_id,
        prospect_id: id,
        activity_type,
        channel: channel || 'manual',
        subject: subject || null,
        body: actBody || null,
        metadata: metadata || {},
        performed_by: user.id,
        created_at: created_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[API Activities POST]', error);
      return NextResponse.json({ error: 'Erreur creation activite' }, { status: 500 });
    }

    return NextResponse.json({ activity });
  } catch (err) {
    console.error('[API Activities POST]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 }
    );
  }
}
