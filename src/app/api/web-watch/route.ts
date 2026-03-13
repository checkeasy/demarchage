import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/web-watch — List watches and recent results
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const workspaceId = profile.current_workspace_id;

  // Get watches
  const { data: watches } = await admin
    .from("web_watches")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  // Get recent results (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: results } = await admin
    .from("web_watch_results")
    .select("*, web_watches!inner(topic)")
    .eq("workspace_id", workspaceId)
    .gte("detected_at", sevenDaysAgo.toISOString())
    .order("detected_at", { ascending: false })
    .limit(50);

  // Unread count
  const { count: unreadCount } = await admin
    .from("web_watch_results")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("is_read", false);

  return NextResponse.json({ watches: watches || [], results: results || [], unread_count: unreadCount || 0 });
}

// POST /api/web-watch — Create a new watch topic
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const body = await request.json();
  const { topic, keywords } = body;

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  const { data: watch, error } = await admin
    .from("web_watches")
    .insert({
      workspace_id: profile.current_workspace_id,
      topic,
      keywords: keywords || [],
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ watch });
}

// DELETE /api/web-watch — Delete a watch
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const body = await request.json();
  const { watch_id } = body;

  if (!watch_id) {
    return NextResponse.json({ error: "watch_id is required" }, { status: 400 });
  }

  await admin
    .from("web_watch_results")
    .delete()
    .eq("watch_id", watch_id);

  const { error } = await admin
    .from("web_watches")
    .delete()
    .eq("id", watch_id)
    .eq("workspace_id", profile.current_workspace_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
