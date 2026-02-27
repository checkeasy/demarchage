import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: Create a new campaign
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
    return NextResponse.json({ error: "Aucun workspace actif" }, { status: 400 });
  }

  const { name, description } = await request.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      name: name.trim(),
      description: description || null,
      status: "draft",
      created_by: user.id,
    })
    .select("id, name, status")
    .single();

  if (error) {
    console.error("Campaign create error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la creation", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ campaign });
}
