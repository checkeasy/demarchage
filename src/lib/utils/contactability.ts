import { SupabaseClient } from "@supabase/supabase-js";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Statuses that absolutely block any outreach (hard stop) */
export const HARD_BLOCKED_STATUSES = ["bounced", "unsubscribed"] as const;

/** Statuses that are protected from being overwritten by imports */
export const PROTECTED_STATUSES = [
  "bounced",
  "unsubscribed",
  "replied",
  "converted",
] as const;

/** Cooldown period: don't re-contact within this many days */
const COOLDOWN_DAYS = 14;

// ─── Types ───────────────────────────────────────────────────────────────────

export type BlockReason =
  | "status_bounced"
  | "status_unsubscribed"
  | "status_replied"
  | "status_converted"
  | "active_campaign"
  | "recently_contacted";

interface ContactabilityOptions {
  /** Skip the cooldown check (e.g. for mission auto-enrollment) */
  ignoreCooldown?: boolean;
  /** Campaign we're enrolling into — exclude from "active campaign" check */
  targetCampaignId?: string;
}

interface ContactabilityResult {
  contactable: string[];
  blocked: Array<{ prospectId: string; reasons: BlockReason[] }>;
}

// ─── Main Check ──────────────────────────────────────────────────────────────

/**
 * Check which prospects can be contacted. Returns contactable IDs and
 * blocked IDs with reasons.
 */
export async function checkProspectContactability(
  supabase: SupabaseClient,
  prospectIds: string[],
  options?: ContactabilityOptions
): Promise<ContactabilityResult> {
  if (prospectIds.length === 0) {
    return { contactable: [], blocked: [] };
  }

  // Query 1: prospect status + last_contacted_at
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, status, last_contacted_at")
    .in("id", prospectIds);

  // Query 2: active/paused campaign enrollments
  let campaignQuery = supabase
    .from("campaign_prospects")
    .select("prospect_id, campaign_id, status")
    .in("prospect_id", prospectIds)
    .in("status", ["active", "paused"]);

  if (options?.targetCampaignId) {
    campaignQuery = campaignQuery.neq("campaign_id", options.targetCampaignId);
  }

  const { data: activeCampaigns } = await campaignQuery;

  // Build lookup maps
  const prospectMap = new Map(
    (prospects || []).map((p) => [p.id, p])
  );
  const activeCampaignSet = new Set(
    (activeCampaigns || []).map((c) => c.prospect_id)
  );

  const now = Date.now();
  const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  const contactable: string[] = [];
  const blocked: ContactabilityResult["blocked"] = [];

  for (const id of prospectIds) {
    const prospect = prospectMap.get(id);
    const reasons: BlockReason[] = [];

    if (prospect) {
      // Status checks
      if (prospect.status === "bounced") reasons.push("status_bounced");
      if (prospect.status === "unsubscribed") reasons.push("status_unsubscribed");
      if (prospect.status === "replied") reasons.push("status_replied");
      if (prospect.status === "converted") reasons.push("status_converted");

      // Cooldown check
      if (
        !options?.ignoreCooldown &&
        prospect.last_contacted_at &&
        now - new Date(prospect.last_contacted_at).getTime() < cooldownMs
      ) {
        reasons.push("recently_contacted");
      }
    }

    // Active campaign check
    if (activeCampaignSet.has(id)) {
      reasons.push("active_campaign");
    }

    if (reasons.length > 0) {
      blocked.push({ prospectId: id, reasons });
    } else {
      contactable.push(id);
    }
  }

  return { contactable, blocked };
}

// ─── Import Protection ───────────────────────────────────────────────────────

/**
 * Given a list of emails, returns a map of email -> {id, status} for prospects
 * whose status is protected and should NOT be overwritten by imports.
 */
export async function getProtectedProspectIds(
  supabase: SupabaseClient,
  emails: string[],
  workspaceId: string
): Promise<Map<string, { id: string; status: string }>> {
  const result = new Map<string, { id: string; status: string }>();
  if (emails.length === 0) return result;

  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, email, status")
    .eq("workspace_id", workspaceId)
    .in("email", emails)
    .in("status", PROTECTED_STATUSES as unknown as string[]);

  for (const p of prospects || []) {
    if (p.email) {
      result.set(p.email.toLowerCase(), { id: p.id, status: p.status });
    }
  }

  return result;
}
