import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const { type, data } = body;

    if (!data?.email_id) {
      return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
    }

    // Find the sent email by Resend message ID
    const { data: emailSent } = await supabase
      .from("emails_sent")
      .select("id, campaign_prospect_id, status")
      .eq("resend_message_id", data.email_id)
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
            error_message: data.bounce?.message || "Bounced",
          })
          .eq("id", emailSent.id);

        // Stop the campaign for this prospect
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

        // Log tracking event
        await supabase.from("tracking_events").insert({
          email_sent_id: emailSent.id,
          event_type: "bounce",
        });
        break;
      }

      case "email.opened": {
        await supabase
          .from("emails_sent")
          .update({ opened_at: new Date().toISOString() })
          .eq("id", emailSent.id);

        await supabase.from("tracking_events").insert({
          email_sent_id: emailSent.id,
          event_type: "open",
        });

        // Increment open stats on campaign
        if (emailSent.campaign_prospect_id) {
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
        await supabase
          .from("emails_sent")
          .update({ clicked_at: new Date().toISOString() })
          .eq("id", emailSent.id);

        await supabase.from("tracking_events").insert({
          email_sent_id: emailSent.id,
          event_type: "click",
          metadata: { url: data.click?.link || null },
        });

        if (emailSent.campaign_prospect_id) {
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

        // Stop campaign for this prospect
        await supabase
          .from("campaign_prospects")
          .update({ status: "unsubscribed" })
          .eq("id", emailSent.campaign_prospect_id);

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
