import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Verify campaign exists and belongs to user's workspace
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "Workspace introuvable" }, { status: 400 });
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, workspace_id")
    .eq("id", id)
    .eq("workspace_id", profile.current_workspace_id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  // Delete — cascades handle sequence_steps, campaign_prospects, emails_sent
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la suppression", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
