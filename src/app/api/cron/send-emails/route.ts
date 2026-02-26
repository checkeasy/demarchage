import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend-client";
import {
  mergeTemplate,
  prospectToTemplateData,
} from "@/lib/email/template-engine";
import { processEmailForTracking } from "@/lib/email/tracking";
import { isWithinSendingWindow, getNextSendTime } from "@/lib/email/scheduler";

const BATCH_SIZE = 10;

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

    for (const item of queue) {
      try {
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
          // Handle non-email steps (LinkedIn tasks, etc.)
          if (step?.step_type === "linkedin_connect" || step?.step_type === "linkedin_message") {
            await handleLinkedInStep(supabase, item, step);
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
        const trackingId = crypto.randomUUID();
        const processedBody = processEmailForTracking(
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

        // Send via Resend
        const result = await sendEmail({
          from: emailRecord.from_email,
          to: item.prospect_email,
          subject: mergedSubject,
          html: processedBody,
          text: mergedText,
        });

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
