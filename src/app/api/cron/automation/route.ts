import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend-client";
import { mergeTemplate, prospectToTemplateData } from "@/lib/email/template-engine";

const BATCH_SIZE = 5; // Process 5 prospects per run (conservative for LinkedIn)

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Reset daily counters if needed
    await supabase.rpc("reset_linkedin_daily_counters");

    // Fetch prospects ready for next action
    const { data: queue, error: queueError } = await supabase
      .from("automation_queue")
      .select("*")
      .limit(BATCH_SIZE);

    if (queueError || !queue || queue.length === 0) {
      return NextResponse.json({
        message: "No automation actions to process",
        processed: 0,
      });
    }

    let successCount = 0;
    let errorCount = 0;

    // --- Bulk-fetch LinkedIn accounts to avoid N+1 queries ---
    const uniqueAccountIds = [...new Set(
      queue
        .map((q) => q.linkedin_account_id as string)
        .filter(Boolean)
    )];

    const accountsMap = new Map<string, Record<string, unknown>>();
    if (uniqueAccountIds.length > 0) {
      const { data: accountsData } = await supabase
        .from("linkedin_accounts")
        .select("id, is_active, session_valid, li_at_cookie, jsessionid_cookie, proxy_url, user_agent, connections_today, messages_today, views_today, searches_today, daily_connection_limit, daily_message_limit, daily_view_limit, daily_search_limit")
        .in("id", uniqueAccountIds);
      if (accountsData) {
        for (const a of accountsData) {
          accountsMap.set(a.id as string, a);
        }
      }
    }

    // --- Bulk-fetch workspace_ids for sequence logging to avoid N+1 in logAction ---
    const uniqueSequenceIds = [...new Set(
      queue
        .map((q) => q.sequence_id as string)
        .filter(Boolean)
    )];

    const sequenceWorkspaceMap = new Map<string, string>();
    if (uniqueSequenceIds.length > 0) {
      const { data: seqData } = await supabase
        .from("automation_sequences")
        .select("id, workspace_id")
        .in("id", uniqueSequenceIds);
      if (seqData) {
        for (const s of seqData) {
          sequenceWorkspaceMap.set(s.id as string, s.workspace_id as string);
        }
      }
    }

    for (const item of queue) {
      try {
        // Get LinkedIn account from pre-fetched map
        const account = accountsMap.get(item.linkedin_account_id as string) || null;

        const isEmailStep = (item.step_action_type as string) === "email";

        const workspaceId = sequenceWorkspaceMap.get(item.sequence_id as string) || null;

        if (!isEmailStep) {
          if (!account || !account.is_active || !account.session_valid) {
            await logAction(supabase, item, "skipped", "Compte LinkedIn inactif ou session expiree", undefined, workspaceId);
            continue;
          }

          // Check rate limits (only for LinkedIn actions)
          const canProceed = await checkRateLimit(supabase, account, item.step_action_type);
          if (!canProceed) {
            await logAction(supabase, item, "rate_limited", "Limite quotidienne atteinte", undefined, workspaceId);
            continue;
          }
        }

        // Execute the action
        const result = await executeAction(supabase, account || {}, item);

        if (result.success) {
          // Increment LinkedIn usage (only for LinkedIn actions)
          if (!isEmailStep) {
            await supabase.rpc("increment_linkedin_usage", {
              p_account_id: account!.id,
              p_action_type: item.step_action_type,
            });
          }

          // Log success
          await logAction(supabase, item, "success", null, result.message, workspaceId);

          // Advance to next step
          await advanceAutomationStep(supabase, item);

          successCount++;
        } else {
          await logAction(supabase, item, "failed", result.error, undefined, workspaceId);
          errorCount++;
        }

        // Random delay between actions (2-8 seconds)
        const delay = Math.floor(
          Math.random() * (item.max_delay_seconds - item.min_delay_seconds + 1) +
            item.min_delay_seconds
        ) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (err) {
        console.error("Automation action error:", err);
        const workspaceId = sequenceWorkspaceMap.get(item.sequence_id as string) || null;
        await logAction(
          supabase,
          item,
          "failed",
          err instanceof Error ? err.message : "Unknown error",
          undefined,
          workspaceId
        );
        errorCount++;
      }
    }

    return NextResponse.json({
      message: "Automation cron completed",
      processed: queue.length,
      success: successCount,
      errors: errorCount,
    });
  } catch (err) {
    console.error("Automation cron error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function checkRateLimit(
  supabase: ReturnType<typeof createAdminClient>,
  account: Record<string, unknown>,
  actionType: string
): Promise<boolean> {
  const limits: Record<string, { field: string; limit: string }> = {
    connect: { field: "connections_today", limit: "daily_connection_limit" },
    message: { field: "messages_today", limit: "daily_message_limit" },
    view_profile: { field: "views_today", limit: "daily_view_limit" },
    search: { field: "searches_today", limit: "daily_search_limit" },
  };

  const config = limits[actionType];
  if (!config) return true;

  const current = (account[config.field] as number) || 0;
  const limit = (account[config.limit] as number) || 20;

  return current < limit;
}

async function executeAction(
  supabase: ReturnType<typeof createAdminClient>,
  account: Record<string, unknown>,
  item: Record<string, unknown>
): Promise<{ success: boolean; error?: string; message?: string }> {
  const liAt = account.li_at_cookie as string;
  const jsessionId = account.jsessionid_cookie as string;
  const proxyUrl = account.proxy_url as string | null;

  const headers: Record<string, string> = {
    "User-Agent":
      (account.user_agent as string) ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "application/vnd.linkedin.normalized+json+2.1",
    "csrf-token": jsessionId,
    Cookie: `li_at=${liAt}; JSESSIONID="${jsessionId}"`,
    "x-restli-protocol-version": "2.0.0",
    "x-li-lang": "fr_FR",
  };

  const actionType = item.step_action_type as string;
  const publicId = item.linkedin_public_id as string;

  switch (actionType) {
    case "view_profile": {
      const response = await linkedInFetch(
        `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${publicId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-6`,
        { headers },
        proxyUrl
      );

      if (response.ok) {
        await supabase
          .from("automation_prospects")
          .update({ profile_viewed: true })
          .eq("id", item.automation_prospect_id as string);
        return { success: true, message: `Profil de ${item.first_name} ${item.last_name} visite` };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    case "connect": {
      let message = item.message_template as string | null;

      // Generate AI message if configured
      if (item.use_ai_generation) {
        message = await generateAIMessage(item);
      }

      // Merge template variables
      if (message) {
        message = mergeSimpleTemplate(message, item);
      }

      const profileUrn = item.linkedin_profile_urn as string;
      const body = {
        trackingId: generateTrackingId(),
        message: message || undefined,
        invitee: {
          "com.linkedin.voyager.dash.deco.relationships.Invitee": {
            memberProfileUrn: profileUrn,
          },
        },
      };

      const response = await linkedInFetch(
        "https://www.linkedin.com/voyager/api/voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreate",
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        proxyUrl
      );

      if (response.ok) {
        await supabase
          .from("automation_prospects")
          .update({ connection_sent: true })
          .eq("id", item.automation_prospect_id as string);
        return {
          success: true,
          message: `Connexion envoyee a ${item.first_name} ${item.last_name}`,
        };
      }
      const errorBody = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorBody.slice(0, 200)}` };
    }

    case "message": {
      let message = item.message_template as string | null;

      if (item.use_ai_generation) {
        message = await generateAIMessage(item);
      }

      if (message) {
        message = mergeSimpleTemplate(message, item);
      }

      if (!message) {
        return { success: false, error: "Pas de message configure" };
      }

      const profileUrn = item.linkedin_profile_urn as string;

      const body = {
        dedupeByClientGeneratedToken: false,
        body: {
          attributes: [],
          text: message,
        },
        conversationUrn: undefined,
        recipients: [profileUrn],
        subtype: "MEMBER_TO_MEMBER",
      };

      const response = await linkedInFetch(
        "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage",
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        proxyUrl
      );

      if (response.ok) {
        await supabase
          .from("automation_prospects")
          .update({
            message_sent_count:
              ((item.message_sent_count as number) || 0) + 1,
          })
          .eq("id", item.automation_prospect_id as string);
        return {
          success: true,
          message: `Message envoye a ${item.first_name} ${item.last_name}`,
        };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    case "check_accepted": {
      // Check if connection was accepted
      const response = await linkedInFetch(
        `https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/networkinfo`,
        { headers },
        proxyUrl
      );

      if (response.ok) {
        const data = await response.json();
        const distance = data?.data?.distance?.value;
        const isConnected = distance === "DISTANCE_1";

        await supabase
          .from("automation_prospects")
          .update({ connection_accepted: isConnected })
          .eq("id", item.automation_prospect_id as string);

        return {
          success: true,
          message: isConnected
            ? `${item.first_name} ${item.last_name} a accepte la connexion`
            : `${item.first_name} ${item.last_name} n'a pas encore accepte`,
        };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    case "email": {
      // Send email via Resend from automation sequence
      const sequenceId = item.sequence_id as string;
      const { data: seq } = await supabase
        .from("automation_sequences")
        .select("workspace_id, created_by")
        .eq("id", sequenceId)
        .single();

      if (!seq) {
        return { success: false, error: "Sequence introuvable" };
      }

      // Get the email account for the sequence creator (per-user)
      let emailQuery = supabase
        .from("email_accounts")
        .select("*")
        .eq("workspace_id", seq.workspace_id)
        .eq("is_active", true);

      if (seq.created_by) {
        emailQuery = emailQuery.eq("user_id", seq.created_by);
      }

      const { data: emailAccount } = await emailQuery
        .limit(1)
        .single();

      if (!emailAccount) {
        return { success: false, error: "Aucun compte email actif configure" };
      }

      const prospectEmail = item.prospect_email as string;
      if (!prospectEmail) {
        return { success: false, error: "Pas d'email pour ce prospect" };
      }

      // Merge template variables
      const templateData = prospectToTemplateData({
        email: prospectEmail,
        first_name: item.first_name as string | null,
        last_name: item.last_name as string | null,
        company: item.company as string | null,
        job_title: item.job_title as string | null,
      });

      const subjectTemplate = (item.subject_template as string) || "Message de suivi";
      const bodyTemplate = (item.message_template as string) || "";
      const mergedSubject = mergeTemplate(subjectTemplate, templateData);
      let mergedBody = mergeTemplate(bodyTemplate, templateData);

      // Convert plain text to basic HTML if needed
      if (!mergedBody.includes("<")) {
        mergedBody = mergedBody.replace(/\n/g, "<br/>");
      }

      // Append signature if available
      if (emailAccount.signature_html) {
        mergedBody += `<br/><br/>${emailAccount.signature_html}`;
      }

      const fromEmail = emailAccount.display_name
        ? `${emailAccount.display_name} <${emailAccount.email_address}>`
        : emailAccount.email_address;

      const result = await sendEmail({
        from: fromEmail,
        to: prospectEmail,
        subject: mergedSubject,
        html: mergedBody,
      });

      if (result.success) {
        // Update prospect last_contacted_at
        await supabase
          .from("prospects")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", item.prospect_id as string);

        return {
          success: true,
          message: `Email envoye a ${item.first_name} ${item.last_name} (${prospectEmail})`,
        };
      }
      return { success: false, error: `Erreur envoi email: ${result.error}` };
    }

    default:
      return { success: false, error: `Action type inconnu: ${actionType}` };
  }
}

async function advanceAutomationStep(
  supabase: ReturnType<typeof createAdminClient>,
  item: Record<string, unknown>
) {
  // Get current step
  const { data: currentStep } = await supabase
    .from("automation_steps")
    .select("*")
    .eq("id", item.current_step_id as string)
    .single();

  if (!currentStep) return;

  // Handle conditional steps
  if (currentStep.action_type === "check_accepted") {
    const isAccepted = item.connection_accepted as boolean;
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
        const nextActionAt = calculateNextActionTime(
          nextStep.delay_days,
          nextStep.delay_hours,
          nextStep.delay_minutes
        );

        await supabase
          .from("automation_prospects")
          .update({
            current_step_id: nextStep.id,
            next_action_at: nextActionAt.toISOString(),
          })
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

    // Increment sequence completed count
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

  // Schedule next action
  const nextActionAt = calculateNextActionTime(
    nextStep.delay_days,
    nextStep.delay_hours,
    nextStep.delay_minutes
  );

  await supabase
    .from("automation_prospects")
    .update({
      current_step_id: nextStep.id,
      next_action_at: nextActionAt.toISOString(),
    })
    .eq("id", item.automation_prospect_id as string);
}

function calculateNextActionTime(
  delayDays: number,
  delayHours: number,
  delayMinutes: number
): Date {
  const next = new Date();
  next.setDate(next.getDate() + (delayDays || 0));
  next.setHours(next.getHours() + (delayHours || 0));
  next.setMinutes(next.getMinutes() + (delayMinutes || 0));

  // Add random jitter (1-15 minutes)
  const jitter = Math.floor(Math.random() * 15) + 1;
  next.setMinutes(next.getMinutes() + jitter);

  return next;
}

async function logAction(
  supabase: ReturnType<typeof createAdminClient>,
  item: Record<string, unknown>,
  status: string,
  errorMessage?: string | null,
  messageSent?: string,
  workspaceId?: string | null
) {
  await supabase.from("automation_actions_log").insert({
    workspace_id: workspaceId || null,
    sequence_id: item.sequence_id,
    prospect_id: item.prospect_id,
    automation_prospect_id: item.automation_prospect_id,
    step_id: item.current_step_id,
    action_type: item.step_action_type,
    status,
    message_sent: messageSent || null,
    error_message: errorMessage || null,
  });
}

async function linkedInFetch(
  url: string,
  options: RequestInit,
  proxyUrl?: string | null
): Promise<Response> {
  if (proxyUrl) {
    const { HttpsProxyAgent } = await import("https-proxy-agent");
    const agent = new HttpsProxyAgent(proxyUrl);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fetch(url, { ...options, agent } as any);
  }
  return fetch(url, options);
}

async function generateAIMessage(
  item: Record<string, unknown>
): Promise<string | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/ai/generate-message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "connection",
          profile: {
            firstName: item.first_name,
            lastName: item.last_name,
            company: item.company,
            jobTitle: item.job_title,
          },
          context: item.ai_prompt_context || "",
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.message;
    }
  } catch {
    // Fallback to template if AI fails
  }
  return null;
}

function mergeSimpleTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template
    .replace(/\{firstName\}/g, (data.first_name as string) || "")
    .replace(/\{lastName\}/g, (data.last_name as string) || "")
    .replace(/\{company\}/g, (data.company as string) || "")
    .replace(/\{jobTitle\}/g, (data.job_title as string) || "")
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
