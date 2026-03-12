import { SupabaseClient } from "@supabase/supabase-js";
import { classifyProspect, type OutreachBucket } from "@/lib/outreach-routing";
import { getNextSendTime } from "@/lib/email/scheduler";
import { HARD_BLOCKED_STATUSES, checkProspectContactability } from "@/lib/utils/contactability";

interface MissionRecord {
  id: string;
  campaign_email_id: string | null;
  campaign_linkedin_id: string | null;
  campaign_multichannel_id: string | null;
}

interface ProspectRecord {
  id: string;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
  status: string;
}

const BUCKET_TO_CAMPAIGN_KEY: Partial<Record<OutreachBucket, keyof Pick<MissionRecord, "campaign_email_id" | "campaign_linkedin_id" | "campaign_multichannel_id">>> = {
  email_only: "campaign_email_id",
  linkedin_only: "campaign_linkedin_id",
  email_linkedin: "campaign_multichannel_id",
};

/**
 * Enroll a prospect into the appropriate campaign of a mission
 * based on available contact data (email, linkedin, phone).
 */
export async function enrollProspectInMission(
  supabase: SupabaseClient,
  mission: MissionRecord,
  prospect: ProspectRecord
): Promise<{ enrolled: boolean; campaignId?: string; bucket: OutreachBucket }> {
  // Block hard-blocked statuses immediately
  if ((HARD_BLOCKED_STATUSES as readonly string[]).includes(prospect.status)) {
    return { enrolled: false, bucket: "incomplete" };
  }

  // Full contactability check (skip cooldown for mission auto-enrollment)
  const { contactable } = await checkProspectContactability(
    supabase,
    [prospect.id],
    { ignoreCooldown: true }
  );
  if (contactable.length === 0) {
    return { enrolled: false, bucket: "incomplete" };
  }

  const bucket = classifyProspect({
    email: prospect.email,
    linkedin_url: prospect.linkedin_url,
    phone: prospect.phone,
    status: prospect.status,
  });

  const campaignKey = BUCKET_TO_CAMPAIGN_KEY[bucket];
  if (!campaignKey) {
    return { enrolled: false, bucket };
  }

  const campaignId = mission[campaignKey];
  if (!campaignId) {
    return { enrolled: false, bucket };
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from("campaign_prospects")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("prospect_id", prospect.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { enrolled: false, bucket };
  }

  // Get campaign info and first step
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, timezone, sending_window_start, sending_window_end, sending_days")
    .eq("id", campaignId)
    .single();

  if (!campaign || campaign.status === "completed" || campaign.status === "archived") {
    return { enrolled: false, bucket };
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
    return { enrolled: false, bucket };
  }

  const nextSendAt = getNextSendTime(
    campaign.timezone || "Europe/Paris",
    campaign.sending_window_start || "08:00",
    campaign.sending_window_end || "18:00",
    campaign.sending_days || [1, 2, 3, 4, 5],
    firstStep.delay_days || 0,
    firstStep.delay_hours || 0
  );

  const prospectStatus = campaign.status === "active" ? "active" : "paused";

  const { error } = await supabase.from("campaign_prospects").insert({
    campaign_id: campaignId,
    prospect_id: prospect.id,
    current_step_id: firstStep.id,
    status: prospectStatus,
    next_send_at: nextSendAt.toISOString(),
  });

  if (error) {
    console.error("[Mission Enroll] Error enrolling prospect:", error);
    return { enrolled: false, bucket };
  }

  // Update campaign total_prospects
  const { count } = await supabase
    .from("campaign_prospects")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  await supabase
    .from("campaigns")
    .update({ total_prospects: count || 0 })
    .eq("id", campaignId);

  // Update mission total_enrolled
  const { data: missionData } = await supabase
    .from("outreach_missions")
    .select("total_enrolled")
    .eq("id", mission.id)
    .single();

  if (missionData) {
    await supabase
      .from("outreach_missions")
      .update({ total_enrolled: (missionData.total_enrolled || 0) + 1 })
      .eq("id", mission.id);
  }

  return { enrolled: true, campaignId, bucket };
}
