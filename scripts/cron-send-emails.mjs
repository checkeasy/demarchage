#!/usr/bin/env node

// Cron script autonome pour envoyer des emails via Gmail SMTP.
// Tourne sur le VPS (Hostinger) car Railway bloque le SMTP sortant.
//
// Usage: node scripts/cron-send-emails.mjs
// Crontab: every 15min, 8h-18h, Mon-Fri
//   cd /root/ProjectList/colddemarchage && node scripts/cron-send-emails.mjs >> /var/log/cron-emails.log 2>&1

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://eykdqbpdxyowpvbflzcn.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5a2RxYnBkeHlvd3B2YmZsemNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAzODU2MSwiZXhwIjoyMDg3NjE0NTYxfQ.-DLbpigJBceHqm8emYK4QETl2t9xzOkp7q2kBzqT2o8";

const GMAIL_USER = "adrien@checkeasy.co";
const GMAIL_APP_PASSWORD = "vbihjpukvbodjzvm";

const BATCH_SIZE = 10;
const MIN_EMAIL_SCORE = 40;
const MIN_DELAY_MS = 2000;
const MAX_DELAY_MS = 5000;

// ─── Clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function randomDelay() {
  const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  return new Promise((r) => setTimeout(r, ms));
}

function mergeTemplate(template, data) {
  if (!template) return "";
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}|\\{${key}\\}`, "gi");
    result = result.replace(regex, value || "");
  }
  return result;
}

function isWithinSendingWindow(timezone, windowStart, windowEnd, sendingDays) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const localTime = `${hour}:${minute}`;

    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "Europe/Paris",
      weekday: "short",
    });
    const dayName = dayFormatter.format(now);
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const localDay = dayMap[dayName] ?? now.getDay();

    const days = sendingDays || [1, 2, 3, 4, 5];
    const start = windowStart || "08:00";
    const end = windowEnd || "18:00";

    return days.includes(localDay) && localTime >= start && localTime < end;
  } catch {
    return true; // If timezone fails, allow sending
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log("Starting email cron...");

  // 1. Verify SMTP connection
  try {
    await transporter.verify();
    log("SMTP connection OK");
  } catch (err) {
    log(`SMTP FAILED: ${err.message}`);
    process.exit(1);
  }

  // 2. Count emails sent today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todaySent, error: countError } = await supabase
    .from("emails_sent")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", todayStart.toISOString())
    .eq("status", "sent");

  const sentToday = countError ? 0 : (todaySent?.length ?? 0);

  // Get account daily limit
  const { data: account } = await supabase
    .from("email_accounts")
    .select("daily_limit")
    .eq("email_address", GMAIL_USER)
    .single();

  const dailyLimit = account?.daily_limit || 30;
  const remaining = Math.max(0, dailyLimit - sentToday);

  log(`Sent today: ${sentToday} / ${dailyLimit} (remaining: ${remaining})`);

  if (remaining <= 0) {
    log("Daily limit reached, stopping.");
    process.exit(0);
  }

  // 3. Fetch queue
  const { data: queue, error: queueError } = await supabase
    .from("email_send_queue")
    .select("*")
    .limit(Math.min(BATCH_SIZE, remaining));

  if (queueError) {
    log(`Queue fetch error: ${queueError.message}`);
    process.exit(1);
  }

  if (!queue || queue.length === 0) {
    log("No emails in queue.");
    process.exit(0);
  }

  log(`Found ${queue.length} emails in queue`);

  let sentCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const item of queue) {
    try {
      // Check email validity score
      if (item.email_validity_score !== null && item.email_validity_score < MIN_EMAIL_SCORE) {
        log(`Skip ${item.prospect_email}: score ${item.email_validity_score} < ${MIN_EMAIL_SCORE}`);
        skippedCount++;
        continue;
      }

      // Check sending window
      if (
        !isWithinSendingWindow(
          item.timezone,
          item.sending_window_start,
          item.sending_window_end,
          item.sending_days
        )
      ) {
        log(`Skip ${item.prospect_email}: outside sending window`);
        continue;
      }

      // Get step content
      const { data: step } = await supabase
        .from("sequence_steps")
        .select("*")
        .eq("id", item.current_step_id)
        .single();

      if (!step || step.step_type !== "email") {
        // Non-email steps: just advance
        await advanceToNextStep(item);
        continue;
      }

      // Template merge
      let subject = step.subject || "";
      let bodyHtml = step.body_html || "";
      let bodyText = step.body_text || "";

      // Handle A/B variants
      let variantId = null;
      if (step.ab_enabled) {
        const { data: variants } = await supabase
          .from("ab_variants")
          .select("*")
          .eq("step_id", step.id);

        if (variants?.length > 0) {
          if (step.ab_winner_variant_id) {
            const winner = variants.find((v) => v.id === step.ab_winner_variant_id);
            if (winner) {
              subject = winner.subject;
              bodyHtml = winner.body_html || bodyHtml;
              bodyText = winner.body_text || bodyText;
              variantId = winner.id;
            }
          } else {
            const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
            let random = Math.random() * totalWeight;
            for (const variant of variants) {
              random -= variant.weight;
              if (random <= 0) {
                subject = variant.subject;
                bodyHtml = variant.body_html || bodyHtml;
                bodyText = variant.body_text || bodyText;
                variantId = variant.id;
                break;
              }
            }
          }
        }
      }

      // Merge template variables
      const templateData = {
        firstName: item.prospect_first_name || "",
        prenom: item.prospect_first_name || "",
        lastName: item.prospect_last_name || "",
        nom: item.prospect_last_name || "",
        company: item.prospect_company || "",
        entreprise: item.prospect_company || "",
        email: item.prospect_email || "",
      };

      // Add custom fields
      if (item.custom_fields && typeof item.custom_fields === "object") {
        for (const [k, v] of Object.entries(item.custom_fields)) {
          templateData[k] = String(v || "");
        }
      }

      const mergedSubject = mergeTemplate(subject, templateData);
      let mergedBody = mergeTemplate(bodyHtml, templateData);
      const mergedText = bodyText ? mergeTemplate(bodyText, templateData) : undefined;

      // Append signature
      if (item.signature_html) {
        mergedBody += `<br/><br/>${item.signature_html}`;
      }

      // Determine from address
      const fromEmail = item.from_display_name
        ? `${item.from_display_name} <${item.from_email_address}>`
        : item.from_email_address;

      // Insert emails_sent record
      const trackingId = crypto.randomUUID();
      const { data: emailRecord, error: insertError } = await supabase
        .from("emails_sent")
        .insert({
          campaign_prospect_id: item.campaign_prospect_id,
          step_id: step.id,
          ab_variant_id: variantId,
          email_account_id: item.email_account_id,
          from_email: fromEmail,
          to_email: item.prospect_email,
          subject: mergedSubject,
          body_html: mergedBody,
          body_text: mergedText,
          tracking_id: trackingId,
          status: "sending",
        })
        .select()
        .single();

      if (insertError || !emailRecord) {
        log(`DB insert error for ${item.prospect_email}: ${insertError?.message}`);
        errorCount++;
        continue;
      }

      // Random delay between emails (human behavior)
      if (sentCount > 0) {
        await randomDelay();
      }

      // Send via Gmail SMTP
      try {
        const info = await transporter.sendMail({
          from: fromEmail,
          to: item.prospect_email,
          subject: mergedSubject,
          html: mergedBody,
          text: mergedText || mergedBody.replace(/<[^>]*>/g, ""),
          replyTo: item.from_email_address,
        });

        // Update email record as sent
        await supabase
          .from("emails_sent")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_message_id: info.messageId,
          })
          .eq("id", emailRecord.id);

        // Increment campaign stat
        await supabase.rpc("increment_campaign_stat", {
          p_campaign_id: item.campaign_id,
          p_column: "total_sent",
        });

        // Update A/B variant stat
        if (variantId) {
          await supabase.rpc("increment_ab_variant_stat", {
            p_variant_id: variantId,
            p_column: "total_sent",
          });
        }

        // Update prospect last_contacted_at
        await supabase
          .from("prospects")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", item.prospect_id);

        sentCount++;
        log(`SENT to ${item.prospect_email} (${mergedSubject})`);
      } catch (sendErr) {
        // Mark as failed
        await supabase
          .from("emails_sent")
          .update({
            status: "failed",
            error_message: sendErr.message,
          })
          .eq("id", emailRecord.id);

        errorCount++;
        log(`FAILED ${item.prospect_email}: ${sendErr.message}`);
      }

      // Advance to next step
      await advanceToNextStep(item);
    } catch (err) {
      log(`Error processing ${item.prospect_email}: ${err.message}`);
      errorCount++;
    }
  }

  log(`Done: sent=${sentCount}, errors=${errorCount}, skipped=${skippedCount}`);
}

// ─── Advance Step ────────────────────────────────────────────────────────────

async function advanceToNextStep(item) {
  const { data: nextStep } = await supabase
    .from("sequence_steps")
    .select("*")
    .eq("campaign_id", item.campaign_id)
    .gt("step_order", item.current_step_order || 0)
    .eq("is_active", true)
    .order("step_order", { ascending: true })
    .limit(1)
    .single();

  if (!nextStep) {
    await supabase
      .from("campaign_prospects")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        current_step_id: null,
        next_send_at: null,
      })
      .eq("id", item.campaign_prospect_id);
    return;
  }

  if (nextStep.step_type === "delay") {
    const delayMs =
      (nextStep.delay_days || 0) * 86400000 +
      (nextStep.delay_hours || 0) * 3600000;
    const nextSendAt = new Date(Date.now() + delayMs);

    // Find the action step after the delay
    const { data: actionStep } = await supabase
      .from("sequence_steps")
      .select("*")
      .eq("campaign_id", item.campaign_id)
      .gt("step_order", nextStep.step_order)
      .eq("is_active", true)
      .order("step_order", { ascending: true })
      .limit(1)
      .single();

    if (actionStep) {
      await supabase
        .from("campaign_prospects")
        .update({
          current_step_id: actionStep.id,
          next_send_at: nextSendAt.toISOString(),
        })
        .eq("id", item.campaign_prospect_id);
    } else {
      await supabase
        .from("campaign_prospects")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_step_id: null,
          next_send_at: null,
        })
        .eq("id", item.campaign_prospect_id);
    }
  } else {
    await supabase
      .from("campaign_prospects")
      .update({
        current_step_id: nextStep.id,
        next_send_at: new Date().toISOString(),
      })
      .eq("id", item.campaign_prospect_id);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────
main().catch((err) => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
