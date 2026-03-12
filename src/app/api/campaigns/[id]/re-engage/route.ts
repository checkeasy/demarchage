import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProspectContactability } from "@/lib/utils/contactability";
import { getNextSendTime } from "@/lib/email/scheduler";

/**
 * POST /api/campaigns/[id]/re-engage
 * Re-enrolls prospects who completed the campaign sequence without replying.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Find all completed prospects who never replied
  const { data: completedProspects, error: cpError } = await admin
    .from("campaign_prospects")
    .select("id, prospect_id")
    .eq("campaign_id", campaignId)
    .eq("status", "completed")
    .eq("has_replied", false);

  if (cpError) {
    return NextResponse.json(
      { error: "Failed to fetch prospects", details: cpError.message },
      { status: 500 }
    );
  }

  if (!completedProspects || completedProspects.length === 0) {
    return NextResponse.json({
      message: "No completed prospects to re-engage",
      re_engaged: 0,
      blocked: 0,
    });
  }

  // 2. Check contactability for all of them
  const prospectIds = completedProspects.map((cp) => cp.prospect_id).filter(Boolean) as string[];
  const { contactable, blocked } = await checkProspectContactability(
    admin,
    prospectIds,
    { targetCampaignId: campaignId }
  );

  const contactableSet = new Set(contactable);

  // 3. Get the first step of the campaign
  const { data: firstStep } = await admin
    .from("sequence_steps")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .order("step_order", { ascending: true })
    .limit(1)
    .single();

  if (!firstStep) {
    return NextResponse.json(
      { error: "No active steps found in this campaign" },
      { status: 400 }
    );
  }

  // 4. Get campaign settings for scheduling
  const { data: campaign } = await admin
    .from("campaigns")
    .select("timezone, sending_window_start, sending_window_end, sending_days")
    .eq("id", campaignId)
    .single();

  const nextSendAt = getNextSendTime(
    campaign?.timezone || "Europe/Paris",
    campaign?.sending_window_start || "08:00",
    campaign?.sending_window_end || "18:00",
    campaign?.sending_days || [1, 2, 3, 4, 5],
    0,
    0
  );

  // 5. Re-enroll contactable prospects
  const reEngageIds = completedProspects
    .filter((cp) => cp.prospect_id && contactableSet.has(cp.prospect_id))
    .map((cp) => cp.id);

  let reEngagedCount = 0;

  if (reEngageIds.length > 0) {
    const { data: updated, error: updateError } = await admin
      .from("campaign_prospects")
      .update({
        status: "active",
        status_reason: "Re-engagement",
        current_step_id: firstStep.id,
        next_send_at: nextSendAt.toISOString(),
        completed_at: null,
      })
      .in("id", reEngageIds)
      .select("id");

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to re-engage prospects", details: updateError.message },
        { status: 500 }
      );
    }

    reEngagedCount = updated?.length || 0;
  }

  return NextResponse.json({
    message: `${reEngagedCount} prospect(s) re-engaged`,
    re_engaged: reEngagedCount,
    blocked: blocked.length,
    blocked_details: blocked.map((b) => ({
      prospectId: b.prospectId,
      reasons: b.reasons,
    })),
  });
}
