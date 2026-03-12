import nodemailer from 'nodemailer';
import dns from 'dns';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SmtpCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  smtpCredentials?: SmtpCredentials;
  headers?: Record<string, string>;
  inReplyTo?: string;
  references?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Gmail SMTP IPv4 Address ────────────────────────────────────────────────

let resolvedSmtpHost: string | null = null;
let resolvedSmtpHostAt = 0;
const DNS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function resolveGmailIPv4(): Promise<string> {
  if (resolvedSmtpHost && Date.now() - resolvedSmtpHostAt < DNS_CACHE_TTL_MS) {
    return resolvedSmtpHost;
  }

  return new Promise((resolve) => {
    dns.resolve4('smtp.gmail.com', (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        console.warn('[GmailSender] DNS resolve4 failed, falling back to hostname');
        resolve('smtp.gmail.com');
        return;
      }
      resolvedSmtpHost = addresses[0];
      resolvedSmtpHostAt = Date.now();
      console.log(`[GmailSender] Resolved smtp.gmail.com → ${resolvedSmtpHost} (IPv4)`);
      resolve(resolvedSmtpHost);
    });
  });
}

// ─── Transporter Cache ──────────────────────────────────────────────────────

// Force IPv4 globally at process level
dns.setDefaultResultOrder('ipv4first');

// Cache transporters by key: "user@host" with TTL-based eviction
const TRANSPORTER_TTL_MS = 30 * 60 * 1000; // 30 minutes
const transporterCache = new Map<string, { transporter: nodemailer.Transporter; createdAt: number }>();

async function getTransporter(smtpCredentials?: SmtpCredentials): Promise<nodemailer.Transporter> {
  if (smtpCredentials) {
    const cacheKey = `${smtpCredentials.user}@${smtpCredentials.host}`;
    const cached = transporterCache.get(cacheKey);
    if (cached) {
      if (Date.now() - cached.createdAt < TRANSPORTER_TTL_MS) {
        return cached.transporter;
      }
      // TTL expired — close and evict
      cached.transporter.close();
      transporterCache.delete(cacheKey);
    }

    const isGmailHost = smtpCredentials.host === 'smtp.gmail.com';
    let host = smtpCredentials.host;

    // Resolve Gmail to IPv4 to avoid IPv6 issues
    if (isGmailHost) {
      host = await resolveGmailIPv4();
    }

    const transport = nodemailer.createTransport({
      host,
      port: smtpCredentials.port || 587,
      secure: false,
      auth: { user: smtpCredentials.user, pass: smtpCredentials.pass },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      ...(isGmailHost ? { tls: { servername: 'smtp.gmail.com' } } : {}),
    });

    transporterCache.set(cacheKey, { transporter: transport, createdAt: Date.now() });
    return transport;
  }

  // Fallback: use env vars (backward compatibility)
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      'GMAIL_USER et GMAIL_APP_PASSWORD doivent etre definis dans .env.local'
    );
  }

  const cacheKey = `${user}@gmail-env`;
  const envCached = transporterCache.get(cacheKey);
  if (envCached) {
    if (Date.now() - envCached.createdAt < TRANSPORTER_TTL_MS) {
      return envCached.transporter;
    }
    // TTL expired — close and evict
    envCached.transporter.close();
    transporterCache.delete(cacheKey);
  }

  const smtpHost = await resolveGmailIPv4();
  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: 587,
    secure: false,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    tls: { servername: 'smtp.gmail.com' },
  });

  transporterCache.set(cacheKey, { transporter: transport, createdAt: Date.now() });
  return transport;
}

// ─── Send Email ─────────────────────────────────────────────────────────────

export async function sendGmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const transport = await getTransporter(params.smtpCredentials);
    const from = params.from || params.smtpCredentials?.user || process.env.GMAIL_USER;
    if (!from) {
      throw new Error('No "from" address available: set params.from, smtpCredentials.user, or GMAIL_USER env var');
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]*>/g, ''),
      replyTo: params.replyTo || from,
    };

    // Add threading headers for follow-up emails
    if (params.inReplyTo) {
      mailOptions.inReplyTo = params.inReplyTo;
    }
    if (params.references) {
      mailOptions.references = params.references;
    }

    // Add custom headers (List-Unsubscribe, etc.)
    if (params.headers && Object.keys(params.headers).length > 0) {
      mailOptions.headers = params.headers;
    }

    const info = await transport.sendMail(mailOptions);

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

  for (let i = 0; i < emails.length; i++) {
    const result = await sendGmail(emails[i]);
    results.push(result);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Delay between emails to respect Gmail rate limits
    if (i < emails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { sent, failed, results };
}

// ─── Verify Connection ──────────────────────────────────────────────────────

export async function verifyGmailConnection(smtpCredentials?: SmtpCredentials): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const transport = await getTransporter(smtpCredentials);
    await transport.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
