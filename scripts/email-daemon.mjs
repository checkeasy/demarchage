#!/usr/bin/env node

// Email sending daemon - runs continuously via PM2
// Envoie les emails via Gmail SMTP toutes les 15 minutes
// Heures: 8h-18h Paris (lundi-vendredi)
//
// Start: pm2 start scripts/email-daemon.mjs --name email-cron
// Stop:  pm2 stop email-cron
// Logs:  pm2 logs email-cron

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
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MIN_DELAY_MS = 2000;
const MAX_DELAY_MS = 5000;

// Business hours in Europe/Paris
const WORK_HOUR_START = 8;
const WORK_HOUR_END = 18;
const WORK_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

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

function isBusinessHours() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const dayName = parts.find((p) => p.type === "weekday")?.value || "";
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[dayName] ?? 0;

  return WORK_DAYS.includes(day) && hour >= WORK_HOUR_START && hour < WORK_HOUR_END;
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
    return true;
  }
}

// ─── Send Batch ──────────────────────────────────────────────────────────────

async function processBatch() {
  // Check business hours
  if (!isBusinessHours()) {
    log("Outside business hours (8h-18h Paris, Mon-Fri). Skipping.");
    return;
  }

  log("Processing email queue...");

  // Count emails sent today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: sentToday } = await supabase
    .from("emails_sent")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", todayStart.toISOString())
    .eq("status", "sent");

  // Get daily limit
  const { data: account } = await supabase
    .from("email_accounts")
    .select("daily_limit")
    .eq("email_address", GMAIL_USER)
    .single();

  const dailyLimit = account?.daily_limit || 30;
  const alreadySent = sentToday || 0;
  const remaining = Math.max(0, dailyLimit - alreadySent);

  log(`Today: ${alreadySent}/${dailyLimit} sent (${remaining} remaining)`);

  if (remaining <= 0) {
    log("Daily limit reached.");
    return;
  }

  // Fetch queue
  const { data: queue, error: queueError } = await supabase
    .from("email_send_queue")
    .select("*")
    .limit(Math.min(BATCH_SIZE, remaining));

  if (queueError) {
    log(`Queue error: ${queueError.message}`);
    return;
  }

  if (!queue || queue.length === 0) {
    log("Queue empty.");
    return;
  }

  log(`${queue.length} emails to process`);

  let sentCount = 0;
  let errorCount = 0;

  for (const item of queue) {
    try {
      // Skip low score emails
      if (item.email_validity_score !== null && item.email_validity_score < MIN_EMAIL_SCORE) {
        log(`Skip ${item.prospect_email}: score ${item.email_validity_score}`);
        await advanceToNextStep(item);
        continue;
      }

      // Check sending window
      if (!isWithinSendingWindow(item.timezone, item.sending_window_start, item.sending_window_end, item.sending_days)) {
        continue;
      }

      // Get step
      const { data: step } = await supabase
        .from("sequence_steps")
        .select("*")
        .eq("id", item.current_step_id)
        .single();

      if (!step || step.step_type !== "email") {
        await advanceToNextStep(item);
        continue;
      }

      // Build email content
      let subject = step.subject || "";
      let bodyHtml = step.body_html || "";
      let bodyText = step.body_text || "";
      let variantId = null;

      // A/B testing
      if (step.ab_enabled) {
        const { data: variants } = await supabase.from("ab_variants").select("*").eq("step_id", step.id);
        if (variants?.length > 0) {
          if (step.ab_winner_variant_id) {
            const w = variants.find((v) => v.id === step.ab_winner_variant_id);
            if (w) { subject = w.subject; bodyHtml = w.body_html || bodyHtml; bodyText = w.body_text || bodyText; variantId = w.id; }
          } else {
            const total = variants.reduce((s, v) => s + v.weight, 0);
            let r = Math.random() * total;
            for (const v of variants) { r -= v.weight; if (r <= 0) { subject = v.subject; bodyHtml = v.body_html || bodyHtml; bodyText = v.body_text || bodyText; variantId = v.id; break; } }
          }
        }
      }

      // Template data
      const td = {
        firstName: item.prospect_first_name || "", prenom: item.prospect_first_name || "",
        lastName: item.prospect_last_name || "", nom: item.prospect_last_name || "",
        company: item.prospect_company || "", entreprise: item.prospect_company || "",
        email: item.prospect_email || "",
      };
      if (item.custom_fields && typeof item.custom_fields === "object") {
        for (const [k, v] of Object.entries(item.custom_fields)) td[k] = String(v || "");
      }

      const mergedSubject = mergeTemplate(subject, td);
      let mergedBody = mergeTemplate(bodyHtml, td);
      const mergedText = bodyText ? mergeTemplate(bodyText, td) : undefined;

      if (item.signature_html) mergedBody += `<br/><br/>${item.signature_html}`;

      const fromEmail = item.from_display_name
        ? `${item.from_display_name} <${item.from_email_address}>`
        : item.from_email_address;

      // Record in DB
      const trackingId = crypto.randomUUID();
      const { data: rec, error: insErr } = await supabase
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

      if (insErr || !rec) { errorCount++; continue; }

      // Delay between sends
      if (sentCount > 0) await randomDelay();

      // SEND
      const info = await transporter.sendMail({
        from: fromEmail,
        to: item.prospect_email,
        subject: mergedSubject,
        html: mergedBody,
        text: mergedText || mergedBody.replace(/<[^>]*>/g, ""),
        replyTo: item.from_email_address,
      });

      await supabase.from("emails_sent").update({ status: "sent", sent_at: new Date().toISOString(), resend_message_id: info.messageId }).eq("id", rec.id);
      await supabase.rpc("increment_campaign_stat", { p_campaign_id: item.campaign_id, p_column: "total_sent" });
      if (variantId) await supabase.rpc("increment_ab_variant_stat", { p_variant_id: variantId, p_column: "total_sent" });
      await supabase.from("prospects").update({ last_contacted_at: new Date().toISOString() }).eq("id", item.prospect_id);

      sentCount++;
      log(`SENT -> ${item.prospect_email} | "${mergedSubject}"`);
      await advanceToNextStep(item);
    } catch (err) {
      log(`ERROR ${item.prospect_email}: ${err.message}`);
      errorCount++;
    }
  }

  log(`Batch done: ${sentCount} sent, ${errorCount} errors`);
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
    await supabase.from("campaign_prospects").update({
      status: "completed", completed_at: new Date().toISOString(),
      current_step_id: null, next_send_at: null,
    }).eq("id", item.campaign_prospect_id);
    return;
  }

  if (nextStep.step_type === "delay") {
    const delayMs = (nextStep.delay_days || 0) * 86400000 + (nextStep.delay_hours || 0) * 3600000;
    const nextSendAt = new Date(Date.now() + delayMs);
    const { data: actionStep } = await supabase
      .from("sequence_steps").select("*")
      .eq("campaign_id", item.campaign_id)
      .gt("step_order", nextStep.step_order)
      .eq("is_active", true)
      .order("step_order", { ascending: true })
      .limit(1).single();

    if (actionStep) {
      await supabase.from("campaign_prospects").update({
        current_step_id: actionStep.id, next_send_at: nextSendAt.toISOString(),
      }).eq("id", item.campaign_prospect_id);
    } else {
      await supabase.from("campaign_prospects").update({
        status: "completed", completed_at: new Date().toISOString(),
        current_step_id: null, next_send_at: null,
      }).eq("id", item.campaign_prospect_id);
    }
  } else {
    await supabase.from("campaign_prospects").update({
      current_step_id: nextStep.id, next_send_at: new Date().toISOString(),
    }).eq("id", item.campaign_prospect_id);
  }
}

// ─── Daemon Loop ─────────────────────────────────────────────────────────────

log("Email daemon started");
log(`Interval: ${INTERVAL_MS / 60000} min | Limit: check DB | Hours: ${WORK_HOUR_START}h-${WORK_HOUR_END}h Paris`);

// Run immediately
processBatch().catch((e) => log(`Batch error: ${e.message}`));

// Then every 15 minutes
setInterval(() => {
  processBatch().catch((e) => log(`Batch error: ${e.message}`));
}, INTERVAL_MS);
