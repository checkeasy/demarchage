import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEAL_SELECT = `
  *,
  prospect:prospects(id, first_name, last_name, email, company),
  stage:pipeline_stages(id, name, color, slug),
  owner:profiles!deals_owner_id_fkey(id, full_name)
`;

// GET /api/deals/[id] — Single deal with all joins
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "Pas de workspace" }, { status: 400 });
  }

  const { data: deal, error } = await supabase
    .from("deals")
    .select(DEAL_SELECT)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !deal) {
    return NextResponse.json(
      { error: "Deal introuvable" },
      { status: 404 }
    );
  }

  return NextResponse.json({ deal });
}

// PATCH /api/deals/[id] — Update deal fields with special status handling
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "Pas de workspace" }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Copy over allowed fields
  if (body.title !== undefined) updates.title = body.title;
  if (body.value !== undefined) updates.value = body.value;
  if (body.prospect_id !== undefined) updates.prospect_id = body.prospect_id;
  if (body.owner_id !== undefined) updates.owner_id = body.owner_id;
  if (body.expected_close_date !== undefined) updates.expected_close_date = body.expected_close_date;
  if (body.probability !== undefined) updates.probability = body.probability;
  if (body.loss_reason !== undefined) updates.loss_reason = body.loss_reason;

  // Handle stage change
  if (body.stage_id !== undefined) {
    updates.stage_id = body.stage_id;
    updates.stage_entered_at = new Date().toISOString();
  }

  // Handle status transitions
  if (body.status !== undefined) {
    updates.status = body.status;

    if (body.status === "won") {
      updates.won_at = new Date().toISOString();
    } else if (body.status === "lost") {
      updates.lost_at = new Date().toISOString();
      if (body.loss_reason) {
        updates.loss_reason = body.loss_reason;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Aucun champ a mettre a jour" },
      { status: 400 }
    );
  }

  const { data: deal, error } = await supabase
    .from("deals")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(DEAL_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la mise a jour", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deal });
}

// DELETE /api/deals/[id] — Delete deal
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "Pas de workspace" }, { status: 400 });
  }

  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la suppression", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
