import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncImapReplies } from "@/lib/email/imap-sync";
import { LinkedInClient } from "@/lib/linkedin/client";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    let bouncesHandled = 0;

    // 1. Handle bounced emails (existing logic)
    const { data: bouncedEmails } = await supabase
      .from("emails_sent")
      .select("id, campaign_prospect_id")
      .eq("status", "bounced")
      .not("campaign_prospect_id", "is", null);

    if (bouncedEmails && bouncedEmails.length > 0) {
      for (const email of bouncedEmails) {
        const { data: cp } = await supabase
          .from("campaign_prospects")
          .select("id, status")
          .eq("id", email.campaign_prospect_id)
          .eq("status", "active")
          .single();

        if (cp) {
          await supabase
            .from("campaign_prospects")
            .update({ status: "bounced" })
            .eq("id", cp.id);
          bouncesHandled++;
        }
      }
    }

    // 2. Sync IMAP replies (polls Gmail INBOX for reply detection)
    const imapResult = await syncImapReplies();

    // 3. Check LinkedIn replies for active automation prospects
    let linkedinRepliesFound = 0;
    let linkedinErrors = 0;

    try {
      // Find automation prospects with messages sent that are still active
      const { data: linkedinProspects } = await supabase
        .from("automation_prospects")
        .select("id, prospect_id, linkedin_profile_urn, sequence_id")
        .eq("status", "active")
        .gt("message_sent_count", 0);

      if (linkedinProspects && linkedinProspects.length > 0) {
        // Group by sequence to find the LinkedIn account for each
        const sequenceIds = [...new Set(linkedinProspects.map((p) => p.sequence_id).filter(Boolean))];

        const sequenceAccountMap = new Map<string, Record<string, string>>();
        if (sequenceIds.length > 0) {
          const { data: sequences } = await supabase
            .from("automation_sequences")
            .select("id, linkedin_account_id")
            .in("id", sequenceIds);

          if (sequences) {
            for (const seq of sequences) {
              if (seq.linkedin_account_id) {
                const { data: account } = await supabase
                  .from("linkedin_accounts")
                  .select("li_at_cookie, jsessionid_cookie, proxy_url")
                  .eq("id", seq.linkedin_account_id)
                  .eq("is_active", true)
                  .single();

                if (account?.li_at_cookie && account?.jsessionid_cookie) {
                  sequenceAccountMap.set(seq.id, {
                    liAt: account.li_at_cookie,
                    jsessionId: account.jsessionid_cookie,
                    proxyUrl: account.proxy_url || "",
                  });
                }
              }
            }
          }
        }

        // Check replies for each prospect using the appropriate LinkedIn account
        for (const prospect of linkedinProspects) {
          if (!prospect.linkedin_profile_urn) continue;

          const accountConfig = sequenceAccountMap.get(prospect.sequence_id);
          if (!accountConfig) continue;

          try {
            const client = new LinkedInClient({
              liAt: accountConfig.liAt,
              jsessionId: accountConfig.jsessionId,
              proxyUrl: accountConfig.proxyUrl || undefined,
            });

            const result = await client.checkForReply(prospect.linkedin_profile_urn);

            if (result.replied) {
              // Update automation prospect status to replied
              await supabase
                .from("automation_prospects")
                .update({
                  status: "replied",
                  replied_at: result.lastMessageAt || new Date().toISOString(),
                })
                .eq("id", prospect.id);

              // Create a prospect_activities entry
              await supabase
                .from("prospect_activities")
                .insert({
                  prospect_id: prospect.prospect_id,
                  activity_type: "linkedin_reply",
                  description: result.lastMessageText
                    ? `Reponse LinkedIn: ${result.lastMessageText.slice(0, 500)}`
                    : "Reponse recue sur LinkedIn",
                  metadata: {
                    source: "automation_reply_check",
                    reply_text: result.lastMessageText,
                    detected_at: new Date().toISOString(),
                  },
                });

              // Also stop any active email campaigns for this prospect
              await supabase
                .from('campaign_prospects')
                .update({ status: 'replied', has_replied: true, next_send_at: null })
                .eq('prospect_id', prospect.prospect_id)
                .in('status', ['active', 'paused']);

              linkedinRepliesFound++;
              console.log(`[LinkedIn] Reply detected from prospect ${prospect.prospect_id}`);
            }
          } catch (err) {
            console.error(`[LinkedIn] Error checking reply for prospect ${prospect.id}:`, err);
            linkedinErrors++;
          }
        }
      }
    } catch (err) {
      console.error("[LinkedIn] Error in LinkedIn reply check:", err);
      linkedinErrors++;
    }

    return NextResponse.json({
      message: "Reply check completed",
      imap_accounts_synced: imapResult.accountsSynced,
      imap_replies_found: imapResult.repliesFound,
      imap_errors: imapResult.errors,
      bounces_handled: bouncesHandled,
      linkedin_replies_found: linkedinRepliesFound,
      linkedin_errors: linkedinErrors,
    });
  } catch (err) {
    console.error("Check replies error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
