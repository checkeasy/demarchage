import { ImapFlow, type MessageStructureObject } from "imapflow";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImapAccount {
  id: string;
  workspace_id: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_pass: string;
  last_synced_at: string | null;
}

export interface InboundEmail {
  uid: number;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  from: string;
  to: string;
  subject: string;
  date: Date;
  textContent: string | null;
  htmlContent: string | null;
}

// ─── Connect ────────────────────────────────────────────────────────────────

export function createImapClient(account: ImapAccount): ImapFlow {
  return new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: true,
    auth: {
      user: account.imap_user,
      pass: account.imap_pass,
    },
    logger: false,
  });
}

// ─── Fetch New Emails ───────────────────────────────────────────────────────

export async function fetchNewEmails(
  client: ImapFlow,
  sinceDate: Date
): Promise<InboundEmail[]> {
  const emails: InboundEmail[] = [];

  const lock = await client.getMailboxLock("INBOX");

  try {
    // IMAP SINCE uses date only (no time), so we search from sinceDate
    const searchResult = await client.search({ since: sinceDate });

    if (!searchResult || searchResult.length === 0) {
      return emails;
    }

    // Fetch envelopes + body structure + References header
    for await (const msg of client.fetch(searchResult, {
      envelope: true,
      bodyStructure: true,
      headers: ["references"],
      uid: true,
    })) {
      const envelope = msg.envelope;
      if (!envelope) continue;

      const fromAddr =
        envelope.from?.[0]?.address?.toLowerCase() || "";
      const toAddr =
        envelope.to?.[0]?.address?.toLowerCase() || "";

      // Parse References header from raw headers buffer
      let references: string[] = [];
      if (msg.headers) {
        const headersStr = msg.headers.toString("utf-8");
        const refsMatch = headersStr.match(/^References:\s*(.+)/im);
        if (refsMatch) {
          // References header contains space-separated Message-IDs
          references = refsMatch[1]
            .replace(/\r?\n\s+/g, " ") // unfold continuation lines
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        }
      }

      // Download body parts using bodyStructure
      let textContent: string | null = null;
      let htmlContent: string | null = null;

      try {
        textContent = await downloadBodyPart(client, msg.uid, msg.bodyStructure, "text/plain");
      } catch {
        // text/plain not available
      }

      try {
        htmlContent = await downloadBodyPart(client, msg.uid, msg.bodyStructure, "text/html");
      } catch {
        // text/html not available
      }

      emails.push({
        uid: msg.uid,
        messageId: envelope.messageId || "",
        inReplyTo: envelope.inReplyTo || null,
        references,
        from: fromAddr,
        to: toAddr,
        subject: envelope.subject || "",
        date: envelope.date ? new Date(envelope.date) : new Date(),
        textContent,
        htmlContent,
      });
    }
  } finally {
    lock.release();
  }

  return emails;
}

// ─── Body Part Download ─────────────────────────────────────────────────────

function findPartPath(
  structure: MessageStructureObject,
  mimeType: string
): string | null {
  // ImapFlow bodyStructure.type is the full MIME type (e.g. "text/plain")
  const fullType = structure.type?.toLowerCase() || "";

  if (fullType === mimeType) {
    return structure.part || "1";
  }

  if (structure.childNodes) {
    for (const child of structure.childNodes) {
      const result = findPartPath(child, mimeType);
      if (result) return result;
    }
  }

  return null;
}

async function downloadBodyPart(
  client: ImapFlow,
  uid: number,
  bodyStructure: MessageStructureObject | undefined,
  mimeType: string
): Promise<string | null> {
  if (!bodyStructure) return null;

  const partPath = findPartPath(bodyStructure, mimeType);
  if (!partPath) return null;

  const { content } = await client.download(String(uid), partPath, {
    uid: true,
  });

  const chunks: Buffer[] = [];
  for await (const chunk of content) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}
