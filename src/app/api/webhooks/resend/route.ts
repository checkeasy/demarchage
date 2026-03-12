import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Webhook } from "svix";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
    }

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET is not configured");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    let body: Record<string, unknown>;
    try {
      const wh = new Webhook(webhookSecret);
      body = wh.verify(rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const type = body.type as string;
    const data = body.data as Record<string, unknown>;

    if (!data || !(data as Record<string, unknown>).email_id) {
      return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
    }

    // Find the sent email by Resend message ID
    const { data: emailSent } = await supabase
      .from("emails_sent")
      .select("id, campaign_prospect_id, status, opened_at, clicked_at")
      .eq("resend_message_id", (data as Record<string, string>).email_id)
      .single();

    if (!emailSent) {
      return NextResponse.json({ message: "Email not found" }, { status: 200 });
    }

    switch (type) {
      case "email.delivered": {
        await supabase
          .from("emails_sent")
          .update({
            status: "delivered",
            delivered_at: new Date().toISOString(),
          })
          .eq("id", emailSent.id);
        break;
      }

      case "email.bounced": {
        await supabase
          .from("emails_sent")
          .update({
            status: "bounced",
            bounced_at: new Date().toISOString(),
            error_message: (data as Record<string, Record<string, string>>).bounce?.message || "Bounced",
          })
          .eq("id", emailSent.id);

        // Stop the campaign for this prospect (only if linked to a campaign)
        if (emailSent.campaign_prospect_id) {
          await supabase
            .from("campaign_prospects")
            .update({ status: "bounced" })
            .eq("id", emailSent.campaign_prospect_id);

          // Get prospect ID to mark as bounced
          const { data: cp } = await supabase
            .from("campaign_prospects")
            .select("prospect_id, campaign_id")
            .eq("id", emailSent.campaign_prospect_id)
            .single();

          if (cp) {
            await supabase
              .from("prospects")
              .update({ status: "bounced" })
              .eq("id", cp.prospect_id);

            // Increment bounce stats
            await supabase.rpc("increment_campaign_stat", {
              p_campaign_id: cp.campaign_id,
              p_column: "total_bounced",
            });
          }
        }

        // Log tracking event
        await supabase.from("tracking_events").insert({
          email_sent_id: emailSent.id,
          event_type: "bounce",
        });
        break;
      }

      case "email.opened": {
        // Don't count opens for bounced emails
        if (emailSent.status === "bounced") {
          break;
        }

        const isFirstOpen = !emailSent.opened_at;

        await supabase
          .from("emails_sent")
          .update({ opened_at: new Date().toISOString() })
          .eq("id", emailSent.id);

        await supabase.from("tracking_events").insert({
          email_sent_id: emailSent.id,
          event_type: "open",
        });

        // Increment open stats on campaign only on first open
        if (isFirstOpen && emailSent.campaign_prospect_id) {
          const { data: cp } = await supabase
            .from("campaign_prospects")
            .select("campaign_id")
            .eq("id", emailSent.campaign_prospect_id)
            .single();

          if (cp) {
            try {
              await supabase.rpc("increment_campaign_stat", {
                p_campaign_id: cp.campaign_id,
                p_column: "total_opened",
              });
            } catch { /* RPC may not exist */ }
          }
        }
        break;
      }

      case "email.clicked": {
        // Don't count clicks for bounced emails
        if (emailSent.status === "bounced") {
          break;
        }

        const isFirstClick = !emailSent.clicked_at;

        await supabase
          .from("emails_sent")
          .update({ clicked_at: new Date().toISOString() })
          .eq("id", emailSent.id);

        await supabase.from("tracking_events").insert({
          email_sent_id: emailSent.id,
          event_type: "click",
          metadata: { url: (data as Record<string, Record<string, string>>).click?.link || null },
        });

        // Increment click stats on campaign only on first click
        if (isFirstClick && emailSent.campaign_prospect_id) {
          const { data: cp } = await supabase
            .from("campaign_prospects")
            .select("campaign_id")
            .eq("id", emailSent.campaign_prospect_id)
            .single();

          if (cp) {
            try {
              await supabase.rpc("increment_campaign_stat", {
                p_campaign_id: cp.campaign_id,
                p_column: "total_clicked",
              });
            } catch { /* RPC may not exist */ }
          }
        }
        break;
      }

      case "email.complained": {
        await supabase
          .from("emails_sent")
          .update({ status: "complained" })
          .eq("id", emailSent.id);

        // Get prospect ID from campaign_prospect (only if linked to a campaign)
        if (emailSent.campaign_prospect_id) {
          const { data: cpComplaint } = await supabase
            .from("campaign_prospects")
            .select("prospect_id")
            .eq("id", emailSent.campaign_prospect_id)
            .single();

          if (cpComplaint) {
            // Mark the prospect as unsubscribed (complaint = hard stop)
            await supabase
              .from("prospects")
              .update({ status: "unsubscribed" })
              .eq("id", cpComplaint.prospect_id);

            // Stop ALL active campaign_prospects for this prospect
            await supabase
              .from("campaign_prospects")
              .update({
                status: "unsubscribed",
                next_send_at: null,
              })
              .eq("prospect_id", cpComplaint.prospect_id)
              .in("status", ["active", "paused"]);
          }
        }

        // Log tracking event
        await supabase.from("tracking_events").insert({
          email_sent_id: emailSent.id,
          event_type: "complaint",
        });
        break;
      }
    }

    return NextResponse.json({ message: "Webhook processed" });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
