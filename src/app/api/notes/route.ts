import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/notes — List notes filtered by deal_id or prospect_id, pinned first
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const dealId = searchParams.get("deal_id");
  const prospectId = searchParams.get("prospect_id");

  if (!dealId && !prospectId) {
    return NextResponse.json(
      { error: "deal_id ou prospect_id est requis" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("notes")
    .select(
      `
      *,
      author:profiles!notes_created_by_fkey(id, full_name)
    `
    )
    .eq("workspace_id", workspaceId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (dealId) query = query.eq("deal_id", dealId);
  if (prospectId) query = query.eq("prospect_id", prospectId);

  const { data: notes, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors du chargement", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ notes: notes || [] });
}

// POST /api/notes — Create a note
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

  const { content, deal_id, prospect_id, is_pinned } = await request.json();

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "Le contenu de la note est requis" },
      { status: 400 }
    );
  }

  if (!deal_id && !prospect_id) {
    return NextResponse.json(
      { error: "deal_id ou prospect_id est requis" },
      { status: 400 }
    );
  }

  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: workspaceId,
      content: content.trim(),
      deal_id: deal_id || null,
      prospect_id: prospect_id || null,
      is_pinned: is_pinned ?? false,
      created_by: user.id,
    })
    .select(
      `
      *,
      author:profiles!notes_created_by_fkey(id, full_name)
    `
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la creation", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ note });
}
