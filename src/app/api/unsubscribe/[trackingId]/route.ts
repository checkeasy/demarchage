import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  if (!trackingId) {
    return new NextResponse("Lien invalide", { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    // Find the email sent record by tracking_id
    const { data: emailSent, error: emailError } = await supabase
      .from("emails_sent")
      .select("id, campaign_prospect_id, to_email")
      .eq("tracking_id", trackingId)
      .single();

    if (emailError || !emailSent) {
      return htmlResponse("Lien de desabonnement invalide ou expire.");
    }

    // Get campaign_prospect to find prospect_id and campaign_id
    const { data: cp } = await supabase
      .from("campaign_prospects")
      .select("id, prospect_id, campaign_id")
      .eq("id", emailSent.campaign_prospect_id)
      .single();

    if (!cp) {
      return htmlResponse("Lien de desabonnement invalide ou expire.");
    }

    // 1. Mark this campaign_prospect as unsubscribed
    await supabase
      .from("campaign_prospects")
      .update({
        status: "unsubscribed",
        status_reason: "Desabonnement volontaire",
        next_send_at: null,
      })
      .eq("id", cp.id);

    // 2. Stop ALL active sequences for this prospect across all campaigns
    await supabase
      .from("campaign_prospects")
      .update({
        status: "unsubscribed",
        status_reason: "Desabonnement volontaire",
        next_send_at: null,
      })
      .eq("prospect_id", cp.prospect_id)
      .eq("status", "active");

    // 3. Mark the prospect as unsubscribed globally
    await supabase
      .from("prospects")
      .update({ status: "unsubscribed" })
      .eq("id", cp.prospect_id);

    // 4. Insert tracking event
    await supabase.from("tracking_events").insert({
      email_sent_id: emailSent.id,
      event_type: "unsubscribe",
      ip_address: null,
      user_agent: null,
    });

    return htmlResponse(
      "Vous avez ete desabonne avec succes. Vous ne recevrez plus de messages de notre part.",
      true
    );
  } catch (err) {
    console.error("[Unsubscribe] Error:", err);
    return htmlResponse("Une erreur est survenue. Veuillez reessayer plus tard.");
  }
}

// Also support POST for List-Unsubscribe-Post one-click unsubscribe
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ trackingId: string }> }
) {
  return GET(request, context);
}

function htmlResponse(message: string, success = false) {
  const color = success ? "#22c55e" : "#ef4444";
  const icon = success ? "&#10003;" : "&#10007;";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desabonnement</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 420px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .icon { font-size: 48px; color: ${color}; margin-bottom: 16px; }
    .message { color: #334155; font-size: 16px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <p class="message">${message}</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
