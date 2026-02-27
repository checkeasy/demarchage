import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/deals/[id]/move — Move deal to new stage (Kanban drag operation)
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

  const { stage_id } = await request.json();

  if (!stage_id) {
    return NextResponse.json(
      { error: "L'identifiant de l'etape est requis" },
      { status: 400 }
    );
  }

  // Verify the target stage belongs to the workspace
  const { data: stage, error: stageError } = await supabase
    .from("pipeline_stages_config")
    .select("id, is_won, is_lost")
    .eq("id", stage_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (stageError || !stage) {
    return NextResponse.json(
      { error: "Etape introuvable dans ce workspace" },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {
    stage_id,
    stage_entered_at: new Date().toISOString(),
  };

  // Auto-update status based on stage flags
  if (stage.is_won) {
    updates.status = "won";
    updates.won_at = new Date().toISOString();
  } else if (stage.is_lost) {
    updates.status = "lost";
    updates.lost_at = new Date().toISOString();
  }

  const { data: deal, error } = await supabase
    .from("deals")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(
      `
      *,
      prospect:prospects(id, first_name, last_name, email, company),
      stage:pipeline_stages_config(id, name, color, slug)
    `
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors du deplacement", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deal });
}
