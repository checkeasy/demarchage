import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/pipeline-stages/[id] — Update stage
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

  if (body.name !== undefined) updates.name = body.name;
  if (body.color !== undefined) updates.color = body.color;
  if (body.display_order !== undefined) updates.display_order = body.display_order;
  if (body.is_won !== undefined) updates.is_won = body.is_won;
  if (body.is_lost !== undefined) updates.is_lost = body.is_lost;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Aucun champ a mettre a jour" },
      { status: 400 }
    );
  }

  const { data: stage, error } = await supabase
    .from("pipeline_stages")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la mise a jour", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ stage });
}

// DELETE /api/pipeline-stages/[id] — Delete stage (check no deals reference it first)
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

  // Check if any deals reference this stage
  const { count, error: countError } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id);

  if (countError) {
    return NextResponse.json(
      { error: "Erreur lors de la verification", details: countError.message },
      { status: 500 }
    );
  }

  if (count && count > 0) {
    return NextResponse.json(
      {
        error: `Impossible de supprimer cette etape : ${count} deal(s) y sont associes`,
      },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("pipeline_stages")
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
