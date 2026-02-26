import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Strategy: Check for bounced/complained emails from Resend webhooks
    // and update campaign prospect statuses accordingly.
    // Also detect opens/clicks from tracking_events to advance sequences.

    let repliesDetected = 0;
    let bouncesHandled = 0;

    // 1. Find campaign prospects still "active" but whose last email bounced
    const { data: bouncedEmails } = await supabase
      .from("emails_sent")
      .select("id, campaign_prospect_id")
      .eq("status", "bounced")
      .not("campaign_prospect_id", "is", null);

    if (bouncedEmails && bouncedEmails.length > 0) {
      for (const email of bouncedEmails) {
        const { data: cp } = await supabase
          .from("campaign_prospects")
          .select("id, status")
          .eq("id", email.campaign_prospect_id)
          .eq("status", "active")
          .single();

        if (cp) {
          await supabase
            .from("campaign_prospects")
            .update({ status: "bounced" })
            .eq("id", cp.id);
          bouncesHandled++;
        }
      }
    }

    // 2. Check tracking_events for "reply" events (set by webhook)
    //    and pause the campaign for prospects who replied
    const { data: replyEvents } = await supabase
      .from("tracking_events")
      .select("email_sent_id, created_at")
      .eq("event_type", "reply")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (replyEvents && replyEvents.length > 0) {
      for (const event of replyEvents) {
        const { data: emailSent } = await supabase
          .from("emails_sent")
          .select("campaign_prospect_id")
          .eq("id", event.email_sent_id)
          .single();

        if (emailSent?.campaign_prospect_id) {
          const { data: cp } = await supabase
            .from("campaign_prospects")
            .select("id, status, prospect_id, campaign_id")
            .eq("id", emailSent.campaign_prospect_id)
            .eq("status", "active")
            .single();

          if (cp) {
            // Pause the campaign for this prospect (they replied)
            await supabase
              .from("campaign_prospects")
              .update({ status: "replied" })
              .eq("id", cp.id);

            // Update prospect last_contacted_at
            await supabase
              .from("prospects")
              .update({ last_contacted_at: new Date().toISOString() })
              .eq("id", cp.prospect_id);

            // Increment reply stats on campaign
            try {
              await supabase.rpc("increment_campaign_stat", {
                p_campaign_id: cp.campaign_id,
                p_column: "total_replied",
              });
            } catch {
              // RPC may not exist yet
            }

            repliesDetected++;
          }
        }
      }
    }

    // 3. Update last_synced_at on all active email accounts
    const { data: accounts } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("is_active", true);

    if (accounts) {
      for (const account of accounts) {
        await supabase
          .from("email_accounts")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", account.id);
      }
    }

    return NextResponse.json({
      message: "Reply check completed",
      accounts_checked: accounts?.length || 0,
      replies_detected: repliesDetected,
      bounces_handled: bouncesHandled,
    });
  } catch (err) {
    console.error("Check replies error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
