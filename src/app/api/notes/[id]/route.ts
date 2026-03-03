import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/notes/[id] — Update note content or toggle pin
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

  if (body.content !== undefined) updates.content = body.content;
  if (body.is_pinned !== undefined) updates.is_pinned = body.is_pinned;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Aucun champ a mettre a jour" },
      { status: 400 }
    );
  }

  const { data: note, error } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la mise a jour", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ note });
}

// DELETE /api/notes/[id] — Delete note
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
    .from("notes")
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
