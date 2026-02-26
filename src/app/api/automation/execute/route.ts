import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend-client";
import { mergeTemplate as mergeEmailTemplate, prospectToTemplateData } from "@/lib/email/template-engine";
import { getOrchestrator } from "@/lib/agents/orchestrator";
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

const BATCH_SIZE = 5;

// POST /api/automation/execute — Manually trigger automation queue processing
export async function POST() {
  const supabase = createAdminClient();

  try {
    // Reset daily counters if needed
    try {
      await supabase.rpc("reset_linkedin_daily_counters");
    } catch {
      // Function may not exist yet, ignore
    }

    // Fetch prospects ready for next action from the queue view
    const { data: queue, error: queueError } = await supabase
      .from("automation_queue")
      .select("*")
      .limit(BATCH_SIZE);

    if (queueError) {
      console.error("[Automation Execute] Queue error:", queueError);
      return NextResponse.json({
        message: "Erreur lecture de la queue",
        error: queueError.message,
        processed: 0,
      });
    }

    if (!queue || queue.length === 0) {
      return NextResponse.json({
        message: "Aucune action a traiter",
        processed: 0,
        success: 0,
        errors: 0,
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const logs: string[] = [];

    for (const item of queue) {
      try {
        const actionType = item.step_action_type as string;
        const isEmailAction = actionType === "email";
        const isWhatsAppAction = actionType === "whatsapp";

        // Load LinkedIn cookies from workspace settings in DB
        let liAt = "";
        let jsessionId = "";

        if (!isEmailAction && !isWhatsAppAction) {
          const { data: seqForCookies } = await supabase
            .from("automation_sequences")
            .select("workspace_id")
            .eq("id", item.sequence_id as string)
            .single();

          if (seqForCookies?.workspace_id) {
            const { data: ws } = await supabase
              .from("workspaces")
              .select("settings")
              .eq("id", seqForCookies.workspace_id)
              .single();

            const settings = (ws?.settings || {}) as Record<string, string>;
            liAt = settings.linkedin_li_at || "";
            jsessionId = settings.linkedin_jsessionid || "";
          }

          if (!liAt || !jsessionId) {
            logs.push(`Skipped: No LinkedIn cookies configured in workspace settings`);
            continue;
          }
        }

        const headers: Record<string, string> = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/vnd.linkedin.normalized+json+2.1",
          "csrf-token": jsessionId || "",
          Cookie: `li_at=${liAt || ""}; JSESSIONID="${jsessionId || ""}"`,
          "x-restli-protocol-version": "2.0.0",
          "x-li-lang": "fr_FR",
        };

        const publicId = item.linkedin_public_id as string;
        let actionSuccess = false;
        let logMessage = "";

        switch (actionType) {
          case "view_profile": {
            const response = await fetch(
              `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${publicId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-6`,
              { headers }
            );

            if (response.ok) {
              await supabase
                .from("automation_prospects")
                .update({ profile_viewed: true })
                .eq("id", item.automation_prospect_id);
              actionSuccess = true;
              logMessage = `Profil de ${item.first_name} ${item.last_name} visite`;
            } else {
              logMessage = `Erreur visite profil: HTTP ${response.status}`;
            }
            break;
          }

          case "connect": {
            let message = item.message_template as string | null;
            if (message) {
              message = mergeTemplate(message, item);
            }

            // We need the profile URN, not just the public ID
            // First get the member URN by viewing the profile
            const profileRes = await fetch(
              `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${publicId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-6`,
              { headers }
            );

            if (!profileRes.ok) {
              logMessage = `Erreur recuperation profil pour connexion: HTTP ${profileRes.status}`;
              break;
            }

            const profileData = await profileRes.json();
            // Extract profile URN from response
            const elements = profileData?.included || profileData?.data?.elements || [];
            let profileUrn = "";
            for (const el of elements) {
              if (el.entityUrn && el.entityUrn.includes("fsd_profile")) {
                profileUrn = el.entityUrn;
                break;
              }
            }

            if (!profileUrn) {
              profileUrn = `urn:li:fsd_profile:${publicId}`;
            }

            const connectBody = {
              trackingId: generateTrackingId(),
              message: message || undefined,
              invitee: {
                "com.linkedin.voyager.dash.deco.relationships.Invitee": {
                  memberProfileUrn: profileUrn,
                },
              },
            };

            const connectRes = await fetch(
              "https://www.linkedin.com/voyager/api/voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreate",
              {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(connectBody),
              }
            );

            if (connectRes.ok) {
              await supabase
                .from("automation_prospects")
                .update({ connection_sent: true })
                .eq("id", item.automation_prospect_id);
              actionSuccess = true;
              logMessage = `Connexion envoyee a ${item.first_name} ${item.last_name}`;
            } else {
              const errorBody = await connectRes.text().catch(() => "");
              logMessage = `Erreur connexion: HTTP ${connectRes.status} - ${errorBody.slice(0, 100)}`;
            }
            break;
          }

          case "message": {
            let message = item.message_template as string | null;
            if (message) {
              message = mergeTemplate(message, item);
            }

            if (!message) {
              logMessage = "Pas de message configure";
              break;
            }

            const msgBody = {
              dedupeByClientGeneratedToken: false,
              body: {
                attributes: [],
                text: message,
              },
              recipients: [`urn:li:fsd_profile:${publicId}`],
              subtype: "MEMBER_TO_MEMBER",
            };

            const msgRes = await fetch(
              "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage",
              {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(msgBody),
              }
            );

            if (msgRes.ok) {
              await supabase
                .from("automation_prospects")
                .update({
                  message_sent_count:
                    ((item.message_sent_count as number) || 0) + 1,
                })
                .eq("id", item.automation_prospect_id);
              actionSuccess = true;
              logMessage = `Message envoye a ${item.first_name} ${item.last_name}`;
            } else {
              logMessage = `Erreur message: HTTP ${msgRes.status}`;
            }
            break;
          }

          case "check_accepted": {
            const checkRes = await fetch(
              `https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/networkinfo`,
              { headers }
            );

            if (checkRes.ok) {
              const data = await checkRes.json();
              const distance = data?.data?.distance?.value;
              const isConnected = distance === "DISTANCE_1";

              await supabase
                .from("automation_prospects")
                .update({ connection_accepted: isConnected })
                .eq("id", item.automation_prospect_id);

              actionSuccess = true;
              logMessage = isConnected
                ? `${item.first_name} ${item.last_name} a accepte la connexion`
                : `${item.first_name} ${item.last_name} n'a pas encore accepte`;
            } else {
              logMessage = `Erreur check connexion: HTTP ${checkRes.status}`;
            }
            break;
          }

          case "email": {
            // Send email from automation sequence via Resend
            const { data: seqForEmail } = await supabase
              .from("automation_sequences")
              .select("workspace_id")
              .eq("id", item.sequence_id)
              .single();

            if (!seqForEmail) {
              logMessage = "Sequence introuvable pour envoi email";
              break;
            }

            const { data: emailAccount } = await supabase
              .from("email_accounts")
              .select("*")
              .eq("workspace_id", seqForEmail.workspace_id)
              .eq("is_active", true)
              .limit(1)
              .single();

            if (!emailAccount) {
              logMessage = "Aucun compte email actif configure";
              break;
            }

            const prospectEmail = item.prospect_email as string;
            if (!prospectEmail) {
              logMessage = "Pas d'email pour ce prospect";
              break;
            }

            const tplData = prospectToTemplateData({
              email: prospectEmail,
              first_name: item.first_name as string | null,
              last_name: item.last_name as string | null,
              company: item.company as string | null,
              job_title: item.job_title as string | null,
            });

            const stepMetadata = (item.step_metadata || item.metadata) as Record<string, unknown> | null;
            const useAI = stepMetadata?.use_ai_generation === true;

            let mergedSubject: string;
            let mergedBody: string;

            if (useAI) {
              // Try AI generation for personalized content
              try {
                const orchestrator = getOrchestrator();
                const aiResult = await orchestrator.generateOutreach({
                  workspaceId: seqForEmail.workspace_id,
                  prospectId: item.prospect_id as string,
                  campaignId: (item.sequence_id as string) || 'automation',
                  channel: 'email',
                  stepNumber: (item.step_order as number) || 1,
                });
                const aiContent = aiResult.content as { subject?: string; body_html?: string };
                mergedSubject = aiContent.subject || "Message de suivi";
                mergedBody = aiContent.body_html || "";
              } catch (aiErr) {
                console.warn("[Automation Execute] AI generation failed, falling back to template:", aiErr);
                const subjectTpl = (item.subject_template as string) || "Message de suivi";
                const bodyTpl = (item.message_template as string) || "";
                mergedSubject = mergeEmailTemplate(subjectTpl, tplData);
                mergedBody = mergeEmailTemplate(bodyTpl, tplData);
              }
            } else {
              const subjectTpl = (item.subject_template as string) || "Message de suivi";
              const bodyTpl = (item.message_template as string) || "";
              mergedSubject = mergeEmailTemplate(subjectTpl, tplData);
              mergedBody = mergeEmailTemplate(bodyTpl, tplData);
            }

            if (!mergedBody.includes("<")) {
              mergedBody = mergedBody.replace(/\n/g, "<br/>");
            }

            if (emailAccount.signature_html) {
              mergedBody += `<br/><br/>${emailAccount.signature_html}`;
            }

            const fromEmail = emailAccount.display_name
              ? `${emailAccount.display_name} <${emailAccount.email_address}>`
              : emailAccount.email_address;

            const emailResult = await sendEmail({
              from: fromEmail,
              to: prospectEmail,
              subject: mergedSubject,
              html: mergedBody,
            });

            if (emailResult.success) {
              await supabase
                .from("prospects")
                .update({ last_contacted_at: new Date().toISOString() })
                .eq("id", item.prospect_id);
              actionSuccess = true;
              logMessage = `Email envoye a ${item.first_name} ${item.last_name} (${prospectEmail})`;
            } else {
              logMessage = `Erreur envoi email: ${emailResult.error}`;
            }
            break;
          }

          case "whatsapp": {
            // Get workspace ID for the sequence
            const { data: seqForWa } = await supabase
              .from("automation_sequences")
              .select("workspace_id")
              .eq("id", item.sequence_id)
              .single();

            if (!seqForWa) {
              logMessage = "Sequence introuvable pour envoi WhatsApp";
              break;
            }

            const waWorkspaceId = seqForWa.workspace_id;

            // Get prospect phone
            const prospectPhone = item.phone as string;
            if (!prospectPhone) {
              logMessage = `Pas de numero de telephone pour ${item.first_name} ${item.last_name}`;
              await logWhatsAppAction({
                workspaceId: waWorkspaceId,
                prospectId: item.prospect_id as string,
                phoneNumber: null,
                messageText: null,
                status: "invalid_number",
                errorMessage: "Pas de numero de telephone",
              });
              break;
            }

            // Check rate limit
            const waAllowed = await canWhatsApp(waWorkspaceId, WhatsAppActionType.MESSAGE);
            if (!waAllowed) {
              logMessage = `Limite WhatsApp quotidienne atteinte`;
              await logWhatsAppAction({
                workspaceId: waWorkspaceId,
                prospectId: item.prospect_id as string,
                phoneNumber: prospectPhone,
                messageText: null,
                status: "rate_limited",
                errorMessage: "Limite quotidienne atteinte",
              });
              break;
            }

            // Get client
            let waClient;
            try {
              waClient = await getWhatsAppClient(waWorkspaceId);
            } catch {
              logMessage = "Client WhatsApp non connecte";
              await logWhatsAppAction({
                workspaceId: waWorkspaceId,
                prospectId: item.prospect_id as string,
                phoneNumber: prospectPhone,
                messageText: null,
                status: "failed",
                errorMessage: "Client WhatsApp non connecte",
              });
              break;
            }

            // Merge template
            let waMessage = (item.message_template as string) || "";
            waMessage = mergeTemplate(waMessage, item);

            if (!waMessage.trim()) {
              logMessage = "Message WhatsApp vide";
              break;
            }

            try {
              const formattedPhone = formatPhoneNumber(prospectPhone);
              const waResult = await waClient.sendMessage(formattedPhone, waMessage);

              await recordWhatsApp(waWorkspaceId, WhatsAppActionType.MESSAGE);

              await logWhatsAppAction({
                workspaceId: waWorkspaceId,
                prospectId: item.prospect_id as string,
                phoneNumber: prospectPhone,
                messageText: waMessage,
                status: "success",
                waMessageId: (waResult as any)?.id?.id || waResult?.messageId || null,
              });

              await supabase
                .from("prospects")
                .update({ last_contacted_at: new Date().toISOString() })
                .eq("id", item.prospect_id);

              actionSuccess = true;
              logMessage = `WhatsApp envoye a ${item.first_name} ${item.last_name} (${prospectPhone})`;
            } catch (waErr) {
              logMessage = `Erreur WhatsApp: ${waErr instanceof Error ? waErr.message : "Inconnue"}`;
              await logWhatsAppAction({
                workspaceId: waWorkspaceId,
                prospectId: item.prospect_id as string,
                phoneNumber: prospectPhone,
                messageText: waMessage,
                status: "failed",
                errorMessage: waErr instanceof Error ? waErr.message : "Erreur inconnue",
              });
            }
            break;
          }

          default:
            logMessage = `Type d'action inconnu: ${actionType}`;
        }

        // Log action
        const { data: seqData } = await supabase
          .from("automation_sequences")
          .select("workspace_id")
          .eq("id", item.sequence_id)
          .single();

        await supabase.from("automation_actions_log").insert({
          workspace_id: seqData?.workspace_id,
          sequence_id: item.sequence_id,
          prospect_id: item.prospect_id,
          automation_prospect_id: item.automation_prospect_id,
          step_id: item.current_step_id,
          action_type: actionType,
          status: actionSuccess ? "success" : "failed",
          message_sent: logMessage,
          error_message: actionSuccess ? null : logMessage,
        });

        if (actionSuccess) {
          // Advance to next step
          await advanceStep(supabase, item);
          successCount++;
        } else {
          errorCount++;
        }

        logs.push(logMessage);

        // Random delay between actions
        const minDelay = (item.min_delay_seconds as number) || 2;
        const maxDelay = (item.max_delay_seconds as number) || 8;
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (err) {
        console.error("[Automation Execute] Action error:", err);
        errorCount++;
        logs.push(`Erreur: ${err instanceof Error ? err.message : "Inconnue"}`);
      }
    }

    return NextResponse.json({
      message: "Execution terminee",
      processed: queue.length,
      success: successCount,
      errors: errorCount,
      logs,
    });
  } catch (err) {
    console.error("[Automation Execute] Error:", err);
    return NextResponse.json(
      { error: "Erreur interne", details: err instanceof Error ? err.message : "" },
      { status: 500 }
    );
  }
}

async function advanceStep(
  supabase: ReturnType<typeof createAdminClient>,
  item: Record<string, unknown>
) {
  const { data: currentStep } = await supabase
    .from("automation_steps")
    .select("*")
    .eq("id", item.current_step_id as string)
    .single();

  if (!currentStep) return;

  // Handle conditional steps
  if (currentStep.action_type === "check_accepted") {
    const { data: prospect } = await supabase
      .from("automation_prospects")
      .select("connection_accepted")
      .eq("id", item.automation_prospect_id as string)
      .single();

    const isAccepted = prospect?.connection_accepted || false;
    const nextStepId = isAccepted
      ? currentStep.on_true_step_id
      : currentStep.on_false_step_id;

    if (nextStepId) {
      const { data: nextStep } = await supabase
        .from("automation_steps")
        .select("*")
        .eq("id", nextStepId)
        .single();

      if (nextStep) {
        const nextAt = calcNextActionTime(nextStep.delay_days, nextStep.delay_hours, nextStep.delay_minutes);
        await supabase
          .from("automation_prospects")
          .update({ current_step_id: nextStep.id, next_action_at: nextAt.toISOString() })
          .eq("id", item.automation_prospect_id as string);
        return;
      }
    }
  }

  // Get next sequential step
  const { data: nextStep } = await supabase
    .from("automation_steps")
    .select("*")
    .eq("sequence_id", item.sequence_id as string)
    .gt("step_order", currentStep.step_order)
    .eq("is_active", true)
    .order("step_order", { ascending: true })
    .limit(1)
    .single();

  if (!nextStep) {
    // Sequence completed for this prospect
    await supabase
      .from("automation_prospects")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        current_step_id: null,
        next_action_at: null,
      })
      .eq("id", item.automation_prospect_id as string);

    // Update sequence processed count
    const { data: seq } = await supabase
      .from("automation_sequences")
      .select("total_processed")
      .eq("id", item.sequence_id as string)
      .single();

    if (seq) {
      await supabase
        .from("automation_sequences")
        .update({ total_processed: (seq.total_processed || 0) + 1 })
        .eq("id", item.sequence_id as string);
    }

    return;
  }

  const nextAt = calcNextActionTime(nextStep.delay_days, nextStep.delay_hours, nextStep.delay_minutes);
  await supabase
    .from("automation_prospects")
    .update({ current_step_id: nextStep.id, next_action_at: nextAt.toISOString() })
    .eq("id", item.automation_prospect_id as string);
}

function calcNextActionTime(days: number, hours: number, minutes: number): Date {
  const next = new Date();
  next.setDate(next.getDate() + (days || 0));
  next.setHours(next.getHours() + (hours || 0));
  next.setMinutes(next.getMinutes() + (minutes || 0));
  // Random jitter 1-15 min
  next.setMinutes(next.getMinutes() + Math.floor(Math.random() * 15) + 1);
  return next;
}

function mergeTemplate(template: string, data: Record<string, unknown>): string {
  return template
    .replace(/\{firstName\}/g, (data.first_name as string) || "")
    .replace(/\{prenom\}/g, (data.first_name as string) || "")
    .replace(/\{lastName\}/g, (data.last_name as string) || "")
    .replace(/\{nom\}/g, (data.last_name as string) || "")
    .replace(/\{company\}/g, (data.company as string) || "")
    .replace(/\{entreprise\}/g, (data.company as string) || "")
    .replace(/\{jobTitle\}/g, (data.job_title as string) || "")
    .replace(/\{poste\}/g, (data.job_title as string) || "")
    .replace(/\{email\}/g, (data.prospect_email as string) || "");
}

function generateTrackingId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
