import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/deals — List deals with optional filters and joins
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
  const stageId = searchParams.get("stage_id");
  const status = searchParams.get("status");
  const ownerId = searchParams.get("owner_id");
  const prospectId = searchParams.get("prospect_id");

  let query = supabase
    .from("deals")
    .select(
      `
      *,
      prospect:prospects(id, first_name, last_name, email, company),
      stage:pipeline_stages_config(id, name, color, slug)
    `
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (stageId) query = query.eq("stage_id", stageId);
  if (status) query = query.eq("status", status);
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (prospectId) query = query.eq("prospect_id", prospectId);

  const { data: deals, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors du chargement", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deals: deals || [] });
}

// POST /api/deals — Create a new deal
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

  const { title, value, stage_id, prospect_id, expected_close_date, probability } =
    await request.json();

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Le titre du deal est requis" },
      { status: 400 }
    );
  }

  if (!stage_id) {
    return NextResponse.json(
      { error: "L'etape du pipeline est requise" },
      { status: 400 }
    );
  }

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      workspace_id: workspaceId,
      title: title.trim(),
      value: value ?? 0,
      stage_id,
      prospect_id: prospect_id || null,
      expected_close_date: expected_close_date || null,
      probability: probability ?? null,
      created_by: user.id,
      owner_id: user.id,
      status: "open",
      stage_entered_at: new Date().toISOString(),
    })
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
      { error: "Erreur lors de la creation", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deal });
}
