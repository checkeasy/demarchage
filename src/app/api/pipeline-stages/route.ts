import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/pipeline-stages — List stages for workspace, ordered by display_order
export async function GET() {
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

  const { data: stages, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors du chargement", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ stages: stages || [] });
}

// POST /api/pipeline-stages — Create a new stage
export async function POST(request: NextRequest) {
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

  const { name, slug, color, display_order, is_won, is_lost } =
    await request.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Le nom de l'etape est requis" },
      { status: 400 }
    );
  }

  const { data: stage, error } = await supabase
    .from("pipeline_stages")
    .insert({
      workspace_id: workspaceId,
      name: name.trim(),
      slug: slug || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      color: color || "#6B7280",
      display_order: display_order ?? 0,
      is_won: is_won ?? false,
      is_lost: is_lost ?? false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la creation", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ stage });
}
