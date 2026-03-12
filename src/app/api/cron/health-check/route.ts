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

    // --- Single query to get all email stats for all accounts in the last 7 days ---
    const accountIds = accounts.map((a) => a.id);
    const { data: emailStats } = await supabase
      .from("emails_sent")
      .select("email_account_id, status")
      .gte("sent_at", sevenDaysAgo)
      .in("email_account_id", accountIds);

    // Aggregate counts in JS by account_id
    const statsMap = new Map<string, { total: number; bounces: number; complaints: number }>();
    if (emailStats) {
      for (const row of emailStats) {
        const accId = row.email_account_id as string;
        if (!statsMap.has(accId)) {
          statsMap.set(accId, { total: 0, bounces: 0, complaints: 0 });
        }
        const entry = statsMap.get(accId)!;
        const status = row.status as string;
        // Count all relevant statuses as "sent"
        if (["sent", "delivered", "opened", "clicked", "replied", "bounced", "complained"].includes(status)) {
          entry.total++;
        }
        if (status === "bounced") entry.bounces++;
        if (status === "complained") entry.complaints++;
      }
    }

    for (const account of accounts) {
      const stats = statsMap.get(account.id) || { total: 0, bounces: 0, complaints: 0 };
      const totalSent = stats.total;
      if (totalSent < MIN_EMAILS_FOR_CHECK) continue;

      const bounces = stats.bounces;
      const complaints = stats.complaints;
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
