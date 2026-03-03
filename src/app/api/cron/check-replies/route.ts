import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncImapReplies } from "@/lib/email/imap-sync";

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

    // 2. Sync IMAP replies (new - polls Gmail INBOX for reply detection)
    const imapResult = await syncImapReplies();

    return NextResponse.json({
      message: "Reply check completed",
      imap_accounts_synced: imapResult.accountsSynced,
      imap_replies_found: imapResult.repliesFound,
      imap_errors: imapResult.errors,
      bounces_handled: bouncesHandled,
    });
  } catch (err) {
    console.error("Check replies error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
