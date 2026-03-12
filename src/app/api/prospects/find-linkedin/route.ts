import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLinkedInClientForUser } from "@/lib/linkedin/client";

/**
 * POST /api/prospects/find-linkedin
 * Auto-find LinkedIn profiles for prospects that don't have one.
 * Body: { prospectIds: string[] } or { campaignId: string } or { sequenceId: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await request.json();
  const admin = createAdminClient();

  // Resolve workspace
  const { data: profile } = await admin
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();
  const workspaceId = profile?.current_workspace_id || "";

  // Get prospect IDs based on input
  let prospectIds: string[] = body.prospectIds || [];

  if (body.campaignId && prospectIds.length === 0) {
    const { data } = await admin
      .from("campaign_prospects")
      .select("prospect_id")
      .eq("campaign_id", body.campaignId);
    prospectIds = (data || []).map((d) => d.prospect_id);
  }

  if (body.sequenceId && prospectIds.length === 0) {
    const { data } = await admin
      .from("automation_prospects")
      .select("prospect_id")
      .eq("sequence_id", body.sequenceId);
    prospectIds = (data || []).map((d) => d.prospect_id);
  }

  if (prospectIds.length === 0) {
    return NextResponse.json({ error: "Aucun prospect fourni" }, { status: 400 });
  }

  // Get prospects WITHOUT linkedin_url (filtered by workspace)
  const { data: prospects } = await admin
    .from("prospects")
    .select("id, first_name, last_name, company, organization, job_title, linkedin_url")
    .in("id", prospectIds)
    .eq("workspace_id", workspaceId);

  const toSearch = (prospects || []).filter(
    (p) => !p.linkedin_url && (p.first_name || p.last_name)
  );

  if (toSearch.length === 0) {
    return NextResponse.json({
      success: true,
      found: 0,
      total: 0,
      message: "Tous les prospects ont deja un LinkedIn",
    });
  }

  // Init LinkedIn client
  let linkedInClient;
  try {
    linkedInClient = await getLinkedInClientForUser(user.id, workspaceId);
  } catch {
    return NextResponse.json(
      { error: "LinkedIn non connecte. Configurez vos cookies LinkedIn dans les parametres." },
      { status: 400 }
    );
  }

  let found = 0;
  const results: Array<{ prospectId: string; name: string; linkedinUrl: string | null }> = [];

  // Search for each prospect (with rate limiting)
  for (const prospect of toSearch) {
    const fullName = `${prospect.first_name || ""} ${prospect.last_name || ""}`.trim();
    const company = prospect.company || prospect.organization || "";

    try {
      // Search by name + company
      const keywords = company ? `${fullName} ${company}` : fullName;
      const searchResults = await linkedInClient.searchPeople({
        keywords,
        count: 3,
      });

      // Find best match
      let bestMatch = null;
      for (const result of searchResults.results) {
        const resultName = `${result.firstName} ${result.lastName}`.trim().toLowerCase();
        const prospectName = fullName.toLowerCase();

        // Name match (fuzzy)
        const nameMatch =
          resultName === prospectName ||
          resultName.includes(prospect.last_name?.toLowerCase() || "___");

        if (nameMatch) {
          bestMatch = result;
          break;
        }
      }

      if (bestMatch && bestMatch.profileUrl) {
        // Update prospect with LinkedIn URL
        await admin
          .from("prospects")
          .update({ linkedin_url: bestMatch.profileUrl })
          .eq("id", prospect.id)
          .eq("workspace_id", workspaceId);

        found++;
        results.push({
          prospectId: prospect.id,
          name: fullName,
          linkedinUrl: bestMatch.profileUrl,
        });
      } else {
        results.push({
          prospectId: prospect.id,
          name: fullName,
          linkedinUrl: null,
        });
      }

      // Rate limiting: 1.5s between searches
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(`[FindLinkedIn] Error searching for ${fullName}:`, err);
      results.push({
        prospectId: prospect.id,
        name: fullName,
        linkedinUrl: null,
      });
    }
  }

  return NextResponse.json({
    success: true,
    found,
    total: toSearch.length,
    results,
  });
}
