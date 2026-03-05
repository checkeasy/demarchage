import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNextSendTime } from "@/lib/email/scheduler";

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

    // Use admin client to bypass RLS for FK nullification
    const adminSupabase = createAdminClient();

    // Nullify current_step_id on campaign_prospects (FK blocks delete otherwise)
    await adminSupabase
      .from("campaign_prospects")
      .update({ current_step_id: null })
      .eq("campaign_id", campaignId);

    // Nullify step_id on emails_sent
    const { data: cpIds } = await adminSupabase
      .from("campaign_prospects")
      .select("id")
      .eq("campaign_id", campaignId);

    if (cpIds && cpIds.length > 0) {
      await adminSupabase
        .from("emails_sent")
        .update({ step_id: null })
        .in("campaign_prospect_id", cpIds.map((cp: { id: string }) => cp.id));
    }

    // Delete existing steps for this campaign
    await adminSupabase
      .from("sequence_steps")
      .delete()
      .eq("campaign_id", campaignId);

    // Insert new steps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stepsToInsert = steps.map((step: any, index: number) => ({
      campaign_id: campaignId,
      step_order: step.step_order || index + 1,
      step_type: step.step_type || "email",
      subject: step.subject || null,
      body_html: step.body_html || null,
      body_text: step.body_text || null,
      delay_days: step.delay_days || 0,
      delay_hours: step.delay_hours || 0,
      ab_enabled: step.ab_enabled || false,
      use_ai_generation: step.use_ai_generation || false,
      ai_prompt_context: step.ai_prompt_context || null,
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

    // Save A/B variants if any steps have them
    if (inserted) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.ab_enabled && step.ab_variants?.length > 0) {
          const insertedStep = inserted.find(
            (is: { step_order: number }) => is.step_order === (step.step_order || i + 1)
          );
          if (insertedStep) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const variantsToInsert = step.ab_variants.map((v: any) => ({
              step_id: insertedStep.id,
              variant_label: v.variant_label || "A",
              subject: v.subject || null,
              body_html: v.body_html || null,
              body_text: v.body_text || null,
              weight: v.weight ?? 50,
            }));
            await supabase.from("ab_variants").insert(variantsToInsert);
          }
        }
      }

      // Reassign active prospects with null current_step_id to step 1
      const firstStep = inserted.find((s: { step_order: number }) => s.step_order === 1);
      if (firstStep) {
        const { data: campaignData } = await adminSupabase
          .from("campaigns")
          .select("timezone, sending_window_start, sending_window_end, sending_days")
          .eq("id", campaignId)
          .single();

        const nextSendAt = campaignData
          ? getNextSendTime(
              campaignData.timezone || "Europe/Paris",
              campaignData.sending_window_start || "08:00",
              campaignData.sending_window_end || "18:00",
              campaignData.sending_days || [1, 2, 3, 4, 5],
              0, 0
            )
          : new Date();

        await adminSupabase
          .from("campaign_prospects")
          .update({
            current_step_id: firstStep.id,
            next_send_at: nextSendAt.toISOString(),
          })
          .eq("campaign_id", campaignId)
          .eq("status", "active")
          .is("current_step_id", null);
      }
    }

    return NextResponse.json({ success: true, steps: inserted });
  } catch (err) {
    console.error("[Campaign] Steps error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
