import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/missions/[id] — Mission detail with stats
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const { data: mission, error } = await supabase
    .from("outreach_missions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !mission) {
    return NextResponse.json({ error: "Mission non trouvee" }, { status: 404 });
  }

  // Get campaign stats
  const campaignIds = [
    mission.campaign_email_id,
    mission.campaign_linkedin_id,
    mission.campaign_multichannel_id,
  ].filter(Boolean);

  let campaignStats: Record<string, unknown>[] = [];
  if (campaignIds.length > 0) {
    const { data } = await supabase
      .from("campaigns")
      .select("id, name, status, total_prospects, total_sent, total_opened, total_replied, total_bounced")
      .in("id", campaignIds);
    campaignStats = data || [];
  }

  // Get prospect count
  const { count: prospectCount } = await supabase
    .from("prospects")
    .select("id", { count: "exact", head: true })
    .eq("mission_id", id);

  return NextResponse.json({
    mission: {
      ...mission,
      total_prospects: prospectCount || mission.total_prospects,
    },
    campaigns: campaignStats,
  });
}

// PATCH /api/missions/[id] — Update mission status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const body = await request.json();
  const { status } = body;

  const validStatuses = ["draft", "active", "paused", "completed", "archived"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Status invalide. Valeurs acceptees: " + validStatuses.join(", ") },
      { status: 400 }
    );
  }

  const { data: mission, error } = await supabase
    .from("outreach_missions")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, mission });
}
