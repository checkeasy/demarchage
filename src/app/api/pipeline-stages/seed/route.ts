import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/pipeline-stages/seed — Seed default pipeline stages via RPC
export async function POST() {
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

  // Call the RPC function to seed default stages
  const { data, error: rpcError } = await supabase.rpc(
    "seed_default_pipeline_stages",
    { p_workspace_id: workspaceId }
  );

  if (rpcError) {
    return NextResponse.json(
      { error: "Erreur lors du seeding", details: rpcError.message },
      { status: 500 }
    );
  }

  // Fetch the seeded stages to return them
  const { data: stages, error: fetchError } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("display_order", { ascending: true });

  if (fetchError) {
    return NextResponse.json(
      { error: "Erreur lors du chargement", details: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ stages: stages || [], rpc_result: data });
}
