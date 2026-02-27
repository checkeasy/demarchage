import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: List all workspaces the user belongs to
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  // Get current workspace id
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  // Get all workspaces via workspace_members
  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, name, slug, plan)")
    .eq("user_id", user.id);

  if (error) {
    console.error("Workspaces API error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement", details: error.message, code: error.code },
      { status: 500 }
    );
  }

  const workspaces = (memberships || []).map((m) => {
    const ws = m.workspaces as unknown as {
      id: string;
      name: string;
      slug: string;
      plan: string;
    };
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      plan: ws.plan,
      role: m.role,
      isCurrent: ws.id === profile?.current_workspace_id,
    };
  });

  return NextResponse.json({ workspaces });
}

// POST: Create a new workspace
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { name } = await request.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Le nom est requis" },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();
  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({
      name: trimmedName,
      slug: `${slug}-${Date.now()}`,
      owner_id: user.id,
    })
    .select()
    .single();

  if (wsError) {
    return NextResponse.json(
      { error: "Erreur lors de la creation", details: wsError.message },
      { status: 500 }
    );
  }

  // Add user as owner in workspace_members
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    // Cleanup workspace if member creation fails
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    return NextResponse.json(
      { error: "Erreur lors de la creation", details: memberError.message },
      { status: 500 }
    );
  }

  // Switch to new workspace
  await supabase
    .from("profiles")
    .update({ current_workspace_id: workspace.id })
    .eq("id", user.id);

  return NextResponse.json({ workspace });
}
