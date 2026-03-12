import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPipedriveNotes, stripHtml } from "@/lib/pipedrive/client";

// POST /api/pipedrive/sync-notes — Sync all Pipedrive notes
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  let userId: string;
  let workspaceId: string;

  // Support CRON_SECRET auth for server-side triggers
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth =
    cronSecret &&
    (authHeader === `Bearer ${cronSecret}` || cronSecretHeader === cronSecret);

  if (isCronAuth) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .limit(1)
      .single();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, current_workspace_id")
      .limit(1)
      .single();
    if (!workspace || !profile) {
      return NextResponse.json(
        { error: "No workspace/profile" },
        { status: 500 }
      );
    }
    workspaceId = profile.current_workspace_id || workspace.id;
    userId = profile.id;
  } else {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
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
    // 1. Fetch all notes from Pipedrive
    const pipedriveNotes = await fetchAllPipedriveNotes();

    // 2. Get existing pipedrive-imported notes to avoid duplicates (paginated)
    const existingNotes: {
      id: string;
      custom_fields: Record<string, unknown>;
    }[] = [];
    let existStart = 0;
    while (true) {
      const { data } = await supabase
        .from("notes")
        .select("id, custom_fields")
        .eq("workspace_id", workspaceId)
        .not("custom_fields->pipedrive_id", "is", null)
        .range(existStart, existStart + 999);
      if (!data || data.length === 0) break;
      existingNotes.push(
        ...(data as typeof existingNotes)
      );
      existStart += 1000;
      if (data.length < 1000) break;
    }

    const existingPipedriveIds = new Set<number>();
    for (const n of existingNotes) {
      const cf = n.custom_fields;
      if (cf?.pipedrive_id) {
        existingPipedriveIds.add(cf.pipedrive_id as number);
      }
    }

    // 3. Match Pipedrive orgs/persons to our prospects
    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, first_name, last_name, email, company, organization")
      .eq("workspace_id", workspaceId)
      .limit(5000);

    const prospectByOrg = new Map<string, string>();
    const prospectByName = new Map<string, string>();
    for (const p of prospects || []) {
      const org = (p.organization || p.company || "")
        .toLowerCase()
        .trim();
      if (org) prospectByOrg.set(org, p.id);

      const name = [p.first_name, p.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .trim();
      if (name) prospectByName.set(name, p.id);
    }

    // 4. Build note records
    let created = 0;
    let updated = 0;
    let skippedInactive = 0;
    let skippedEmpty = 0;
    const errors: string[] = [];

    const BATCH_SIZE = 50;
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

    for (const pn of pipedriveNotes) {
      // Skip inactive (deleted) notes
      if (!pn.active_flag) {
        skippedInactive++;
        continue;
      }

      // Strip HTML and skip empty notes
      const content = stripHtml(pn.content || "");
      if (!content) {
        skippedEmpty++;
        continue;
      }

      // Find matching prospect
      const orgName = pn.organization?.name || null;
      const personName = pn.person?.name || null;
      const dealTitle = pn.deal?.title || null;

      let prospectId: string | null = null;
      if (orgName) {
        prospectId =
          prospectByOrg.get(orgName.toLowerCase().trim()) || null;
      }
      if (!prospectId && personName) {
        prospectId =
          prospectByName.get(personName.toLowerCase().trim()) || null;
      }

      const noteData: Record<string, unknown> = {
        workspace_id: workspaceId,
        content,
        prospect_id: prospectId,
        is_pinned:
          pn.pinned_to_organization_flag ||
          pn.pinned_to_person_flag ||
          pn.pinned_to_deal_flag,
        created_by: userId,
        created_at: pn.add_time,
        updated_at: pn.update_time || pn.add_time,
        custom_fields: {
          pipedrive_id: pn.id,
          pipedrive_org: orgName,
          pipedrive_person: personName,
          pipedrive_deal: dealTitle,
          pipedrive_author: pn.user?.name,
          source: "pipedrive",
        },
      };

      if (existingPipedriveIds.has(pn.id)) {
        const existing = existingNotes.find((n) => {
          const cf = n.custom_fields as Record<string, unknown> | null;
          return cf?.pipedrive_id === pn.id;
        });
        if (existing) {
          delete noteData.workspace_id;
          delete noteData.created_by;
          delete noteData.created_at;
          toUpdate.push({ id: existing.id, data: noteData });
        }
      } else {
        toInsert.push(noteData);
      }
    }

    // 5. Batch insert new notes
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("notes").insert(batch);
      if (error) {
        errors.push(
          `Insert batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`
        );
        // Fallback: insert one by one
        for (const item of batch) {
          const { error: singleError } = await supabase
            .from("notes")
            .insert(item);
          if (singleError) {
            errors.push(
              `Insert ${(item.custom_fields as Record<string, unknown>)?.pipedrive_id}: ${singleError.message}`
            );
          } else {
            created++;
          }
        }
      } else {
        created += batch.length;
      }
    }

    // 6. Batch update existing notes
    for (const { id, data } of toUpdate) {
      const { error } = await supabase.from("notes").update(data).eq("id", id);
      if (error) {
        errors.push(`Update ${id}: ${error.message}`);
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      total_pipedrive: pipedriveNotes.length,
      created,
      updated,
      skipped_inactive: skippedInactive,
      skipped_empty: skippedEmpty,
      matched_prospects:
        toInsert.filter((n) => n.prospect_id).length +
        toUpdate.filter((u) => u.data.prospect_id).length,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (err) {
    console.error("[Pipedrive Notes Sync] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne" },
      { status: 500 }
    );
  }
}
