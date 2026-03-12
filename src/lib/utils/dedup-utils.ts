/**
 * Utility functions for prospect deduplication.
 */

const PLACEHOLDER_DOMAINS = [
  "@crm-import.local",
  "@directory-import.local",
  "@linkedin-prospect.local",
];

/**
 * Normalize an email address for dedup comparison.
 * Returns null for placeholder/fake emails.
 */
export function normalizeEmail(email: string): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;

  for (const domain of PLACEHOLDER_DOMAINS) {
    if (trimmed.endsWith(domain)) return null;
  }

  return trimmed;
}

/**
 * Extract a clean domain from a website URL.
 * Strips protocol, www., trailing slashes and paths.
 */
export function extractDomain(website: string): string | null {
  if (!website) return null;
  let domain = website.trim().toLowerCase();
  if (!domain) return null;

  // Strip protocol
  domain = domain.replace(/^https?:\/\//, "");
  // Strip www.
  domain = domain.replace(/^www\./, "");
  // Strip path, query, hash, trailing slash
  domain = domain.split("/")[0].split("?")[0].split("#")[0];
  // Strip trailing dot
  domain = domain.replace(/\.$/, "");

  if (!domain || !domain.includes(".")) return null;

  return domain;
}

/**
 * Normalize a phone number by stripping non-digit characters.
 * Returns null if fewer than 7 digits remain.
 */
export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits;
}

const LEGAL_SUFFIXES_PATTERN = new RegExp(
  "\\b(sarl|sas|sasu|eurl|sci|sa|gmbh|ltd|llc|inc|corp)\\.?\\b",
  "gi"
);

/**
 * Normalize a company name for fuzzy dedup matching.
 * Lowercases, trims, and removes common legal suffixes.
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return "";
  let normalized = name.trim().toLowerCase();
  // Remove legal suffixes
  normalized = normalized.replace(LEGAL_SUFFIXES_PATTERN, "");
  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}
