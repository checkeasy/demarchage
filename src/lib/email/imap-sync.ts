import { createAdminClient } from "@/lib/supabase/admin";
import { createImapClient, fetchNewEmails, type ImapAccount, type InboundEmail } from "./imap-client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MatchResult {
  emailSentId: string;
  campaignProspectId: string;
  prospectId: string;
  campaignId: string;
  workspaceId: string;
  emailAccountId: string;
}

interface SyncResult {
  accountsSynced: number;
  repliesFound: number;
  errors: number;
}

// ─── Main Sync Function ─────────────────────────────────────────────────────

export async function syncImapReplies(): Promise<SyncResult> {
  const supabase = createAdminClient();
  const result: SyncResult = { accountsSynced: 0, repliesFound: 0, errors: 0 };

  // Fetch all active email accounts with IMAP configured
  const { data: accounts, error: fetchErr } = await supabase
    .from("email_accounts")
    .select("id, workspace_id, email_address, imap_host, imap_port, imap_user, imap_pass_encrypted, last_synced_at")
    .eq("is_active", true)
    .not("imap_host", "is", null);

  if (fetchErr || !accounts || accounts.length === 0) {
    console.log("[ImapSync] No IMAP-enabled accounts found");
    return result;
  }

  for (const account of accounts) {
    try {
      await syncAccount(supabase, account, result);
      result.accountsSynced++;
    } catch (err) {
      console.error(`[ImapSync] Error syncing account ${account.email_address}:`, err);
      result.errors++;
    }
  }

  return result;
}

// ─── Sync Single Account ────────────────────────────────────────────────────

async function syncAccount(
  supabase: ReturnType<typeof createAdminClient>,
  account: Record<string, unknown>,
  result: SyncResult
) {
  // Resolve IMAP credentials (fallback to env vars for unconfigured accounts)
  const imapUser = (account.imap_user as string) || process.env.GMAIL_USER;
  const imapPass = (account.imap_pass_encrypted as string) || process.env.GMAIL_APP_PASSWORD;

  if (!imapUser || !imapPass) {
    console.log(`[ImapSync] Skipping ${account.email_address}: no IMAP credentials`);
    return;
  }

  const imapAccount: ImapAccount = {
    id: account.id as string,
    workspace_id: account.workspace_id as string,
    email_address: account.email_address as string,
    imap_host: account.imap_host as string,
    imap_port: (account.imap_port as number) || 993,
    imap_user: imapUser,
    imap_pass: imapPass,
    last_synced_at: account.last_synced_at as string | null,
  };

  // Determine since date: last_synced_at - 1 day, or 7 days ago
  let sinceDate: Date;
  if (imapAccount.last_synced_at) {
    sinceDate = new Date(imapAccount.last_synced_at);
    sinceDate.setDate(sinceDate.getDate() - 1); // Overlap 1 day for safety
  } else {
    sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 7);
  }

  // Connect and fetch
  const client = createImapClient(imapAccount);
  await client.connect();

  try {
    const emails = await fetchNewEmails(client, sinceDate);
    console.log(`[ImapSync] ${account.email_address}: fetched ${emails.length} emails since ${sinceDate.toISOString()}`);

    // Filter out emails sent FROM our own address (these are outbound, not replies)
    const inboundEmails = emails.filter(
      (e) => e.from !== (account.email_address as string).toLowerCase()
    );

    for (const email of inboundEmails) {
      try {
        // Dedup: skip if already processed
        if (email.messageId) {
          const { data: existing } = await supabase
            .from("inbox_messages")
            .select("id")
            .eq("message_id_header", email.messageId)
            .limit(1)
            .maybeSingle();

          if (existing) continue;
        }

        // Try to match this email to a sent email
        const match = await matchReplyToSentEmail(supabase, email, imapAccount);

        if (match) {
          await processMatchedReply(supabase, email, match);
          result.repliesFound++;
        }
        // Non-matched inbound emails are ignored (not cold email replies)
      } catch (err) {
        console.error(`[ImapSync] Error processing email ${email.messageId}:`, err);
        result.errors++;
      }
    }

    // Update last_synced_at
    await supabase
      .from("email_accounts")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", imapAccount.id);
  } finally {
    await client.logout();
  }
}

// ─── Reply Matching ─────────────────────────────────────────────────────────

async function matchReplyToSentEmail(
  supabase: ReturnType<typeof createAdminClient>,
  email: InboundEmail,
  account: ImapAccount
): Promise<MatchResult | null> {
  // Strategy 1: In-Reply-To header matches a sent email's Message-ID
  if (email.inReplyTo) {
    const match = await findSentEmailByMessageId(supabase, email.inReplyTo, account);
    if (match) return match;
  }

  // Strategy 2: References header contains a sent email's Message-ID
  if (email.references.length > 0) {
    for (const ref of email.references) {
      const match = await findSentEmailByMessageId(supabase, ref, account);
      if (match) return match;
    }
  }

  // Strategy 3: Subject + sender fallback
  const cleanSubject = email.subject
    .replace(/^(Re|Fwd|Tr|RE|FW|Fw|re):\s*/g, "")
    .trim();

  if (cleanSubject && email.from) {
    const { data: sentEmail } = await supabase
      .from("emails_sent")
      .select("id, campaign_prospect_id, email_account_id")
      .eq("to_email", email.from)
      .eq("email_account_id", account.id)
      .eq("subject", cleanSubject)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sentEmail?.campaign_prospect_id) {
      return buildMatchResult(supabase, sentEmail, account);
    }
  }

  return null;
}

async function findSentEmailByMessageId(
  supabase: ReturnType<typeof createAdminClient>,
  messageId: string,
  account: ImapAccount
): Promise<MatchResult | null> {
  const { data: sentEmail } = await supabase
    .from("emails_sent")
    .select("id, campaign_prospect_id, email_account_id")
    .eq("resend_message_id", messageId)
    .eq("email_account_id", account.id)
    .limit(1)
    .maybeSingle();

  if (!sentEmail?.campaign_prospect_id) return null;
  return buildMatchResult(supabase, sentEmail, account);
}

async function buildMatchResult(
  supabase: ReturnType<typeof createAdminClient>,
  sentEmail: { id: string; campaign_prospect_id: string; email_account_id: string },
  account: ImapAccount
): Promise<MatchResult | null> {
  const { data: cp } = await supabase
    .from("campaign_prospects")
    .select("id, prospect_id, campaign_id")
    .eq("id", sentEmail.campaign_prospect_id)
    .single();

  if (!cp) return null;

  return {
    emailSentId: sentEmail.id,
    campaignProspectId: cp.id,
    prospectId: cp.prospect_id,
    campaignId: cp.campaign_id,
    workspaceId: account.workspace_id,
    emailAccountId: account.id,
  };
}

// ─── Process Matched Reply ──────────────────────────────────────────────────

async function processMatchedReply(
  supabase: ReturnType<typeof createAdminClient>,
  email: InboundEmail,
  match: MatchResult
) {
  console.log(`[ImapSync] Reply matched! From: ${email.from}, Subject: ${email.subject}, Sent email: ${match.emailSentId}`);

  // 1. Create or find inbox thread
  let threadId: string;
  const { data: existingThread } = await supabase
    .from("inbox_threads")
    .select("id, message_count")
    .eq("prospect_id", match.prospectId)
    .eq("campaign_id", match.campaignId)
    .eq("email_account_id", match.emailAccountId)
    .limit(1)
    .maybeSingle();

  if (existingThread) {
    threadId = existingThread.id;
    await supabase
      .from("inbox_threads")
      .update({
        last_message_at: email.date.toISOString(),
        message_count: (existingThread.message_count || 0) + 1,
        status: "open",
      })
      .eq("id", threadId);
  } else {
    const { data: newThread } = await supabase
      .from("inbox_threads")
      .insert({
        workspace_id: match.workspaceId,
        prospect_id: match.prospectId,
        campaign_id: match.campaignId,
        email_account_id: match.emailAccountId,
        subject: email.subject,
        last_message_at: email.date.toISOString(),
        message_count: 1,
        status: "open",
      })
      .select("id")
      .single();

    if (!newThread) {
      console.error("[ImapSync] Failed to create inbox thread");
      return;
    }
    threadId = newThread.id;
  }

  // 2. Backfill the original outbound message if not already in thread
  const { data: existingOutbound } = await supabase
    .from("inbox_messages")
    .select("id")
    .eq("thread_id", threadId)
    .eq("email_sent_id", match.emailSentId)
    .limit(1)
    .maybeSingle();

  if (!existingOutbound) {
    const { data: sentEmail } = await supabase
      .from("emails_sent")
      .select("from_email, to_email, subject, body_html, body_text, resend_message_id, sent_at")
      .eq("id", match.emailSentId)
      .single();

    if (sentEmail) {
      await supabase.from("inbox_messages").insert({
        thread_id: threadId,
        direction: "outbound",
        from_email: sentEmail.from_email,
        to_email: sentEmail.to_email,
        subject: sentEmail.subject,
        body_html: sentEmail.body_html,
        body_text: sentEmail.body_text,
        email_sent_id: match.emailSentId,
        message_id_header: sentEmail.resend_message_id,
        is_read: true,
        created_at: sentEmail.sent_at,
      });
    }
  }

  // 3. Create inbound message
  await supabase.from("inbox_messages").insert({
    thread_id: threadId,
    direction: "inbound",
    from_email: email.from,
    to_email: email.to,
    subject: email.subject,
    body_html: email.htmlContent,
    body_text: email.textContent,
    message_id_header: email.messageId || null,
    in_reply_to_header: email.inReplyTo || null,
    references_header: email.references.length > 0 ? email.references.join(" ") : null,
    is_read: false,
    created_at: email.date.toISOString(),
  });

  // 4. Create tracking event
  await supabase.from("tracking_events").insert({
    email_sent_id: match.emailSentId,
    event_type: "reply",
  });

  // 5. Update emails_sent status
  await supabase
    .from("emails_sent")
    .update({
      status: "replied",
      replied_at: email.date.toISOString(),
    })
    .eq("id", match.emailSentId);

  // 6. Update campaign_prospects
  await supabase
    .from("campaign_prospects")
    .update({
      status: "replied",
      has_replied: true,
    })
    .eq("id", match.campaignProspectId);

  // 7. Create prospect activity (format compatible with AI reply analysis cron)
  await supabase.from("prospect_activities").insert({
    workspace_id: match.workspaceId,
    prospect_id: match.prospectId,
    activity_type: "reply_received",
    channel: "email",
    campaign_id: match.campaignId,
    subject: email.subject,
    body: email.textContent || email.htmlContent,
    metadata: {
      email_sent_id: match.emailSentId,
      from_email: email.from,
      message_id: email.messageId,
      reply_text: email.textContent || email.htmlContent,
    },
  });

  // 8. Increment campaign total_replied
  try {
    await supabase.rpc("increment_campaign_stat", {
      p_campaign_id: match.campaignId,
      p_column: "total_replied",
    });
  } catch {
    // RPC may not exist yet
  }

  // 9. Update prospect
  await supabase
    .from("prospects")
    .update({
      status: "replied",
      last_contacted_at: email.date.toISOString(),
    })
    .eq("id", match.prospectId);
}
