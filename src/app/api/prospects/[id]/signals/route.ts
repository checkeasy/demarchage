import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCompositeScore } from "@/lib/scoring/multi-signal-scorer";

// GET /api/prospects/[id]/signals — List signals for a prospect
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { data: signals, error } = await admin
    .from("prospect_signals")
    .select("*")
    .eq("prospect_id", id)
    .eq("workspace_id", profile.current_workspace_id)
    .order("detected_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signals });
}

// POST /api/prospects/[id]/signals — Add a signal to a prospect
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const { signal_type, title, description, signal_score, signal_source, signal_data, expires_at } = body;

  if (!signal_type || !title) {
    return NextResponse.json({ error: "signal_type and title are required" }, { status: 400 });
  }

  const { data: signal, error } = await admin
    .from("prospect_signals")
    .insert({
      workspace_id: profile.current_workspace_id,
      prospect_id: id,
      signal_type,
      title,
      description: description || null,
      signal_score: signal_score || 10,
      signal_source: signal_source || "manual",
      signal_data: signal_data || {},
      expires_at: expires_at || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update prospect's lead_score based on total signal score
  await updateProspectSignalScore(admin, id, profile.current_workspace_id);

  return NextResponse.json({ signal });
}

// DELETE /api/prospects/[id]/signals — Delete a signal (pass signal_id in body)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const { signal_id } = body;

  if (!signal_id) {
    return NextResponse.json({ error: "signal_id is required" }, { status: 400 });
  }

  const { error } = await admin
    .from("prospect_signals")
    .delete()
    .eq("id", signal_id)
    .eq("prospect_id", id)
    .eq("workspace_id", profile.current_workspace_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await updateProspectSignalScore(admin, id, profile.current_workspace_id);

  return NextResponse.json({ success: true });
}

// Helper: recalculate prospect lead_score boost from signals using multi-signal scorer
async function updateProspectSignalScore(
  supabase: ReturnType<typeof createAdminClient>,
  prospectId: string,
  workspaceId: string
) {
  const { data: signals } = await supabase
    .from("prospect_signals")
    .select("signal_type, signal_score, is_active, expires_at, detected_at, created_at")
    .eq("prospect_id", prospectId)
    .eq("workspace_id", workspaceId);

  // Get current base lead_score (without signal boost)
  const { data: prospect } = await supabase
    .from("prospects")
    .select("lead_score, custom_fields")
    .eq("id", prospectId)
    .single();

  if (prospect) {
    const cf = (prospect.custom_fields || {}) as Record<string, unknown>;
    const baseScore = (cf.base_lead_score as number) ?? prospect.lead_score ?? 0;

    const { score, signalBoost, breakdown } = calculateCompositeScore(
      baseScore,
      (signals || []) as Array<{
        signal_type: string;
        signal_score: number;
        is_active: boolean;
        expires_at: string | null;
        detected_at?: string;
        created_at?: string;
      }>
    );

    await supabase
      .from("prospects")
      .update({
        lead_score: score,
        custom_fields: {
          ...cf,
          base_lead_score: baseScore,
          signal_boost: signalBoost,
          signal_breakdown: breakdown,
        },
      })
      .eq("id", prospectId);
  }
}
