import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrollProspectInMission } from "@/lib/missions/enroll-prospect";

// POST /api/missions/[id]/enroll — Manually enroll prospects in mission campaigns
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  // Get user's workspace
  const { data: profile } = await adminSupabase.from('profiles').select('current_workspace_id').eq('id', user.id).single();
  if (!profile?.current_workspace_id) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const workspaceId = profile.current_workspace_id;

  const body = await request.json();
  const { prospectIds } = body;

  if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
    return NextResponse.json({ error: "Aucun prospect fourni" }, { status: 400 });
  }

  // Get mission
  const { data: mission, error: missionError } = await supabase
    .from("outreach_missions")
    .select("id, campaign_email_id, campaign_linkedin_id, campaign_multichannel_id")
    .eq("id", missionId)
    .eq("workspace_id", workspaceId)
    .single();

  if (missionError || !mission) {
    return NextResponse.json({ error: "Mission non trouvee" }, { status: 404 });
  }

  // Get prospects
  const { data: prospects } = await adminSupabase
    .from("prospects")
    .select("id, email, linkedin_url, phone, status")
    .in("id", prospectIds)
    .eq("workspace_id", workspaceId);

  if (!prospects || prospects.length === 0) {
    return NextResponse.json({ error: "Aucun prospect trouve" }, { status: 404 });
  }

  let enrolled = 0;
  let skipped = 0;

  for (const prospect of prospects) {
    // Set mission_id on prospect
    await adminSupabase
      .from("prospects")
      .update({ mission_id: missionId })
      .eq("id", prospect.id);

    // Enroll in appropriate campaign
    const result = await enrollProspectInMission(adminSupabase, mission, prospect);
    if (result.enrolled) {
      enrolled++;
    } else {
      skipped++;
    }
  }

  // Update mission total_prospects
  const { count } = await adminSupabase
    .from("prospects")
    .select("id", { count: "exact", head: true })
    .eq("mission_id", missionId);

  await adminSupabase
    .from("outreach_missions")
    .update({ total_prospects: count || 0 })
    .eq("id", missionId);

  return NextResponse.json({
    success: true,
    enrolled,
    skipped,
    total: prospectIds.length,
  });
}
