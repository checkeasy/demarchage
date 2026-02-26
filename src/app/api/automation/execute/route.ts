import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
        // Get LinkedIn cookies from env (simpler than DB for single-user)
        const liAt = process.env.LINKEDIN_SESSION_COOKIE;
        const jsessionId = process.env.LINKEDIN_JSESSIONID;

        if (!liAt || !jsessionId) {
          logs.push(`Skipped: No LinkedIn cookies configured`);
          continue;
        }

        const headers: Record<string, string> = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/vnd.linkedin.normalized+json+2.1",
          "csrf-token": jsessionId,
          Cookie: `li_at=${liAt}; JSESSIONID="${jsessionId}"`,
          "x-restli-protocol-version": "2.0.0",
          "x-li-lang": "fr_FR",
        };

        const actionType = item.step_action_type as string;
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
