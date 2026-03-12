// Smart outreach routing — classifies prospects into channel buckets
// and detects language from country.

export type OutreachBucket =
  | "email_linkedin"
  | "email_only"
  | "linkedin_only"
  | "phone_whatsapp"
  | "newsletter"
  | "incomplete";

export interface RoutingBucketConfig {
  key: OutreachBucket;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const ROUTING_BUCKETS: RoutingBucketConfig[] = [
  {
    key: "email_linkedin",
    label: "Email + LinkedIn",
    description: "Multi-canal complet",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
  {
    key: "email_only",
    label: "Email uniquement",
    description: "Sequence email",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    key: "linkedin_only",
    label: "LinkedIn uniquement",
    description: "Automatisation LinkedIn",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  {
    key: "phone_whatsapp",
    label: "WhatsApp",
    description: "Contact direct",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  {
    key: "newsletter",
    label: "Newsletter",
    description: "Prospects en standby",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  {
    key: "incomplete",
    label: "A enrichir",
    description: "Donnees manquantes",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
];

/**
 * Classify a prospect into an outreach bucket based on available contact data.
 */
export function classifyProspect(prospect: {
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
  status: string;
}): OutreachBucket {
  const hasEmail = !!prospect.email && prospect.email.trim() !== "";
  const hasLinkedin = !!prospect.linkedin_url && prospect.linkedin_url.trim() !== "";
  const hasPhone = !!prospect.phone && prospect.phone.trim() !== "";

  // Newsletter: standby with email
  if (prospect.status === "standby" && hasEmail) {
    return "newsletter";
  }

  if (hasEmail && hasLinkedin) return "email_linkedin";
  if (hasEmail) return "email_only";
  if (hasLinkedin) return "linkedin_only";
  if (hasPhone) return "phone_whatsapp";

  return "incomplete";
}

// --- Language detection ---

const FRENCH_COUNTRIES = new Set([
  "france", "belgium", "belgique", "switzerland", "suisse",
  "luxembourg", "monaco", "senegal", "morocco", "maroc",
  "tunisia", "tunisie", "cameroon", "cameroun", "congo",
  "cote d'ivoire", "madagascar", "mali", "niger",
  "burkina faso", "togo", "benin", "gabon", "haiti",
  "reunion", "guadeloupe", "martinique", "guyane", "mayotte",
]);

const SPANISH_COUNTRIES = new Set([
  "spain", "espagne", "mexico", "mexique", "colombia", "colombie",
  "argentina", "argentine", "chile", "chili", "peru", "perou",
  "venezuela", "ecuador", "equateur", "bolivia", "bolivie",
  "paraguay", "uruguay", "costa rica", "panama",
  "cuba", "dominican republic", "republique dominicaine",
  "guatemala", "honduras", "el salvador", "nicaragua",
]);

export function detectLanguage(country: string | null): "fr" | "es" | "en" {
  if (!country) return "en";
  const trimmed = country.trim().toLowerCase();
  if (FRENCH_COUNTRIES.has(trimmed)) return "fr";
  if (SPANISH_COUNTRIES.has(trimmed)) return "es";
  return "en";
}

export const LANGUAGE_CONFIG = {
  fr: { label: "Francais", flag: "FR" },
  es: { label: "Espagnol", flag: "ES" },
  en: { label: "Anglais", flag: "EN" },
} as const;
