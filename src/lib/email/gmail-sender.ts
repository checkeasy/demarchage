import nodemailer from 'nodemailer';
import dns from 'dns';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Gmail Transporter ──────────────────────────────────────────────────────

// Singleton - recreated on config change (server restart)
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      throw new Error(
        'GMAIL_USER et GMAIL_APP_PASSWORD doivent etre definis dans .env.local'
      );
    }

    // Force IPv4 globally for this process - VPS has no IPv6 connectivity
    dns.setDefaultResultOrder('ipv4first');

    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    } as Record<string, unknown>);
  }
  return transporter;
}

// ─── Send Email ─────────────────────────────────────────────────────────────

export async function sendGmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const transport = getTransporter();
    const from = params.from || process.env.GMAIL_USER!;

    const info = await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]*>/g, ''),
      replyTo: params.replyTo || from,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error('[GmailSender] Error:', err);
    return {
      success: false,
      error: (err as Error).message,
    };
  }
}

// ─── Send Bulk ──────────────────────────────────────────────────────────────

export async function sendBulkGmail(
  emails: SendEmailParams[],
  delayMs = 3000
): Promise<{ sent: number; failed: number; results: SendEmailResult[] }> {
  const results: SendEmailResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    const result = await sendGmail(email);
    results.push(result);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Delay between emails to respect Gmail rate limits
    if (emails.indexOf(email) < emails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { sent, failed, results };
}

// ─── Verify Connection ──────────────────────────────────────────────────────

export async function verifyGmailConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
