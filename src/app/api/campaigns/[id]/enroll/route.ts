import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNextSendTime } from "@/lib/email/scheduler";
import { checkProspectContactability } from "@/lib/utils/contactability";

// POST /api/campaigns/[id]/enroll — Add prospects to a campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  // Auth check
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get workspace
  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single();
  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }
  const workspaceId = profile.current_workspace_id;

  try {
    const body = await request.json();
    const { prospectIds } = body;

    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: "Aucun prospect fourni" }, { status: 400 });
    }

    // Get campaign and its first step (with workspace isolation)
    const { data: campaign, error: campError } = await supabase
      .from("campaigns")
      .select("id, status, timezone, sending_window_start, sending_window_end, sending_days")
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: "Campagne non trouvee" }, { status: 404 });
    }

    if (campaign.status === "completed" || campaign.status === "archived") {
      return NextResponse.json({ error: "Cette campagne est terminee" }, { status: 400 });
    }

    const { data: firstStep } = await supabase
      .from("sequence_steps")
      .select("id, delay_days, delay_hours")
      .eq("campaign_id", campaignId)
      .eq("is_active", true)
      .order("step_order", { ascending: true })
      .limit(1)
      .single();

    if (!firstStep) {
      return NextResponse.json({ error: "Aucune etape dans la campagne" }, { status: 400 });
    }

    // Check for already enrolled prospects
    const { data: alreadyEnrolled } = await supabase
      .from("campaign_prospects")
      .select("prospect_id")
      .eq("campaign_id", campaignId)
      .in("prospect_id", prospectIds);

    const enrolledIds = new Set((alreadyEnrolled || []).map((e) => e.prospect_id));

    // Filter out already enrolled, then check contactability
    const candidateIds = prospectIds.filter((id: string) => !enrolledIds.has(id));

    const { contactable, blocked } = await checkProspectContactability(
      supabase,
      candidateIds,
      { targetCampaignId: campaignId }
    );

    const contactableSet = new Set(contactable);

    // Calculate first send time
    const nextSendAt = getNextSendTime(
      campaign.timezone || "Europe/Paris",
      campaign.sending_window_start || "08:00",
      campaign.sending_window_end || "18:00",
      campaign.sending_days || [1, 2, 3, 4, 5],
      firstStep.delay_days || 0,
      firstStep.delay_hours || 0
    );

    // Determine status based on campaign status
    const prospectStatus = campaign.status === "active" ? "active" : "paused";

    // Enroll only contactable prospects
    const enrollments = prospectIds
      .filter((id: string) => !enrolledIds.has(id) && contactableSet.has(id))
      .map((prospectId: string) => ({
        campaign_id: campaignId,
        prospect_id: prospectId,
        current_step_id: firstStep.id,
        status: prospectStatus,
        next_send_at: nextSendAt.toISOString(),
      }));

    if (enrollments.length === 0) {
      return NextResponse.json({
        success: true,
        enrolled: 0,
        message: "Tous les prospects sont deja inscrits",
      });
    }

    const { error: enrollError } = await supabase
      .from("campaign_prospects")
      .insert(enrollments);

    if (enrollError) {
      console.error("[Campaign] Enroll error:", enrollError);
      return NextResponse.json({ error: enrollError.message }, { status: 500 });
    }

    // Update campaign total prospects count
    const { count: totalCount } = await supabase
      .from("campaign_prospects")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    await supabase
      .from("campaigns")
      .update({ total_prospects: totalCount || 0 })
      .eq("id", campaignId);

    return NextResponse.json({
      success: true,
      enrolled: enrollments.length,
      skipped: prospectIds.length - enrollments.length,
      blocked: blocked.length > 0 ? blocked : undefined,
    });
  } catch (err) {
    console.error("[Campaign] Enroll error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
