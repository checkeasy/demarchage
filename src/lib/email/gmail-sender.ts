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

// ─── Gmail SMTP IPv4 Address ────────────────────────────────────────────────

// Pre-resolved IPv4 address for smtp.gmail.com to bypass IPv6 DNS resolution
// Gmail SMTP resolves to multiple IPs; we resolve once at startup
let resolvedSmtpHost: string | null = null;

async function resolveGmailIPv4(): Promise<string> {
  if (resolvedSmtpHost) return resolvedSmtpHost;

  return new Promise((resolve, reject) => {
    dns.resolve4('smtp.gmail.com', (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        console.warn('[GmailSender] DNS resolve4 failed, falling back to hostname');
        resolve('smtp.gmail.com');
        return;
      }
      resolvedSmtpHost = addresses[0];
      console.log(`[GmailSender] Resolved smtp.gmail.com → ${resolvedSmtpHost} (IPv4)`);
      resolve(resolvedSmtpHost);
    });
  });
}

// ─── Gmail Transporter ──────────────────────────────────────────────────────

// Force IPv4 globally at process level
dns.setDefaultResultOrder('ipv4first');

// Per-host transporter cache (keyed by resolved IP)
let transporter: nodemailer.Transporter | null = null;
let transporterHost: string | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  const smtpHost = await resolveGmailIPv4();

  if (transporter && transporterHost === smtpHost) {
    return transporter;
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      'GMAIL_USER et GMAIL_APP_PASSWORD doivent etre definis dans .env.local'
    );
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 587,
    secure: false,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    // Ensure TLS connects with the real hostname for certificate validation
    tls: {
      servername: 'smtp.gmail.com',
    },
  });

  transporterHost = smtpHost;
  return transporter;
}

// ─── Send Email ─────────────────────────────────────────────────────────────

export async function sendGmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const transport = await getTransporter();
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
    const transport = await getTransporter();
    await transport.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
