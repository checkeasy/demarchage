import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/activities/[id] — Update activity, auto-set done_at when marking done
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

  if (body.activity_type !== undefined) updates.activity_type = body.activity_type;
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.deal_id !== undefined) updates.deal_id = body.deal_id;
  if (body.prospect_id !== undefined) updates.prospect_id = body.prospect_id;
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;

  // Handle is_done with auto done_at timestamp
  if (body.is_done !== undefined) {
    updates.is_done = body.is_done;
    if (body.is_done === true) {
      updates.done_at = new Date().toISOString();
    } else {
      updates.done_at = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Aucun champ a mettre a jour" },
      { status: 400 }
    );
  }

  const { data: activity, error } = await supabase
    .from("activities")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(
      `
      *,
      deal:deals(id, title),
      prospect:prospects(id, first_name, last_name, email),
      assignee:profiles!activities_assigned_to_fkey(id, full_name)
    `
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la mise a jour", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ activity });
}

// DELETE /api/activities/[id] — Delete activity
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
    .from("activities")
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
