import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    // Workspace isolation
    const supabaseAdmin = createAdminClient();
    const { data: profile } = await supabaseAdmin.from('profiles').select('current_workspace_id').eq('id', user.id).single();
    if (!profile?.current_workspace_id) return NextResponse.json({ error: "No workspace" }, { status: 403 });
    const workspaceId = profile.current_workspace_id;

    const body = await request.json();
    const { primaryId, secondaryIds } = body as {
      primaryId: string;
      secondaryIds: string[];
    };

    if (!primaryId || !secondaryIds || !Array.isArray(secondaryIds) || secondaryIds.length === 0) {
      return NextResponse.json(
        { error: "primaryId et secondaryIds sont requis" },
        { status: 400 }
      );
    }

    // Ensure no overlap
    if (secondaryIds.includes(primaryId)) {
      return NextResponse.json(
        { error: "primaryId ne peut pas etre dans secondaryIds" },
        { status: 400 }
      );
    }

    const allIds = [primaryId, ...secondaryIds];

    // Fetch all prospects (workspace isolated)
    const { data: prospects, error: fetchError } = await supabase
      .from("prospects")
      .select("*")
      .in("id", allIds)
      .eq("workspace_id", workspaceId);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json(
        { error: "Prospects non trouves" },
        { status: 404 }
      );
    }

    const primary = prospects.find((p) => p.id === primaryId);
    if (!primary) {
      return NextResponse.json(
        { error: "Prospect principal non trouve" },
        { status: 404 }
      );
    }

    const secondaries = prospects.filter((p) => secondaryIds.includes(p.id));

    // Merge data: keep primary value if non-null, else take from first secondary that has it
    const MERGE_FIELDS = [
      "email",
      "first_name",
      "last_name",
      "company",
      "organization",
      "job_title",
      "phone",
      "website",
      "linkedin_url",
      "location",
      "city",
      "industry",
      "employee_count",
      "source",
      "status",
      "notes",
      "revenue",
    ];

    const mergedData: Record<string, unknown> = {};

    for (const field of MERGE_FIELDS) {
      const primaryValue = primary[field];
      if (primaryValue !== null && primaryValue !== undefined && primaryValue !== "") {
        mergedData[field] = primaryValue;
      } else {
        // Find first secondary with a value
        for (const sec of secondaries) {
          const secValue = sec[field];
          if (secValue !== null && secValue !== undefined && secValue !== "") {
            mergedData[field] = secValue;
            break;
          }
        }
      }
    }

    // Merge custom_fields (deep merge)
    const mergedCustomFields: Record<string, unknown> = {};
    // Apply secondaries first (in reverse order so first secondary wins), then primary on top
    for (const sec of [...secondaries].reverse()) {
      if (sec.custom_fields && typeof sec.custom_fields === "object") {
        for (const [key, val] of Object.entries(sec.custom_fields as Record<string, unknown>)) {
          if (val !== null && val !== undefined && val !== "") {
            mergedCustomFields[key] = val;
          }
        }
      }
    }
    if (primary.custom_fields && typeof primary.custom_fields === "object") {
      for (const [key, val] of Object.entries(primary.custom_fields as Record<string, unknown>)) {
        if (val !== null && val !== undefined && val !== "") {
          mergedCustomFields[key] = val;
        }
      }
    }
    if (Object.keys(mergedCustomFields).length > 0) {
      mergedData.custom_fields = mergedCustomFields;
    }

    // Union merge tags
    const allTags = new Set<string>();
    for (const p of [primary, ...secondaries]) {
      if (Array.isArray(p.tags)) {
        for (const tag of p.tags) {
          if (tag) allTags.add(tag);
        }
      }
    }
    mergedData.tags = Array.from(allTags);

    // --- Re-link foreign keys ---

    // 1. campaign_prospects: handle unique constraint (prospect_id + campaign_id)
    // First, find which campaigns the primary is already in
    const { data: primaryCampaigns } = await supabase
      .from("campaign_prospects")
      .select("campaign_id")
      .eq("prospect_id", primaryId);

    const primaryCampaignIds = new Set(
      (primaryCampaigns || []).map((cp) => cp.campaign_id)
    );

    // For each secondary, get their campaign_prospects
    const { data: secondaryCampaignProspects } = await supabase
      .from("campaign_prospects")
      .select("id, campaign_id, prospect_id")
      .in("prospect_id", secondaryIds);

    if (secondaryCampaignProspects && secondaryCampaignProspects.length > 0) {
      const toDelete: string[] = [];
      const toUpdate: string[] = [];

      for (const cp of secondaryCampaignProspects) {
        if (primaryCampaignIds.has(cp.campaign_id)) {
          // Conflict: primary already in this campaign, delete the secondary entry
          toDelete.push(cp.id);
        } else {
          // Safe to re-link
          toUpdate.push(cp.id);
          primaryCampaignIds.add(cp.campaign_id); // Track to avoid future conflicts within secondaries
        }
      }

      if (toDelete.length > 0) {
        await supabase
          .from("campaign_prospects")
          .delete()
          .in("id", toDelete);
      }

      if (toUpdate.length > 0) {
        await supabase
          .from("campaign_prospects")
          .update({ prospect_id: primaryId })
          .in("id", toUpdate);
      }
    }

    // 2. automation_prospects: same pattern for unique constraints
    const { data: primaryAutomations } = await supabase
      .from("automation_prospects")
      .select("sequence_id")
      .eq("prospect_id", primaryId);

    const primaryAutomationIds = new Set(
      (primaryAutomations || []).map((ap) => ap.sequence_id)
    );

    const { data: secondaryAutomationProspects } = await supabase
      .from("automation_prospects")
      .select("id, sequence_id, prospect_id")
      .in("prospect_id", secondaryIds);

    if (secondaryAutomationProspects && secondaryAutomationProspects.length > 0) {
      const toDelete: string[] = [];
      const toUpdate: string[] = [];

      for (const ap of secondaryAutomationProspects) {
        if (primaryAutomationIds.has(ap.sequence_id)) {
          toDelete.push(ap.id);
        } else {
          toUpdate.push(ap.id);
          primaryAutomationIds.add(ap.sequence_id);
        }
      }

      if (toDelete.length > 0) {
        await supabase
          .from("automation_prospects")
          .delete()
          .in("id", toDelete);
      }

      if (toUpdate.length > 0) {
        await supabase
          .from("automation_prospects")
          .update({ prospect_id: primaryId })
          .in("id", toUpdate);
      }
    }

    // 3. prospect_activities: no unique constraint concerns, just re-link all
    await supabase
      .from("prospect_activities")
      .update({ prospect_id: primaryId })
      .in("prospect_id", secondaryIds);

    // Update primary with merged data FIRST (before deleting secondaries to avoid race condition)
    const { error: updateError } = await supabase
      .from("prospects")
      .update(mergedData)
      .eq("id", primaryId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      console.error("[API Merge] Update primary error:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de la mise a jour du prospect principal: " + updateError.message },
        { status: 500 }
      );
    }

    // Delete secondary prospects AFTER updating primary
    const { error: deleteError } = await supabase
      .from("prospects")
      .delete()
      .in("id", secondaryIds)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      console.error("[API Merge] Delete secondaries error:", deleteError);
      return NextResponse.json(
        { error: "Erreur lors de la suppression des doublons: " + deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      primaryId,
      mergedCount: secondaries.length,
    });
  } catch (err) {
    console.error("[API Merge] Error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
