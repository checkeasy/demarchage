import Anthropic from "@anthropic-ai/sdk";

// ─── Centralized Anthropic Client (lazy singleton) ──────────────────────────
// Avoids crash during `next build` by deferring initialization until first use.

let _anthropic: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ─── Model Constants ────────────────────────────────────────────────────────

export const CLAUDE_HAIKU = "claude-haiku-4-5-20251001";
export const CLAUDE_SONNET = "claude-sonnet-4-6";

// ─── Helper: Safe Text Extraction from Claude Response ──────────────────────

export function extractTextContent(response: Anthropic.Message): string {
  if (!response.content || response.content.length === 0) return "";
  const block = response.content[0];
  return block?.type === "text" ? block.text.trim() : "";
}
