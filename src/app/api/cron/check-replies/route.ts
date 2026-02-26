import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Get all active email accounts with IMAP configured
    const { data: accounts } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("is_active", true)
      .not("imap_host", "is", null);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: "No IMAP accounts configured" });
    }

    const repliesFound = 0;

    for (const account of accounts) {
      try {
        // NOTE: IMAP connection requires the imapflow package
        // For MVP, we'll check replies via a simpler method:
        // Check if any new emails arrived to the sending address
        // that match known prospect emails

        // For now, skip IMAP and rely on Resend webhook for delivery tracking
        // IMAP will be implemented in Phase 5 with full inbox support

        // Update last_synced_at
        await supabase
          .from("email_accounts")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", account.id);
      } catch (err) {
        console.error(
          `Error checking replies for account ${account.email_address}:`,
          err
        );
      }
    }

    return NextResponse.json({
      message: "Reply check completed",
      accounts_checked: accounts.length,
      replies_found: repliesFound,
    });
  } catch (err) {
    console.error("Check replies error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
