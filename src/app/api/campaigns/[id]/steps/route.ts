import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PUT /api/campaigns/[id]/steps — Save sequence steps for a campaign
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  try {
    // Verify campaign exists and belongs to user's workspace
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", user.id)
      .single();

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, workspace_id")
      .eq("id", campaignId)
      .single();

    if (!campaign || campaign.workspace_id !== profile?.current_workspace_id) {
      return NextResponse.json({ error: "Campagne non trouvee" }, { status: 404 });
    }

    const { steps } = await request.json();

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: "Aucune etape fournie" }, { status: 400 });
    }

    // Delete existing steps for this campaign
    await supabase
      .from("sequence_steps")
      .delete()
      .eq("campaign_id", campaignId);

    // Insert new steps
    const stepsToInsert = steps.map((step: Record<string, unknown>, index: number) => ({
      campaign_id: campaignId,
      step_order: step.step_order || index + 1,
      step_type: step.step_type || "email",
      subject: step.subject || null,
      body_html: step.body_html || null,
      body_text: step.body_text || null,
      delay_days: step.delay_days || 0,
      delay_hours: step.delay_hours || 0,
      is_active: true,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("sequence_steps")
      .insert(stepsToInsert)
      .select("id, step_order, step_type");

    if (insertError) {
      console.error("[Campaign] Steps save error:", insertError);
      return NextResponse.json(
        { error: "Erreur sauvegarde des etapes", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, steps: inserted });
  } catch (err) {
    console.error("[Campaign] Steps error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
