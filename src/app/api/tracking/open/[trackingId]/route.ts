import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  // Return the pixel immediately, process tracking async
  const response = new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": TRANSPARENT_GIF.length.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });

  // Process tracking in background (don't block response)
  try {
    const supabase = createAdminClient();

    // Find the sent email by tracking ID
    const { data: emailSent } = await supabase
      .from("emails_sent")
      .select("id, campaign_prospect_id, opened_at")
      .eq("tracking_id", trackingId)
      .single();

    if (emailSent) {
      // Log the tracking event (every open)
      await supabase.from("tracking_events").insert({
        email_sent_id: emailSent.id,
        event_type: "open",
        ip_address: request.headers.get("x-forwarded-for") || null,
        user_agent: request.headers.get("user-agent"),
      });

      // Update first open timestamp
      if (!emailSent.opened_at) {
        await supabase
          .from("emails_sent")
          .update({ opened_at: new Date().toISOString(), status: "opened" })
          .eq("id", emailSent.id);

        // Update campaign_prospects
        await supabase
          .from("campaign_prospects")
          .update({ has_opened: true })
          .eq("id", emailSent.campaign_prospect_id);

        // Increment campaign stats
        const { data: cp } = await supabase
          .from("campaign_prospects")
          .select("campaign_id")
          .eq("id", emailSent.campaign_prospect_id)
          .single();

        if (cp) {
          await supabase.rpc("increment_campaign_stat", {
            p_campaign_id: cp.campaign_id,
            p_column: "total_opened",
          });
        }
      }
    }
  } catch {
    // Silently fail - tracking should never break the user experience
  }

  return response;
}
