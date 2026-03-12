import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  // Auth check
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = authClient;

  // Get user's workspace
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }
  const workspaceId = profile.current_workspace_id;

  // Verify user has access to this campaign
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("id, workspace_id")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .single();

  if (campError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Get all steps for the campaign
  const { data: steps } = await supabase
    .from("sequence_steps")
    .select("id")
    .eq("campaign_id", campaignId);

  if (!steps || steps.length === 0) {
    return NextResponse.json({ daily: [] });
  }

  const stepIds = steps.map((s) => s.id);

  // Limit to last 30 days to prevent loading all emails into memory
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get emails_sent for these steps within last 30 days
  const { data: emails, error: emailsError } = await supabase
    .from("emails_sent")
    .select("id, status, sent_at, opened_at, replied_at")
    .in("step_id", stepIds)
    .not("sent_at", "is", null)
    .gte("sent_at", thirtyDaysAgo.toISOString())
    .order("sent_at", { ascending: true });

  if (emailsError) {
    return NextResponse.json({ error: emailsError.message }, { status: 500 });
  }

  // Group by date
  const dailyMap = new Map<string, { sends: number; opens: number; replies: number }>();

  // Pre-fill last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { sends: 0, opens: 0, replies: 0 });
  }

  if (emails) {
    for (const e of emails) {
      if (!e.sent_at) continue;
      const sentDate = new Date(e.sent_at).toISOString().split("T")[0];
      if (dailyMap.has(sentDate)) {
        dailyMap.get(sentDate)!.sends++;
      }

      if (e.opened_at) {
        const openDate = new Date(e.opened_at).toISOString().split("T")[0];
        if (dailyMap.has(openDate)) {
          dailyMap.get(openDate)!.opens++;
        }
      }

      if (e.replied_at) {
        const replyDate = new Date(e.replied_at).toISOString().split("T")[0];
        if (dailyMap.has(replyDate)) {
          dailyMap.get(replyDate)!.replies++;
        }
      }
    }
  }

  const daily = Array.from(dailyMap.entries()).map(([date, stats]) => ({
    date,
    sends: stats.sends,
    opens: stats.opens,
    replies: stats.replies,
  }));

  return NextResponse.json({ daily });
}
