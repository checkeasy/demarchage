/**
 * Email Warmup Engine
 *
 * Based on Google's official recommendations and industry best practices:
 * - Progressive volume increase over 14 days (2 → 50 emails/day)
 * - Auto-protection: pause if bounce > 3% or complaint > 0.1%
 * - Hard stop: disable account if bounce > 5% or complaint > 0.3%
 * - Max 100 cold emails/day per inbox (Google recommendation)
 *
 * Sources:
 * - Google Workspace Admin Help: Email sender guidelines
 * - Mailreach warmup schedule
 * - Lemwarm best practices
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ─── Google-recommended warmup schedule (14 days) ────────────────────────────
// Day → max emails allowed. After day 14, scale linearly to target.
const WARMUP_SCHEDULE: Record<number, number> = {
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
  6: 12,
  7: 15,
  8: 18,
  9: 22,
  10: 26,
  11: 30,
  12: 35,
  13: 40,
  14: 50,
};

// ─── Safety thresholds (Google Postmaster Tools) ─────────────────────────────
const THRESHOLDS = {
  // Bounce rate
  BOUNCE_WARNING: 3, // % → reduce volume
  BOUNCE_CRITICAL: 5, // % → pause account
  // Spam complaint rate
  COMPLAINT_WARNING: 0.08, // % → reduce volume
  COMPLAINT_CRITICAL: 0.3, // % → pause account
  // Absolute max per inbox per day (Google recommendation for cold outreach)
  MAX_COLD_PER_INBOX: 100,
  // Minimum emails sent before evaluating rates (avoid false positives)
  MIN_SAMPLE_SIZE: 10,
  // How many days of history to evaluate
  EVALUATION_WINDOW_DAYS: 7,
};

export { THRESHOLDS };

/**
 * Calculate how many emails this account is allowed to send today
 * based on the warmup day and health status.
 */
export function getWarmupDailyVolume(
  warmupStartedAt: string | null,
  warmupDailyTarget: number,
): number {
  if (!warmupStartedAt) return 2; // Safety: default to minimum

  const startDate = new Date(warmupStartedAt);
  const now = new Date();
  const dayNumber = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (dayNumber <= 0) return 2;

  // Phase 1: Fixed schedule (days 1-14)
  if (dayNumber <= 14) {
    const scheduleVolume = WARMUP_SCHEDULE[dayNumber] || 2;
    return Math.min(scheduleVolume, warmupDailyTarget, THRESHOLDS.MAX_COLD_PER_INBOX);
  }

  // Phase 2: Linear ramp from day 14 value (50) to target (days 15-28)
  const day14Volume = 50;
  const rampDays = 14; // 2 more weeks to reach target
  const daysSince14 = dayNumber - 14;
  const rampVolume = Math.floor(
    day14Volume + ((warmupDailyTarget - day14Volume) / rampDays) * Math.min(daysSince14, rampDays)
  );

  // Phase 3: At target (day 28+)
  return Math.min(
    Math.max(rampVolume, day14Volume),
    warmupDailyTarget,
    THRESHOLDS.MAX_COLD_PER_INBOX,
  );
}

/**
 * Get the current warmup day number for display purposes.
 */
export function getWarmupDay(warmupStartedAt: string | null): number {
  if (!warmupStartedAt) return 0;
  const startDate = new Date(warmupStartedAt);
  const now = new Date();
  return Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Get warmup phase label for display.
 */
export function getWarmupPhase(dayNumber: number): string {
  if (dayNumber <= 0) return "Non demarre";
  if (dayNumber <= 14) return "Phase 1 - Montee progressive";
  if (dayNumber <= 28) return "Phase 2 - Acceleration";
  return "Phase 3 - Vitesse de croisiere";
}

export interface HealthCheckResult {
  accountId: string;
  emailAddress: string;
  status: "healthy" | "warning" | "critical";
  action: "none" | "reduce_volume" | "pause_account";
  bounceRate: number;
  complaintRate: number;
  totalSent: number;
  totalBounced: number;
  totalComplaints: number;
  message: string;
}

/**
 * Check the health of an email account over the last 7 days
 * and take protective action if thresholds are exceeded.
 *
 * This runs automatically in the cron job.
 */
export async function checkAccountHealth(
  supabase: SupabaseClient,
  accountId: string,
): Promise<HealthCheckResult> {
  // Get account info
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, email_address, is_active, warmup_enabled, health_score")
    .eq("id", accountId)
    .single();

  if (!account) {
    return {
      accountId,
      emailAddress: "unknown",
      status: "critical",
      action: "none",
      bounceRate: 0,
      complaintRate: 0,
      totalSent: 0,
      totalBounced: 0,
      totalComplaints: 0,
      message: "Compte introuvable",
    };
  }

  // Get emails sent in the last 7 days
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - THRESHOLDS.EVALUATION_WINDOW_DAYS);

  const { data: sentEmails } = await supabase
    .from("emails_sent")
    .select("id, status")
    .eq("email_account_id", accountId)
    .gte("sent_at", windowStart.toISOString());

  const totalSent = sentEmails?.length || 0;
  const totalBounced = sentEmails?.filter((e) => e.status === "bounced").length || 0;

  // Count complaints (unsubscribes marked as spam)
  const { count: totalComplaints } = await supabase
    .from("emails_sent")
    .select("id", { count: "exact", head: true })
    .eq("email_account_id", accountId)
    .eq("status", "complained")
    .gte("sent_at", windowStart.toISOString());

  const complaints = totalComplaints || 0;

  // Not enough data to evaluate
  if (totalSent < THRESHOLDS.MIN_SAMPLE_SIZE) {
    return {
      accountId,
      emailAddress: account.email_address,
      status: "healthy",
      action: "none",
      bounceRate: 0,
      complaintRate: 0,
      totalSent,
      totalBounced,
      totalComplaints: complaints,
      message: `Pas assez de donnees (${totalSent}/${THRESHOLDS.MIN_SAMPLE_SIZE} emails min)`,
    };
  }

  const bounceRate = (totalBounced / totalSent) * 100;
  const complaintRate = (complaints / totalSent) * 100;

  // CRITICAL: Disable account
  if (bounceRate >= THRESHOLDS.BOUNCE_CRITICAL || complaintRate >= THRESHOLDS.COMPLAINT_CRITICAL) {
    await supabase
      .from("email_accounts")
      .update({
        is_active: false,
        health_score: Math.max(0, (account.health_score || 100) - 30),
      })
      .eq("id", accountId);

    // Log the health event
    await logHealthEvent(supabase, accountId, totalSent, totalBounced, complaints, bounceRate, complaintRate, true);

    const reason = bounceRate >= THRESHOLDS.BOUNCE_CRITICAL
      ? `Taux de bounce critique: ${bounceRate.toFixed(1)}% (seuil: ${THRESHOLDS.BOUNCE_CRITICAL}%)`
      : `Taux de plainte critique: ${complaintRate.toFixed(2)}% (seuil: ${THRESHOLDS.COMPLAINT_CRITICAL}%)`;

    console.log(`[Warmup] CRITICAL - Account ${account.email_address} DISABLED: ${reason}`);

    return {
      accountId,
      emailAddress: account.email_address,
      status: "critical",
      action: "pause_account",
      bounceRate,
      complaintRate,
      totalSent,
      totalBounced,
      totalComplaints: complaints,
      message: reason,
    };
  }

  // WARNING: Reduce volume
  if (bounceRate >= THRESHOLDS.BOUNCE_WARNING || complaintRate >= THRESHOLDS.COMPLAINT_WARNING) {
    // Reduce warmup volume by 30%
    if (account.warmup_enabled) {
      const { data: warmupData } = await supabase
        .from("email_accounts")
        .select("warmup_current_volume")
        .eq("id", accountId)
        .single();

      if (warmupData) {
        const reducedVolume = Math.max(2, Math.floor((warmupData.warmup_current_volume || 10) * 0.7));
        await supabase
          .from("email_accounts")
          .update({
            warmup_current_volume: reducedVolume,
            health_score: Math.max(30, (account.health_score || 100) - 15),
          })
          .eq("id", accountId);
      }
    }

    await logHealthEvent(supabase, accountId, totalSent, totalBounced, complaints, bounceRate, complaintRate, false);

    const reason = bounceRate >= THRESHOLDS.BOUNCE_WARNING
      ? `Taux de bounce eleve: ${bounceRate.toFixed(1)}% (seuil: ${THRESHOLDS.BOUNCE_WARNING}%) — volume reduit`
      : `Taux de plainte eleve: ${complaintRate.toFixed(2)}% (seuil: ${THRESHOLDS.COMPLAINT_WARNING}%) — volume reduit`;

    console.log(`[Warmup] WARNING - Account ${account.email_address}: ${reason}`);

    return {
      accountId,
      emailAddress: account.email_address,
      status: "warning",
      action: "reduce_volume",
      bounceRate,
      complaintRate,
      totalSent,
      totalBounced,
      totalComplaints: complaints,
      message: reason,
    };
  }

  // HEALTHY
  await logHealthEvent(supabase, accountId, totalSent, totalBounced, complaints, bounceRate, complaintRate, false);

  // Gradually restore health score
  if ((account.health_score || 100) < 100) {
    await supabase
      .from("email_accounts")
      .update({ health_score: Math.min(100, (account.health_score || 100) + 5) })
      .eq("id", accountId);
  }

  return {
    accountId,
    emailAddress: account.email_address,
    status: "healthy",
    action: "none",
    bounceRate,
    complaintRate,
    totalSent,
    totalBounced,
    totalComplaints: complaints,
    message: `Compte sain — bounce: ${bounceRate.toFixed(1)}%, plainte: ${complaintRate.toFixed(2)}%`,
  };
}

async function logHealthEvent(
  supabase: SupabaseClient,
  accountId: string,
  emailsSent: number,
  emailsBounced: number,
  emailsComplained: number,
  bounceRate: number,
  complaintRate: number,
  autoDisabled: boolean,
) {
  const today = new Date().toISOString().split("T")[0];

  // Upsert: one log per account per day
  await supabase
    .from("account_health_logs")
    .upsert(
      {
        email_account_id: accountId,
        log_date: today,
        emails_sent: emailsSent,
        emails_bounced: emailsBounced,
        emails_complained: emailsComplained,
        bounce_rate: bounceRate,
        complaint_rate: complaintRate,
        health_score: autoDisabled ? 0 : Math.max(0, 100 - bounceRate * 10 - complaintRate * 100),
        auto_disabled: autoDisabled,
      },
      { onConflict: "email_account_id,log_date" },
    );
}

/**
 * Run the daily warmup progression for all accounts.
 * Called from the cron job.
 *
 * For each warmup-enabled account:
 * 1. Calculate today's allowed volume from the schedule
 * 2. Update warmup_current_volume
 * 3. Run health check
 */
export async function runWarmupCycle(supabase: SupabaseClient): Promise<{
  updated: number;
  healthChecks: HealthCheckResult[];
}> {
  const { data: warmupAccounts } = await supabase
    .from("email_accounts")
    .select("id, email_address, warmup_enabled, warmup_started_at, warmup_daily_target, warmup_current_volume, is_active")
    .eq("warmup_enabled", true)
    .eq("is_active", true);

  if (!warmupAccounts || warmupAccounts.length === 0) {
    return { updated: 0, healthChecks: [] };
  }

  let updated = 0;
  const healthChecks: HealthCheckResult[] = [];

  for (const acc of warmupAccounts) {
    // Calculate today's volume from schedule
    const todayVolume = getWarmupDailyVolume(
      acc.warmup_started_at,
      acc.warmup_daily_target || 50,
    );

    // Only update if volume changed
    if (todayVolume !== (acc.warmup_current_volume || 0)) {
      await supabase
        .from("email_accounts")
        .update({ warmup_current_volume: todayVolume })
        .eq("id", acc.id);

      const day = getWarmupDay(acc.warmup_started_at);
      console.log(
        `[Warmup] ${acc.email_address}: Jour ${day} → ${todayVolume} emails/jour (cible: ${acc.warmup_daily_target})`,
      );
      updated++;
    }

    // Health check
    const health = await checkAccountHealth(supabase, acc.id);
    healthChecks.push(health);
  }

  return { updated, healthChecks };
}
