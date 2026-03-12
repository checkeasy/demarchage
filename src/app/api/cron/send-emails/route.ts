import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend-client";
import { sendGmail, type SmtpCredentials } from "@/lib/email/gmail-sender";
import { injectUnsubscribeLink } from "@/lib/email/tracking";
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
import { getOrchestrator } from "@/lib/agents/orchestrator";

const BATCH_SIZE = 10;
const MIN_EMAIL_SCORE = 75; // Ne pas envoyer aux emails avec score < 75

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Clean up stale "sending" records (crashed before completing)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase.from('emails_sent').update({ status: 'queued' }).eq('status', 'sending').lt('updated_at', fiveMinAgo);

    // --- A/B Winner Auto-Selection ---
    // Check steps where A/B testing is active but no winner has been selected yet
    const { data: abSteps } = await supabase
      .from("sequence_steps")
      .select("id, ab_winner_metric, ab_winner_after_hours, campaign_id")
      .eq("ab_enabled", true)
      .is("ab_winner_variant_id", null);

    if (abSteps && abSteps.length > 0) {
      for (const abStep of abSteps) {
        // Check if enough time has passed since the first email was sent for this step
        const { data: firstSent } = await supabase
          .from("emails_sent")
          .select("sent_at")
          .eq("step_id", abStep.id)
          .not("ab_variant_id", "is", null)
          .order("sent_at", { ascending: true })
          .limit(1)
          .single();

        if (!firstSent?.sent_at) continue;

        const hoursSince = (Date.now() - new Date(firstSent.sent_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < (abStep.ab_winner_after_hours || 24)) continue;

        // Calculate metrics per variant
        const { data: variants } = await supabase
          .from("ab_variants")
          .select("*")
          .eq("step_id", abStep.id);

        if (!variants || variants.length < 2) continue;

        const metric = abStep.ab_winner_metric || "open_rate";
        let bestVariant = variants[0];
        let bestScore = -1;

        for (const v of variants) {
          let score = 0;
          if (v.total_sent > 0) {
            if (metric === "open_rate") score = v.total_opened / v.total_sent;
            else if (metric === "click_rate") score = v.total_clicked / v.total_sent;
            else if (metric === "reply_rate") score = v.total_replied / v.total_sent;
          }
          if (score > bestScore) {
            bestScore = score;
            bestVariant = v;
          }
        }

        // Set winner
        await supabase
          .from("sequence_steps")
          .update({ ab_winner_variant_id: bestVariant.id })
          .eq("id", abStep.id);

        await supabase
          .from("ab_variants")
          .update({ is_winner: true })
          .eq("id", bestVariant.id);

        console.log(`[A/B] Winner selected for step ${abStep.id}: variant ${bestVariant.variant_label} (${metric}: ${(bestScore * 100).toFixed(1)}%)`);
      }
    }

    // --- Fix orphaned prospects (active but no current_step_id) ---
    const { data: orphanedCampaigns } = await supabase
      .from("campaign_prospects")
      .select("campaign_id")
      .eq("status", "active")
      .is("current_step_id", null);

    if (orphanedCampaigns && orphanedCampaigns.length > 0) {
      const uniqueCampaignIds = [...new Set(orphanedCampaigns.map((o) => o.campaign_id))];
      for (const cId of uniqueCampaignIds) {
        const { data: step1 } = await supabase
          .from("sequence_steps")
          .select("id")
          .eq("campaign_id", cId)
          .order("step_order", { ascending: true })
          .limit(1)
          .single();

        if (step1) {
          const { data: fixed } = await supabase
            .from("campaign_prospects")
            .update({ current_step_id: step1.id, next_send_at: new Date().toISOString() })
            .eq("campaign_id", cId)
            .eq("status", "active")
            .is("current_step_id", null)
            .select("id");

          if (fixed && fixed.length > 0) {
            console.log(`[Cron] Fixed ${fixed.length} orphaned prospects in campaign ${cId}`);
          }
        }
      }
    }

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

    // --- Bulk-fetch steps and AB variants to avoid N+1 queries ---
    const uniqueStepIds = [...new Set(queue.map((q) => q.current_step_id as string).filter(Boolean))];

    const stepsMap = new Map<string, Record<string, unknown>>();
    if (uniqueStepIds.length > 0) {
      const { data: stepsData } = await supabase
        .from("sequence_steps")
        .select("*")
        .in("id", uniqueStepIds);
      if (stepsData) {
        for (const s of stepsData) {
          stepsMap.set(s.id as string, s);
        }
      }
    }

    // Bulk-fetch AB variants for all steps that have ab_enabled
    const abEnabledStepIds = [...stepsMap.values()]
      .filter((s) => s.ab_enabled)
      .map((s) => s.id as string);

    const variantsByStepId = new Map<string, Record<string, unknown>[]>();
    if (abEnabledStepIds.length > 0) {
      const { data: variantsData } = await supabase
        .from("ab_variants")
        .select("*")
        .in("step_id", abEnabledStepIds);
      if (variantsData) {
        for (const v of variantsData) {
          const stepId = v.step_id as string;
          if (!variantsByStepId.has(stepId)) {
            variantsByStepId.set(stepId, []);
          }
          variantsByStepId.get(stepId)!.push(v);
        }
      }
    }

    // --- Bulk-fetch previous email subjects for AI generation (avoid N+1) ---
    const aiEnabledStepIds = [...stepsMap.values()]
      .filter((s) => s.use_ai_generation)
      .map((s) => s.id as string);

    const prevSubjectsByProspect = new Map<string, string[]>();
    if (aiEnabledStepIds.length > 0) {
      const aiProspectIds = queue
        .filter((q) => aiEnabledStepIds.includes(q.current_step_id as string))
        .map((q) => ({ campaignProspectId: q.campaign_prospect_id as string, prospectId: q.prospect_id as string }));

      if (aiProspectIds.length > 0) {
        const cpIds = aiProspectIds.map((p) => p.campaignProspectId);
        const { data: prevEmails } = await supabase
          .from("emails_sent")
          .select("campaign_prospect_id, subject")
          .in("campaign_prospect_id", cpIds)
          .order("sent_at", { ascending: true });

        if (prevEmails) {
          for (const e of prevEmails) {
            const cpId = e.campaign_prospect_id as string;
            if (!prevSubjectsByProspect.has(cpId)) {
              prevSubjectsByProspect.set(cpId, []);
            }
            if (e.subject) prevSubjectsByProspect.get(cpId)!.push(e.subject as string);
          }
        }
      }
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

    // --- Warmup: progressive volume based on Google recommendations ---
    // Schedule: 2→50 emails over 14 days, then linear ramp to target
    // Auto-protection: pause if bounce > 5% or complaint > 0.3%
    const { runWarmupCycle } = await import("@/lib/email/warmup");
    const warmupResult = await runWarmupCycle(supabase);
    if (warmupResult.updated > 0) {
      console.log(`[Cron] Warmup: ${warmupResult.updated} accounts updated`);
    }
    for (const hc of warmupResult.healthChecks) {
      if (hc.status !== "healthy") {
        console.log(`[Cron] Health: ${hc.emailAddress} → ${hc.status}: ${hc.message}`);
      }
    }

    // --- Pre-fetch rotation accounts for campaigns that have them ---
    const uniqueCampaignIds = [...new Set(queue.map((q) => q.campaign_id as string))];
    const rotationAccountsMap = new Map<string, Record<string, unknown>[]>();

    if (uniqueCampaignIds.length > 0) {
      const { data: rotationRows } = await supabase
        .from("campaign_email_accounts")
        .select(`
          campaign_id,
          email_account_id,
          priority,
          is_active,
          emails_sent_today,
          last_used_at
        `)
        .in("campaign_id", uniqueCampaignIds)
        .eq("is_active", true)
        .order("last_used_at", { ascending: true, nullsFirst: true });

      if (rotationRows) {
        for (const row of rotationRows) {
          const cid = row.campaign_id as string;
          if (!rotationAccountsMap.has(cid)) rotationAccountsMap.set(cid, []);
          rotationAccountsMap.get(cid)!.push(row);
        }
      }
    }

    // --- Pre-fetch previous emails for threading (avoid N+1 in send loop) ---
    const threadingCpIds = queue
      .filter((q) => ((q.current_step_order as number) || 1) > 1)
      .map((q) => q.campaign_prospect_id as string);

    const threadingEmailsMap = new Map<string, { resend_message_id: string | null; subject: string | null }>();
    if (threadingCpIds.length > 0) {
      const { data: threadingEmails } = await supabase
        .from("emails_sent")
        .select("campaign_prospect_id, resend_message_id, subject, sent_at")
        .in("campaign_prospect_id", threadingCpIds)
        .eq("status", "sent")
        .order("sent_at", { ascending: false });

      if (threadingEmails) {
        // Store only the most recent email per campaign_prospect_id
        for (const e of threadingEmails) {
          const cpId = e.campaign_prospect_id as string;
          if (!threadingEmailsMap.has(cpId)) {
            threadingEmailsMap.set(cpId, {
              resend_message_id: e.resend_message_id as string | null,
              subject: e.subject as string | null,
            });
          }
        }
      }
    }

    // Pre-fetch email account details for rotation accounts
    const rotationAccountIds = new Set<string>();
    for (const rows of rotationAccountsMap.values()) {
      for (const r of rows) rotationAccountIds.add(r.email_account_id as string);
    }
    const rotationAccountDetails = new Map<string, Record<string, unknown>>();
    if (rotationAccountIds.size > 0) {
      const { data: accDetails } = await supabase
        .from("email_accounts")
        .select("*")
        .in("id", [...rotationAccountIds])
        .eq("is_active", true);
      if (accDetails) {
        for (const a of accDetails) rotationAccountDetails.set(a.id as string, a);
      }
    }

    for (const item of queue) {
      try {
        // --- Account selection: rotation or default ---
        let accountId = item.email_account_id as string;
        let activeAccount: Record<string, unknown> | null = null;

        const rotationAccounts = rotationAccountsMap.get(item.campaign_id as string);
        if (rotationAccounts && rotationAccounts.length > 0) {
          // Pick the rotation account with capacity (round-robin by last_used_at)
          for (const ra of rotationAccounts) {
            const accId = ra.email_account_id as string;
            const details = rotationAccountDetails.get(accId);
            if (!details || !(details.is_active)) continue;
            if ((details.health_score as number) <= 30) continue;

            const accDailyLimit = (details.daily_limit as number) || 30;
            const providerMax = (details.provider_daily_max as number) || 500;
            const effectiveLimit = Math.min(accDailyLimit, providerMax);
            const alreadySentForAcc = sentTodayByAccount[accId] || 0;

            if (alreadySentForAcc < effectiveLimit) {
              accountId = accId;
              activeAccount = details;
              break;
            }
          }
        }

        // Build effective account data (rotation override or default from queue)
        const warmupEnabled = activeAccount
          ? (activeAccount.warmup_enabled as boolean)
          : (item.warmup_enabled as boolean);
        const warmupCurrentVolume = activeAccount
          ? ((activeAccount.warmup_current_volume as number) || 0)
          : ((item.warmup_current_volume as number) || 0);
        const baseDailyLimit = activeAccount
          ? ((activeAccount.daily_limit as number) || 30)
          : ((item.account_daily_limit as number) || 30);
        const providerDailyMax = activeAccount
          ? ((activeAccount.provider_daily_max as number) || 500)
          : ((item.provider_daily_max as number) || 500);

        // Provider-specific rate limit (Phase 10)
        const effectiveMax = Math.min(baseDailyLimit, providerDailyMax);
        // If warmup is active, the effective limit is the warmup volume (progressive)
        const dailyLimit = warmupEnabled ? Math.min(warmupCurrentVolume, effectiveMax) : effectiveMax;
        const alreadySent = sentTodayByAccount[accountId] || 0;
        if (alreadySent >= dailyLimit) {
          skippedCount++;
          continue;
        }

        // Stop sequence for prospects with invalid email
        const emailScore = item.email_validity_score as number | null;
        if (emailScore !== null && emailScore < MIN_EMAIL_SCORE) {
          console.log(`[SendEmails] Stopping sequence for ${item.prospect_email}: email score ${emailScore}% < ${MIN_EMAIL_SCORE}%`);
          await supabase
            .from("campaign_prospects")
            .update({
              status: "error",
              status_reason: `Email invalide (score: ${emailScore}% — minimum requis: ${MIN_EMAIL_SCORE}%)`,
              next_send_at: null,
            })
            .eq("id", item.campaign_prospect_id);
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

        // Get the current step content from pre-fetched map
        const step = stepsMap.get(item.current_step_id as string) || null;

        if (!step || step.step_type !== "email") {
          // Handle non-email steps (LinkedIn tasks, WhatsApp, etc.)
          if (step?.step_type === "linkedin_connect" || step?.step_type === "linkedin_message") {
            await handleLinkedInStep(supabase, item, step);
            // Do NOT advance step — pause until LinkedIn task is marked done
            await supabase
              .from("campaign_prospects")
              .update({
                status: "paused",
                status_reason: "En attente de la tache LinkedIn",
              })
              .eq("id", item.campaign_prospect_id as string);
            continue;
          } else if (step?.step_type === "whatsapp") {
            await handleWhatsAppStep(supabase, item, step);
          }
          await advanceToNextStep(supabase, item);
          continue;
        }

        // Handle A/B variant selection
        let subject = (step.subject as string) || "";
        let bodyHtml = (step.body_html as string) || "";
        let bodyText = (step.body_text as string) || "";
        let variantId: string | null = null;

        if (step.ab_enabled) {
          const variants = variantsByStepId.get(step.id as string) || [];

          if (variants.length > 0) {
            // Check if winner already determined
            if (step.ab_winner_variant_id) {
              const winner = variants.find(
                (v) => v.id === step.ab_winner_variant_id
              );
              if (winner) {
                subject = (winner.subject as string) || subject;
                bodyHtml = (winner.body_html as string) || bodyHtml;
                bodyText = (winner.body_text as string) || bodyText;
                variantId = winner.id as string;
              }
            } else {
              // Weighted random selection
              const totalWeight = variants.reduce(
                (sum, v) => sum + ((v.weight as number) || 0),
                0
              );
              let random = Math.random() * totalWeight;
              for (const variant of variants) {
                random -= (variant.weight as number) || 0;
                if (random <= 0) {
                  subject = (variant.subject as string) || subject;
                  bodyHtml = (variant.body_html as string) || bodyHtml;
                  bodyText = (variant.body_text as string) || bodyText;
                  variantId = variant.id as string;
                  break;
                }
              }
            }
          }
        }

        // --- AI Generation (if enabled on this step) ---
        let aiGenerated = false;
        if (step.use_ai_generation) {
          try {
            const orchestrator = getOrchestrator();

            // Use pre-fetched subjects (bulk-loaded above)
            const previousSubjects = prevSubjectsByProspect.get(item.campaign_prospect_id as string) || [];

            const generated = await orchestrator.generateOutreach({
              workspaceId: item.workspace_id as string,
              prospectId: item.prospect_id as string,
              campaignId: item.campaign_id as string,
              channel: 'email',
              stepNumber: (step.step_order as number) || 1,
              previousSubjects,
              aiPromptContext: (step.ai_prompt_context as string) || undefined,
            });

            const aiEmail = generated.content as Record<string, unknown>;
            if (aiEmail.subject) subject = aiEmail.subject as string;
            if (aiEmail.body_html) bodyHtml = aiEmail.body_html as string;
            if (aiEmail.body_text) bodyText = aiEmail.body_text as string;
            aiGenerated = true;

            console.log(`[SendEmails] AI generated email for ${item.prospect_email} (cost: $${generated.metadata.costUsd.toFixed(4)})`);
          } catch (err) {
            // Fallback: send the static template (aiGenerated stays false)
            console.error(`[SendEmails] AI generation failed for ${item.prospect_email}, using template:`, err);
          }
        }

        // Merge template variables only for static templates (AI content is already personalized)
        let mergedSubject: string;
        let mergedBody: string;
        let mergedText: string | undefined;

        if (aiGenerated) {
          // AI already personalized — skip template merge to avoid stripping {words}
          mergedSubject = subject;
          mergedBody = bodyHtml;
          mergedText = bodyText || undefined;
        } else {
          const templateData = prospectToTemplateData({
            email: item.prospect_email as string,
            first_name: item.prospect_first_name as string | null,
            last_name: item.prospect_last_name as string | null,
            company: item.prospect_company as string | null,
            job_title: item.prospect_job_title as string | null,
            city: item.prospect_city as string | null,
            location: item.prospect_location as string | null,
            industry: item.prospect_industry as string | null,
            website: item.prospect_website as string | null,
            linkedin_url: item.prospect_linkedin_url as string | null,
            phone: item.prospect_phone as string | null,
            custom_fields: item.custom_fields as Record<string, string> | null,
          });

          // Add booking URL from email account
          const bookingUrl = (item as Record<string, unknown>).booking_url as string | null;
          if (bookingUrl) {
            templateData.bookingUrl = bookingUrl;
            templateData.bookingLink = `<a href="${bookingUrl}" target="_blank">Reserver un creneau</a>`;
          }

          mergedSubject = mergeTemplate(subject, templateData);
          mergedBody = mergeTemplate(bodyHtml, templateData);
          mergedText = bodyText
            ? mergeTemplate(bodyText, templateData)
            : undefined;
        }

        // Safety: detect unresolved template variables (e.g. leftover {someVar})
        if (!aiGenerated) {
          const unresolvedInBody = (mergedBody.match(/\{(?!#if|\/if|#else)(\w+)\}/g) || []);
          const unresolvedInSubject = (mergedSubject.match(/\{(?!#if|\/if|#else)(\w+)\}/g) || []);
          const allUnresolved = [...new Set([...unresolvedInSubject, ...unresolvedInBody])];
          if (allUnresolved.length > 0) {
            console.warn(`[SendEmails] Skipping ${item.prospect_email}: unresolved variables: ${allUnresolved.join(', ')}`);
            await supabase
              .from("campaign_prospects")
              .update({ next_send_at: null, status: "error", status_reason: `Variables non resolues: ${allUnresolved.join(', ')}` })
              .eq("id", item.campaign_prospect_id);
            skippedCount++;
            continue;
          }
        }

        // Safety: skip if subject is empty after merge (missing variables)
        if (!mergedSubject || mergedSubject.trim().length < 3) {
          console.warn(`[SendEmails] Skipping email for prospect ${item.prospect_email}: subject too short after merge ("${mergedSubject}"). Original: "${subject}"`);
          await supabase
            .from("campaign_prospects")
            .update({ next_send_at: null, status: "error", status_reason: "Sujet vide apres fusion des variables" })
            .eq("id", item.campaign_prospect_id);
          skippedCount++;
          continue;
        }

        // Threading: look up previous email for follow-ups (step_order > 1) using pre-fetched map
        let inReplyTo: string | undefined;
        let references: string | undefined;
        const currentStepOrder = (item.current_step_order as number) || 1;
        if (currentStepOrder > 1) {
          const prevEmail = threadingEmailsMap.get(item.campaign_prospect_id as string);

          if (prevEmail?.resend_message_id) {
            const prevMsgId = prevEmail.resend_message_id.includes("<")
              ? prevEmail.resend_message_id
              : `<${prevEmail.resend_message_id}>`;
            inReplyTo = prevMsgId;
            references = prevMsgId;

            // Prepend "Re: " to subject if not already present and original subject is available
            if (prevEmail.subject && !mergedSubject.toLowerCase().startsWith("re:")) {
              mergedSubject = `Re: ${prevEmail.subject}`;
            }
          }
        }

        // Resolve account data: use rotation account or default from queue
        const fromEmailAddress = activeAccount
          ? (activeAccount.email_address as string)
          : (item.from_email_address as string);
        const fromDisplayName = activeAccount
          ? (activeAccount.display_name as string) || ""
          : (item.from_display_name as string) || "";
        const signatureHtml = activeAccount
          ? (activeAccount.signature_html as string)
          : (item.signature_html as string);
        const accountProvider = activeAccount
          ? (activeAccount.provider as string)
          : (item.email_provider as string) || "gmail";
        const accountBookingUrl = activeAccount
          ? (activeAccount.booking_url as string | null)
          : (item.booking_url as string | null);

        // Append signature if present
        if (signatureHtml) {
          mergedBody += `<br/><br/>${signatureHtml}`;
        }

        // Generate tracking ID and process for tracking (all providers including Gmail)
        // Use custom tracking domain if configured (Phase 9)
        const trackingId = crypto.randomUUID();
        const trackingDomain = activeAccount
          ? (activeAccount.tracking_domain as string | null)
          : (item.tracking_domain as string | null);
        const appBaseUrl = trackingDomain || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
        let processedBody = processEmailForTracking(
          mergedBody,
          trackingId,
          item.track_opens,
          item.track_clicks,
          appBaseUrl
        );

        // Inject unsubscribe link at bottom of email
        processedBody = injectUnsubscribeLink(processedBody, trackingId, appBaseUrl);

        // Build from address
        const fromField = fromDisplayName
          ? `${fromDisplayName} <${fromEmailAddress}>`
          : fromEmailAddress;

        // Insert emails_sent record with 'sending' status first (prevent duplicates)
        const { data: emailRecord, error: insertError } = await supabase
          .from("emails_sent")
          .insert({
            campaign_prospect_id: item.campaign_prospect_id,
            step_id: step.id,
            ab_variant_id: variantId,
            email_account_id: accountId,
            from_email: fromField,
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

        // Build List-Unsubscribe headers
        const unsubscribeUrl = `${appBaseUrl}/api/unsubscribe/${trackingId}`;
        const listUnsubscribeHeaders: Record<string, string> = {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        };

        // Build SMTP credentials (from rotation account or queue item)
        let smtpCredentials: SmtpCredentials | undefined;
        const smtpHost = activeAccount ? (activeAccount.smtp_host as string) : (item.smtp_host as string);
        const smtpUser = activeAccount ? (activeAccount.smtp_user as string) : (item.smtp_user as string);
        const smtpPass = activeAccount ? (activeAccount.smtp_pass_encrypted as string) : (item.smtp_pass_encrypted as string);
        if (smtpHost && smtpUser && smtpPass) {
          smtpCredentials = {
            host: smtpHost,
            port: activeAccount ? ((activeAccount.smtp_port as number) || 587) : ((item.smtp_port as number) || 587),
            user: smtpUser,
            pass: smtpPass,
          };
        }

        // Send via SMTP with Resend fallback
        const provider = accountProvider;
        let result: { success: boolean; messageId?: string; error?: string };

        // Build the Resend-compatible from address
        const fromEmail = fromEmailAddress || "adrien@checkeasy.co";
        const fromName = fromDisplayName;
        const resendFrom = fromName
          ? `${fromName} <${fromEmail.replace(/@checkeasy\.co$/, "@send.checkeasy.co")}>`
          : fromEmail.replace(/@checkeasy\.co$/, "@send.checkeasy.co");

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
            smtpCredentials,
            headers: listUnsubscribeHeaders,
            inReplyTo,
            references,
          });

          // Fallback to Resend if Gmail SMTP fails (e.g. port blocked on cloud)
          if (!result.success && (result.error?.includes("timeout") || result.error?.includes("ENETUNREACH") || result.error?.includes("ECONNREFUSED"))) {
            console.log(`[SendEmails] Gmail SMTP failed for ${item.prospect_email}, falling back to Resend: ${result.error}`);
            result = await sendEmail({
              from: resendFrom,
              to: item.prospect_email as string,
              subject: mergedSubject,
              html: processedBody,
              text: mergedText,
              replyTo: fromEmail,
              headers: listUnsubscribeHeaders,
            });
          }
        } else {
          result = await sendEmail({
            from: resendFrom,
            to: item.prospect_email as string,
            subject: mergedSubject,
            html: processedBody,
            text: mergedText,
            headers: listUnsubscribeHeaders,
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

          // Update rotation account usage (if using rotation)
          if (rotationAccounts && rotationAccounts.length > 0) {
            await supabase
              .from("campaign_email_accounts")
              .update({
                emails_sent_today: (sentTodayByAccount[accountId] || 0) + 1,
                last_used_at: new Date().toISOString(),
              })
              .eq("campaign_id", item.campaign_id)
              .eq("email_account_id", accountId);
          }

          // Track per-account sent count for this batch
          sentTodayByAccount[accountId] = (sentTodayByAccount[accountId] || 0) + 1;
          sentCount++;
        } else {
          // Mark email as failed
          await supabase
            .from("emails_sent")
            .update({
              status: "failed",
              error_message: result.error,
            })
            .eq("id", emailRecord.id);

          // Detect hard bounce (550, 551, 552, 553, 554) → stop sequence
          const errorMsg = (result.error || "").toLowerCase();
          const isHardBounce = /\b55[0-4]\b/.test(errorMsg)
            || errorMsg.includes("user unknown")
            || errorMsg.includes("address rejected")
            || errorMsg.includes("mailbox not found")
            || errorMsg.includes("does not exist")
            || errorMsg.includes("no such user")
            || errorMsg.includes("invalid recipient");

          if (isHardBounce) {
            console.log(`[SendEmails] Hard bounce for ${item.prospect_email}: ${result.error}`);
            await supabase
              .from("campaign_prospects")
              .update({
                status: "bounced",
                status_reason: `Email introuvable : ${result.error}`,
                next_send_at: null,
              })
              .eq("id", item.campaign_prospect_id);

            // Also mark the prospect's email as invalid
            await supabase
              .from("prospects")
              .update({ email_validity_score: 0 })
              .eq("id", item.prospect_id);

            // Increment campaign bounce count
            await supabase.rpc("increment_campaign_stat", {
              p_campaign_id: item.campaign_id,
              p_column: "total_bounced",
            });
          } else {
            // Soft failure (temp error) - do NOT advance, retry on next cron run
            // Keep current step and next_send_at so it gets picked up again
            console.log(`[SendEmails] Soft failure for ${item.prospect_email}: ${result.error} — will retry`);
          }

          errorCount++;
          continue;
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

  // Merge template variables using template engine
  const whatsappTemplateData = prospectToTemplateData({
    email: "",
    first_name: prospect.first_name,
    last_name: prospect.last_name,
    company: prospect.company,
    job_title: prospect.job_title,
  });
  let messageText = mergeTemplate((step.whatsapp_message as string) || "", whatsappTemplateData);

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
