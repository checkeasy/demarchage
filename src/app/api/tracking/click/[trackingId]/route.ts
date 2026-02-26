import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const url = request.nextUrl.searchParams.get("url");

  // Validate the target URL
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Security: validate URL scheme
  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return NextResponse.json({ error: "Invalid URL scheme" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Process tracking
  try {
    const supabase = createAdminClient();

    // Find the sent email by tracking ID
    const { data: emailSent } = await supabase
      .from("emails_sent")
      .select("id, campaign_prospect_id, clicked_at")
      .eq("tracking_id", trackingId)
      .single();

    if (emailSent) {
      // Log the click event
      await supabase.from("tracking_events").insert({
        email_sent_id: emailSent.id,
        event_type: "click",
        clicked_url: url,
        ip_address: request.headers.get("x-forwarded-for") || null,
        user_agent: request.headers.get("user-agent"),
      });

      // Update first click timestamp
      if (!emailSent.clicked_at) {
        await supabase
          .from("emails_sent")
          .update({ clicked_at: new Date().toISOString(), status: "clicked" })
          .eq("id", emailSent.id);

        // Update campaign_prospects
        await supabase
          .from("campaign_prospects")
          .update({ has_clicked: true })
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
            p_column: "total_clicked",
          });
        }
      }
    }
  } catch {
    // Silently fail - always redirect even if tracking fails
  }

  // 302 redirect to the original URL
  return NextResponse.redirect(targetUrl.toString(), 302);
}
