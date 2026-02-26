export const APP_NAME = "ColdReach";
export const APP_DESCRIPTION = "Plateforme de cold outreach multi-canal";

export const PLANS = {
  free: { name: "Gratuit", dailyLimit: 50, campaigns: 3, prospects: 500 },
  starter: { name: "Starter", dailyLimit: 200, campaigns: 10, prospects: 5000 },
  pro: { name: "Pro", dailyLimit: 1000, campaigns: -1, prospects: -1 },
  enterprise: { name: "Enterprise", dailyLimit: -1, campaigns: -1, prospects: -1 },
} as const;

export const STEP_TYPES = {
  email: { label: "Email", icon: "Mail" },
  delay: { label: "Delai", icon: "Clock" },
  linkedin_connect: { label: "LinkedIn - Connexion", icon: "UserPlus" },
  linkedin_message: { label: "LinkedIn - Message", icon: "MessageSquare" },
  condition: { label: "Condition", icon: "GitBranch" },
} as const;

export const PROSPECT_STATUSES = {
  active: { label: "Actif", color: "bg-green-500" },
  bounced: { label: "Bounce", color: "bg-red-500" },
  unsubscribed: { label: "Desabonne", color: "bg-gray-500" },
  replied: { label: "Repondu", color: "bg-blue-500" },
  converted: { label: "Converti", color: "bg-purple-500" },
} as const;

export const CAMPAIGN_STATUSES = {
  draft: { label: "Brouillon", color: "bg-gray-500" },
  active: { label: "Active", color: "bg-green-500" },
  paused: { label: "En pause", color: "bg-yellow-500" },
  completed: { label: "Terminee", color: "bg-blue-500" },
  archived: { label: "Archivee", color: "bg-gray-400" },
} as const;

export const DEFAULT_SENDING_WINDOW = {
  start: "08:00",
  end: "18:00",
  days: [1, 2, 3, 4, 5], // Mon-Fri
  timezone: "Europe/Paris",
};
