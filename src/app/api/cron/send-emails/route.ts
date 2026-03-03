import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend-client";
import { sendGmail } from "@/lib/email/gmail-sender";
import {
  mergeTemplate,
  prospectToTemplateData,
} from "@/lib/email/template-engine";
import { processEmailForTracking } from "@/lib/email/tracking";
import { isWithinSendingWindow, getNextSendTime } from "@/lib/email/scheduler";
import {
  getWhatsAppClient,
  formatPhoneNumber,
} from "@/lib/whatsapp/client";
import {
  canPerformAction as canWhatsApp,
  recordAction as recordWhatsApp,
  logWhatsAppAction,
} from "@/lib/whatsapp/rate-limiter";
import { WhatsAppActionType } from "@/lib/whatsapp/types";

const BATCH_SIZE = 10;
const MIN_EMAIL_SCORE = 40; // Ne pas envoyer aux emails avec score < 40

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Fetch emails ready to send from the queue view
    const { data: queue, error: queueError } = await supabase
      .from("email_send_queue")
      .select("*")
      .limit(BATCH_SIZE);

    if (queueError) {
      return NextResponse.json(
        { error: "Failed to fetch queue", details: queueError.message },
        { status: 500 }
      );
    }

    if (!queue || queue.length === 0) {
      return NextResponse.json({ message: "No emails to send", sent: 0 });
    }

    let sentCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Check how many emails were already sent today for each account
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todaySent } = await supabase
      .from("emails_sent")
      .select("email_account_id")
      .gte("sent_at", todayStart.toISOString())
      .eq("status", "sent");

    const sentTodayByAccount: Record<string, number> = {};
    if (todaySent) {
      for (const e of todaySent) {
        const accId = e.email_account_id as string;
        sentTodayByAccount[accId] = (sentTodayByAccount[accId] || 0) + 1;
      }
    }

    for (const item of queue) {
      try {
        // Check daily limit for this account
        const accountId = item.email_account_id as string;
        const dailyLimit = (item.account_daily_limit as number) || 30;
        const alreadySent = sentTodayByAccount[accountId] || 0;
        if (alreadySent + sentCount >= dailyLimit) {
          skippedCount++;
          continue;
        }

        // Skip prospects with low email validity score
        const emailScore = item.email_validity_score as number | null;
        if (emailScore !== null && emailScore < MIN_EMAIL_SCORE) {
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
          continue;
        }

        // Get the current step content
        const { data: step } = await supabase
          .from("sequence_steps")
          .select("*")
          .eq("id", item.current_step_id)
          .single();

        if (!step || step.step_type !== "email") {
          // Handle non-email steps (LinkedIn tasks, WhatsApp, etc.)
          if (step?.step_type === "linkedin_connect" || step?.step_type === "linkedin_message") {
            await handleLinkedInStep(supabase, item, step);
          } else if (step?.step_type === "whatsapp") {
            await handleWhatsAppStep(supabase, item, step);
          }
          await advanceToNextStep(supabase, item);
          continue;
        }

        // Handle A/B variant selection
        let subject = step.subject || "";
        let bodyHtml = step.body_html || "";
        let bodyText = step.body_text || "";
        let variantId: string | null = null;

        if (step.ab_enabled) {
          const { data: variants } = await supabase
            .from("ab_variants")
            .select("*")
            .eq("step_id", step.id);

          if (variants && variants.length > 0) {
            // Check if winner already determined
            if (step.ab_winner_variant_id) {
              const winner = variants.find(
                (v) => v.id === step.ab_winner_variant_id
              );
              if (winner) {
                subject = winner.subject;
                bodyHtml = winner.body_html || bodyHtml;
                bodyText = winner.body_text || bodyText;
                variantId = winner.id;
              }
            } else {
              // Weighted random selection
              const totalWeight = variants.reduce(
                (sum, v) => sum + v.weight,
                0
              );
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

        // Merge template variables (use view column aliases)
        const templateData = prospectToTemplateData({
          email: item.prospect_email,
          first_name: item.prospect_first_name,
          last_name: item.prospect_last_name,
          company: item.prospect_company,
          custom_fields: item.custom_fields,
        });

        // Add booking URL from email account
        const bookingUrl = (item as Record<string, unknown>).booking_url as string | null;
        if (bookingUrl) {
          templateData.bookingUrl = bookingUrl;
          templateData.bookingLink = `<a href="${bookingUrl}" target="_blank">Reserver un creneau</a>`;
        }

        const mergedSubject = mergeTemplate(subject, templateData);
        let mergedBody = mergeTemplate(bodyHtml, templateData);
        const mergedText = bodyText
          ? mergeTemplate(bodyText, templateData)
          : undefined;

        // Append signature if present
        if (item.signature_html) {
          mergedBody += `<br/><br/>${item.signature_html}`;
        }

        // Generate tracking ID and process for tracking
        // Skip tracking for Gmail (personal emails should not have tracking pixels)
        const isGmail = ((item.email_provider as string) || "gmail") === "gmail";
        const trackingId = crypto.randomUUID();
        const processedBody = isGmail
          ? mergedBody
          : processEmailForTracking(
              mergedBody,
              trackingId,
              item.track_opens,
              item.track_clicks
            );

        // Insert emails_sent record with 'sending' status first (prevent duplicates)
        const { data: emailRecord, error: insertError } = await supabase
          .from("emails_sent")
          .insert({
            campaign_prospect_id: item.campaign_prospect_id,
            step_id: step.id,
            ab_variant_id: variantId,
            email_account_id: item.email_account_id,
            from_email: item.from_display_name
              ? `${item.from_display_name} <${item.from_email_address}>`
              : item.from_email_address,
            to_email: item.prospect_email,
            subject: mergedSubject,
            body_html: processedBody,
            body_text: mergedText,
            tracking_id: trackingId,
            status: "sending",
          })
          .select()
          .single();

        if (insertError || !emailRecord) {
          errorCount++;
          continue;
        }

        // Send via Gmail SMTP or Resend based on provider
        const provider = (item.email_provider as string) || "gmail";
        let result: { success: boolean; messageId?: string; error?: string };

        if (provider === "gmail") {
          // Delay aleatoire 2-5s entre emails pour simuler envoi humain
          if (sentCount > 0) {
            const delay = 2000 + Math.random() * 3000;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          result = await sendGmail({
            to: item.prospect_email as string,
            subject: mergedSubject,
            html: processedBody,
            text: mergedText,
            from: emailRecord.from_email,
          });
        } else {
          result = await sendEmail({
            from: emailRecord.from_email,
            to: item.prospect_email as string,
            subject: mergedSubject,
            html: processedBody,
            text: mergedText,
          });
        }

        if (result.success) {
          // Update email record
          await supabase
            .from("emails_sent")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              resend_message_id: result.messageId,
            })
            .eq("id", emailRecord.id);

          // Increment campaign sent count
          await supabase.rpc("increment_campaign_stat", {
            p_campaign_id: item.campaign_id,
            p_column: "total_sent",
          });

          // Update A/B variant sent count
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
        } else {
          // Mark as failed
          await supabase
            .from("emails_sent")
            .update({
              status: "failed",
              error_message: result.error,
            })
            .eq("id", emailRecord.id);

          errorCount++;
        }

        // Advance to next step
        await advanceToNextStep(supabase, item);
      } catch (err) {
        console.error("Error sending email:", err);
        errorCount++;
      }
    }

    return NextResponse.json({
      message: "Cron completed",
      sent: sentCount,
      errors: errorCount,
      skipped: skippedCount,
      processed: queue.length,
    });
  } catch (err) {
    console.error("Cron error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function advanceToNextStep(
  supabase: ReturnType<typeof createAdminClient>,
  item: Record<string, unknown>
) {
  // Get the next step in the sequence
  const { data: nextStep } = await supabase
    .from("sequence_steps")
    .select("*")
    .eq("campaign_id", item.campaign_id as string)
    .gt("step_order", (item.current_step_order as number) || 0)
    .eq("is_active", true)
    .order("step_order", { ascending: true })
    .limit(1)
    .single();

  if (!nextStep) {
    // No more steps - mark prospect as completed
    await supabase
      .from("campaign_prospects")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        current_step_id: null,
        next_send_at: null,
      })
      .eq("id", item.campaign_prospect_id as string);
    return;
  }

  // Calculate next send time based on delay
  let nextSendAt: Date;

  if (nextStep.step_type === "delay") {
    // Calculate the send time after the delay
    nextSendAt = getNextSendTime(
      (item.timezone as string) || "Europe/Paris",
      (item.sending_window_start as string) || "08:00",
      (item.sending_window_end as string) || "18:00",
      (item.sending_days as number[]) || [1, 2, 3, 4, 5],
      nextStep.delay_days,
      nextStep.delay_hours
    );

    // Skip the delay step and look for the next action step
    const { data: actionStep } = await supabase
      .from("sequence_steps")
      .select("*")
      .eq("campaign_id", item.campaign_id as string)
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
        .eq("id", item.campaign_prospect_id as string);
    } else {
      // No action step after delay - complete
      await supabase
        .from("campaign_prospects")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_step_id: null,
          next_send_at: null,
        })
        .eq("id", item.campaign_prospect_id as string);
    }
  } else {
    // Direct action step - send immediately (within window)
    nextSendAt = getNextSendTime(
      (item.timezone as string) || "Europe/Paris",
      (item.sending_window_start as string) || "08:00",
      (item.sending_window_end as string) || "18:00",
      (item.sending_days as number[]) || [1, 2, 3, 4, 5],
      0,
      0
    );

    await supabase
      .from("campaign_prospects")
      .update({
        current_step_id: nextStep.id,
        next_send_at: nextSendAt.toISOString(),
      })
      .eq("id", item.campaign_prospect_id as string);
  }
}

async function handleLinkedInStep(
  supabase: ReturnType<typeof createAdminClient>,
  item: Record<string, unknown>,
  step: Record<string, unknown>
) {
  // Create a LinkedIn task for manual execution
  await supabase.from("linkedin_tasks").insert({
    workspace_id: item.workspace_id,
    campaign_prospect_id: item.campaign_prospect_id,
    prospect_id: item.prospect_id,
    step_id: step.id,
    task_type:
      step.step_type === "linkedin_connect" ? "connect" : "message",
    message: step.linkedin_message || step.body_text,
    status: "pending",
    due_at: new Date().toISOString(),
  });
}

async function handleWhatsAppStep(
  supabase: ReturnType<typeof createAdminClient>,
  item: Record<string, unknown>,
  step: Record<string, unknown>
) {
  const workspaceId = item.workspace_id as string;
  const prospectId = item.prospect_id as string;
  const campaignId = item.campaign_id as string;

  // Get campaign creator for per-user WhatsApp
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("created_by")
    .eq("id", campaignId)
    .single();

  const userId = campaign?.created_by || workspaceId;

  // Get prospect phone number
  const { data: prospect } = await supabase
    .from("prospects")
    .select("phone, first_name, last_name, company, job_title")
    .eq("id", prospectId)
    .single();

  if (!prospect?.phone) {
    console.log(`[WhatsApp] Prospect ${prospectId} has no phone number, skipping`);
    await logWhatsAppAction({
      workspaceId,
      prospectId,
      phoneNumber: null,
      messageText: null,
      status: "invalid_number",
      errorMessage: "Pas de numero de telephone",
    });
    return;
  }

  // Check rate limit
  const allowed = await canWhatsApp(userId, WhatsAppActionType.MESSAGE);
  if (!allowed) {
    console.log(`[WhatsApp] Rate limit reached for user ${userId}`);
    await logWhatsAppAction({
      workspaceId,
      prospectId,
      phoneNumber: prospect.phone,
      messageText: null,
      status: "rate_limited",
      errorMessage: "Limite quotidienne atteinte",
    });
    return;
  }

  // Get WhatsApp client (per-user)
  let client;
  try {
    client = await getWhatsAppClient(userId);
  } catch {
    console.error(`[WhatsApp] Client not initialized for user ${userId}`);
    await logWhatsAppAction({
      workspaceId,
      prospectId,
      phoneNumber: prospect.phone,
      messageText: null,
      status: "failed",
      errorMessage: "Client WhatsApp non connecte",
    });
    return;
  }

  // Merge template variables
  let messageText = (step.whatsapp_message as string) || "";
  messageText = messageText
    .replace(/\{firstName\}/g, prospect.first_name || "")
    .replace(/\{prenom\}/g, prospect.first_name || "")
    .replace(/\{lastName\}/g, prospect.last_name || "")
    .replace(/\{nom\}/g, prospect.last_name || "")
    .replace(/\{company\}/g, prospect.company || "")
    .replace(/\{entreprise\}/g, prospect.company || "")
    .replace(/\{jobTitle\}/g, prospect.job_title || "")
    .replace(/\{poste\}/g, prospect.job_title || "");

  if (!messageText.trim()) {
    console.log(`[WhatsApp] Empty message for step ${step.id}, skipping`);
    return;
  }

  try {
    const formattedPhone = formatPhoneNumber(prospect.phone);
    const result = await client.sendMessage(formattedPhone, messageText);

    await recordWhatsApp(workspaceId, WhatsAppActionType.MESSAGE);

    await logWhatsAppAction({
      workspaceId,
      prospectId,
      phoneNumber: prospect.phone,
      messageText,
      status: "success",
      waMessageId: result?.messageId || null,
    });

    // Update prospect last_contacted_at
    await supabase
      .from("prospects")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", prospectId);

    console.log(`[WhatsApp] Message sent to ${prospect.phone}`);
  } catch (err) {
    console.error(`[WhatsApp] Send error:`, err);
    await logWhatsAppAction({
      workspaceId,
      prospectId,
      phoneNumber: prospect.phone,
      messageText,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Erreur inconnue",
    });
  }
}
