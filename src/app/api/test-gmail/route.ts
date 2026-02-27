import { NextRequest, NextResponse } from "next/server";
import { verifyGmailConnection, sendGmail } from "@/lib/email/gmail-sender";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check env vars
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    return NextResponse.json({
      error: "Gmail env vars missing",
      GMAIL_USER: gmailUser ? "SET" : "MISSING",
      GMAIL_APP_PASSWORD: gmailPass ? "SET" : "MISSING",
    }, { status: 500 });
  }

  // Verify SMTP connection
  const verification = await verifyGmailConnection();
  if (!verification.success) {
    return NextResponse.json({
      error: "SMTP connection failed",
      details: verification.error,
      GMAIL_USER: "SET",
    }, { status: 500 });
  }

  // Check if test send requested
  const body = await request.json().catch(() => ({}));
  if (body.send_test) {
    const result = await sendGmail({
      to: gmailUser,
      subject: "Test envoi prod - Cold Demarchage",
      html: "<p>Cet email confirme que l'envoi Gmail fonctionne depuis Railway.</p>",
      text: "Cet email confirme que l'envoi Gmail fonctionne depuis Railway.",
      from: `Adrien <${gmailUser}>`,
    });

    return NextResponse.json({
      smtp_connection: "OK",
      test_send: result.success ? "OK" : "FAILED",
      messageId: result.messageId,
      error: result.error,
    });
  }

  return NextResponse.json({
    smtp_connection: "OK",
    GMAIL_USER: "SET",
    GMAIL_APP_PASSWORD: "SET",
    ready: true,
  });
}
