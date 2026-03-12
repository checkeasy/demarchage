import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = ["draft", "active", "paused", "completed", "archived"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Get workspace
  const { data: profile } = await adminClient.from('profiles').select('current_workspace_id').eq('id', user.id).single();
  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }
  const workspaceId = profile.current_workspace_id;

  const { status } = await request.json();

  // Validate status input
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Status invalide. Valeurs autorisees: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const validTransitions: Record<string, string[]> = {
    draft: ["active"],
    active: ["paused", "completed"],
    paused: ["active", "completed", "archived"],
    completed: ["archived"],
  };

  // Get current campaign with workspace isolation
  const { data: campaign, error: fetchError } = await adminClient
    .from("campaigns")
    .select("status, workspace_id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (fetchError || !campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const allowed = validTransitions[campaign.status];
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json(
      { error: `Transition de "${campaign.status}" vers "${status}" non autorisee` },
      { status: 400 }
    );
  }

  const { error: updateError } = await adminClient
    .from("campaigns")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (updateError) {
    return NextResponse.json(
      { error: "Erreur lors de la mise a jour", details: updateError.message },
      { status: 500 }
    );
  }

  // When activating campaign, also activate all non-completed campaign_prospects
  if (status === "active") {
    const { error: cascadeError } = await adminClient
      .from("campaign_prospects")
      .update({ status: "active" })
      .eq("campaign_id", id)
      .in("status", ["pending", "paused"]);

    if (cascadeError) {
      console.error("[Campaign Status] Error activating campaign_prospects:", cascadeError);
    }
  }

  // When pausing campaign, pause all active campaign_prospects
  if (status === "paused") {
    const { error: cascadeError } = await adminClient
      .from("campaign_prospects")
      .update({ status: "paused" })
      .eq("campaign_id", id)
      .eq("status", "active");

    if (cascadeError) {
      console.error("[Campaign Status] Error pausing campaign_prospects:", cascadeError);
    }
  }

  return NextResponse.json({ success: true, status });
}
