import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Thresholds for auto-disabling accounts
const BOUNCE_RATE_THRESHOLD = 5; // 5% bounce rate
const COMPLAINT_RATE_THRESHOLD = 0.1; // 0.1% complaint rate
const MIN_EMAILS_FOR_CHECK = 10; // Need at least 10 emails to evaluate

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Get all active email accounts
    const { data: accounts } = await supabase
      .from("email_accounts")
      .select("id, email_address, provider, health_score, is_active")
      .eq("is_active", true);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: "No active accounts", checked: 0 });
    }

    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let checked = 0;
    let disabled = 0;

    for (const account of accounts) {
      // Count emails sent in the last 7 days
      const { count: sentCount } = await supabase
        .from("emails_sent")
        .select("id", { count: "exact", head: true })
        .eq("email_account_id", account.id)
        .gte("sent_at", sevenDaysAgo)
        .in("status", ["sent", "delivered", "opened", "clicked", "replied", "bounced", "complained"]);

      const totalSent = sentCount || 0;
      if (totalSent < MIN_EMAILS_FOR_CHECK) continue;

      // Count bounces
      const { count: bounceCount } = await supabase
        .from("emails_sent")
        .select("id", { count: "exact", head: true })
        .eq("email_account_id", account.id)
        .gte("sent_at", sevenDaysAgo)
        .eq("status", "bounced");

      // Count complaints
      const { count: complaintCount } = await supabase
        .from("emails_sent")
        .select("id", { count: "exact", head: true })
        .eq("email_account_id", account.id)
        .gte("sent_at", sevenDaysAgo)
        .eq("status", "complained");

      const bounces = bounceCount || 0;
      const complaints = complaintCount || 0;
      const bounceRate = (bounces / totalSent) * 100;
      const complaintRate = (complaints / totalSent) * 100;

      // Calculate health score (0-100)
      let healthScore = 100;
      if (bounceRate > 2) healthScore -= Math.round(bounceRate * 5);
      if (complaintRate > 0.05) healthScore -= Math.round(complaintRate * 200);
      healthScore = Math.max(0, Math.min(100, healthScore));

      // Auto-disable if thresholds exceeded
      const shouldDisable = bounceRate > BOUNCE_RATE_THRESHOLD || complaintRate > COMPLAINT_RATE_THRESHOLD;

      // Log health data
      await supabase
        .from("account_health_logs")
        .upsert({
          email_account_id: account.id,
          log_date: today,
          emails_sent: totalSent,
          emails_bounced: bounces,
          emails_complained: complaints,
          bounce_rate: Math.round(bounceRate * 100) / 100,
          complaint_rate: Math.round(complaintRate * 10000) / 10000,
          health_score: healthScore,
          auto_disabled: shouldDisable,
        }, {
          onConflict: "email_account_id,log_date",
        });

      // Update account health score
      await supabase
        .from("email_accounts")
        .update({
          health_score: healthScore,
          ...(shouldDisable ? { is_active: false } : {}),
        })
        .eq("id", account.id);

      if (shouldDisable) {
        console.log(`[HealthCheck] AUTO-DISABLED account ${account.email_address}: bounce_rate=${bounceRate.toFixed(1)}%, complaint_rate=${complaintRate.toFixed(3)}%`);
        disabled++;
      }

      checked++;
    }

    // Reset daily rotation counters (emails_sent_today on campaign_email_accounts)
    await supabase
      .from("campaign_email_accounts")
      .update({ emails_sent_today: 0 })
      .gt("emails_sent_today", 0);

    return NextResponse.json({
      message: "Health check completed",
      checked,
      disabled,
    });
  } catch (err) {
    console.error("[HealthCheck] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
