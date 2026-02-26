import { SupabaseClient } from "@supabase/supabase-js";

export interface ProspectConflicts {
  activeCampaigns: {
    id: string;
    name: string;
    status: string;
  }[];
  activeAutomations: {
    id: string;
    name: string;
    status: string;
  }[];
  lastContactedAt: string | null;
  hasConflict: boolean;
}

/**
 * Check if a prospect is enrolled in active campaigns and/or automations.
 * Returns conflict information for UI display.
 */
export async function checkProspectConflicts(
  supabase: SupabaseClient,
  prospectId: string
): Promise<ProspectConflicts> {
  // Fetch active campaign enrollments
  const { data: campaignEnrollments } = await supabase
    .from("campaign_prospects")
    .select("campaign_id, status, campaigns(id, name, status)")
    .eq("prospect_id", prospectId)
    .in("status", ["active", "paused"]);

  // Fetch active automation enrollments
  const { data: automationEnrollments } = await supabase
    .from("automation_prospects")
    .select("sequence_id, status, automation_sequences(id, name, status)")
    .eq("prospect_id", prospectId)
    .in("status", ["active", "paused", "pending"]);

  // Get last contact time
  const { data: prospect } = await supabase
    .from("prospects")
    .select("last_contacted_at")
    .eq("id", prospectId)
    .single();

  const activeCampaigns = (campaignEnrollments || [])
    .filter((e) => e.campaigns)
    .map((e) => {
      const c = e.campaigns as unknown as { id: string; name: string; status: string };
      return { id: c.id, name: c.name, status: e.status };
    });

  const activeAutomations = (automationEnrollments || [])
    .filter((e) => e.automation_sequences)
    .map((e) => {
      const s = e.automation_sequences as unknown as { id: string; name: string; status: string };
      return { id: s.id, name: s.name, status: e.status };
    });

  return {
    activeCampaigns,
    activeAutomations,
    lastContactedAt: prospect?.last_contacted_at || null,
    hasConflict: activeCampaigns.length > 0 && activeAutomations.length > 0,
  };
}
