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

  // Verify user has access to this campaign
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("id, workspace_id")
    .eq("id", campaignId)
    .single();

  if (campError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Get all steps for the campaign
  const { data: steps, error: stepsError } = await supabase
    .from("sequence_steps")
    .select("id, step_order, step_type, subject")
    .eq("campaign_id", campaignId)
    .order("step_order", { ascending: true });

  if (stepsError) {
    return NextResponse.json({ error: stepsError.message }, { status: 500 });
  }

  if (!steps || steps.length === 0) {
    return NextResponse.json({ steps: [] });
  }

  // Get all emails_sent for these steps
  const stepIds = steps.map((s) => s.id);
  const { data: emails, error: emailsError } = await supabase
    .from("emails_sent")
    .select("id, step_id, status, opened_at, clicked_at, replied_at")
    .in("step_id", stepIds);

  if (emailsError) {
    return NextResponse.json({ error: emailsError.message }, { status: 500 });
  }

  // Aggregate stats per step
  const statsMap = new Map<string, {
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    total_replied: number;
    total_bounced: number;
  }>();

  for (const stepId of stepIds) {
    statsMap.set(stepId, {
      total_sent: 0,
      total_opened: 0,
      total_clicked: 0,
      total_replied: 0,
      total_bounced: 0,
    });
  }

  if (emails) {
    for (const e of emails) {
      const stats = statsMap.get(e.step_id);
      if (!stats) continue;

      if (e.status === "bounced") {
        stats.total_sent++;
        stats.total_bounced++;
        // Don't count opens/clicks/replies for bounced emails
        continue;
      }
      if (e.status === "sent" || e.status === "delivered" || e.status === "opened" || e.status === "clicked" || e.status === "replied") {
        stats.total_sent++;
      }
      if (e.opened_at) stats.total_opened++;
      if (e.clicked_at) stats.total_clicked++;
      if (e.replied_at) stats.total_replied++;
    }
  }

  // Build response
  const result = steps.map((step) => {
    const stats = statsMap.get(step.id)!;
    return {
      id: step.id,
      step_order: step.step_order,
      step_type: step.step_type,
      subject: step.subject,
      ...stats,
      open_rate: stats.total_sent > 0 ? Math.round((stats.total_opened / stats.total_sent) * 100) : 0,
      click_rate: stats.total_sent > 0 ? Math.round((stats.total_clicked / stats.total_sent) * 100) : 0,
      reply_rate: stats.total_sent > 0 ? Math.round((stats.total_replied / stats.total_sent) * 100) : 0,
      bounce_rate: stats.total_sent > 0 ? Math.round((stats.total_bounced / stats.total_sent) * 100) : 0,
    };
  });

  return NextResponse.json({ steps: result });
}
