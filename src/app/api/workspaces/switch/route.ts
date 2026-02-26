import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { workspaceId } = await request.json();

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId est requis" },
      { status: 400 }
    );
  }

  // Verify user is a member of this workspace
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Vous n'etes pas membre de cet espace" },
      { status: 403 }
    );
  }

  // Update current workspace
  const { error } = await supabase
    .from("profiles")
    .update({ current_workspace_id: workspaceId })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors du changement" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, workspaceId });
}
