import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAllPipedriveActivities,
  mapPipedriveType,
  mapPipedrivePriority,
  buildDueDate,
  parseDuration,
} from "@/lib/pipedrive/client";

// POST /api/pipedrive/sync-activities — Sync all Pipedrive activities
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  let userId: string;
  let workspaceId: string;

  // Support CRON_SECRET auth for server-side triggers
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && (authHeader === `Bearer ${cronSecret}` || cronSecretHeader === cronSecret);
  if (isCronAuth) {
    // Use first workspace + first user
    const { data: workspace } = await supabase.from("workspaces").select("id").limit(1).single();
    const { data: profile } = await supabase.from("profiles").select("id, current_workspace_id").limit(1).single();
    if (!workspace || !profile) {
      return NextResponse.json({ error: "No workspace/profile" }, { status: 500 });
    }
    workspaceId = profile.current_workspace_id || workspace.id;
    userId = profile.id;
  } else {
    // Normal auth check
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", user.id)
      .single();

    if (!profile?.current_workspace_id) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 });
    }
    workspaceId = profile.current_workspace_id;
  }

  try {
    // 1. Fetch all activities from Pipedrive
    const pipedriveActivities = await fetchAllPipedriveActivities();

    // 2. Get existing pipedrive-imported activities to avoid duplicates
    const { data: existingActivities } = await supabase
      .from("activities")
      .select("id, custom_fields")
      .eq("workspace_id", workspaceId)
      .not("custom_fields->pipedrive_id", "is", null);

    const existingPipedriveIds = new Set<number>();
    for (const a of existingActivities || []) {
      const cf = a.custom_fields as Record<string, unknown> | null;
      if (cf?.pipedrive_id) {
        existingPipedriveIds.add(cf.pipedrive_id as number);
      }
    }

    // 3. Try to match Pipedrive persons to our prospects
    // Build a lookup by org_name or person_name
    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, first_name, last_name, email, company, organization")
      .eq("workspace_id", workspaceId)
      .limit(5000);

    // Map: lowercase org/company → prospect_id
    const prospectByOrg = new Map<string, string>();
    const prospectByName = new Map<string, string>();
    for (const p of prospects || []) {
      const org = (p.organization || p.company || "").toLowerCase().trim();
      if (org) prospectByOrg.set(org, p.id);

      const name = [p.first_name, p.last_name].filter(Boolean).join(" ").toLowerCase().trim();
      if (name) prospectByName.set(name, p.id);
    }

    // 4. Build activity records
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const BATCH_SIZE = 50;
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

    for (const pa of pipedriveActivities) {
      // Find matching prospect
      let prospectId: string | null = null;
      if (pa.org_name) {
        prospectId = prospectByOrg.get(pa.org_name.toLowerCase().trim()) || null;
      }
      if (!prospectId && pa.person_name) {
        prospectId = prospectByName.get(pa.person_name.toLowerCase().trim()) || null;
      }

      const activityData: Record<string, unknown> = {
        workspace_id: workspaceId,
        activity_type: mapPipedriveType(pa.type),
        title: pa.subject || `${pa.type} - ${pa.org_name || pa.person_name || "Sans nom"}`,
        description: pa.note || pa.public_description || null,
        due_date: buildDueDate(pa.due_date, pa.due_time),
        duration_minutes: parseDuration(pa.duration),
        is_done: pa.done,
        done_at: pa.done && pa.marked_as_done_time ? pa.marked_as_done_time : null,
        priority: mapPipedrivePriority(pa.priority),
        prospect_id: prospectId,
        assigned_to: userId,
        created_by: userId,
        custom_fields: {
          pipedrive_id: pa.id,
          pipedrive_org: pa.org_name,
          pipedrive_person: pa.person_name,
          pipedrive_deal: pa.deal_title,
          pipedrive_owner: pa.owner_name,
          pipedrive_location: pa.location,
          source: "pipedrive",
        },
      };

      if (existingPipedriveIds.has(pa.id)) {
        // Find the existing activity to update
        const existing = (existingActivities || []).find((a) => {
          const cf = a.custom_fields as Record<string, unknown> | null;
          return cf?.pipedrive_id === pa.id;
        });
        if (existing) {
          // Don't overwrite workspace_id, created_by
          delete activityData.workspace_id;
          delete activityData.created_by;
          toUpdate.push({ id: existing.id, data: activityData });
        }
      } else {
        toInsert.push(activityData);
      }
    }

    // 5. Batch insert new activities
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("activities").insert(batch);
      if (error) {
        errors.push(`Insert batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
        // Try one by one
        for (const item of batch) {
          const { error: singleError } = await supabase.from("activities").insert(item);
          if (singleError) {
            errors.push(`Insert ${(item.custom_fields as Record<string,unknown>)?.pipedrive_id}: ${singleError.message}`);
          } else {
            created++;
          }
        }
      } else {
        created += batch.length;
      }
    }

    // 6. Batch update existing activities
    for (const { id, data } of toUpdate) {
      const { error } = await supabase.from("activities").update(data).eq("id", id);
      if (error) {
        errors.push(`Update ${id}: ${error.message}`);
      } else {
        updated++;
      }
    }

    skipped = pipedriveActivities.length - created - updated;

    return NextResponse.json({
      success: true,
      total_pipedrive: pipedriveActivities.length,
      created,
      updated,
      skipped,
      matched_prospects: toInsert.filter((a) => a.prospect_id).length + toUpdate.filter((a) => a.data.prospect_id).length,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (err) {
    console.error("[Pipedrive Sync] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne" },
      { status: 500 }
    );
  }
}
