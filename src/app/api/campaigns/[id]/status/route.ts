import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { status } = await request.json();

  const validTransitions: Record<string, string[]> = {
    draft: ["active"],
    active: ["paused"],
    paused: ["active"],
  };

  // Get current campaign
  const { data: campaign, error: fetchError } = await supabase
    .from("campaigns")
    .select("status, workspace_id")
    .eq("id", id)
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

  const { error: updateError } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Erreur lors de la mise a jour", details: updateError.message },
      { status: 500 }
    );
  }

  // If launching campaign (draft → active), also activate all campaign_prospects
  if (campaign.status === "draft" && status === "active") {
    await supabase
      .from("campaign_prospects")
      .update({ status: "active" })
      .eq("campaign_id", id)
      .eq("status", "pending");
  }

  return NextResponse.json({ success: true, status });
}
