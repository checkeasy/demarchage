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
  whatsapp: { label: "WhatsApp", icon: "Phone" },
} as const;

// DB status field (CHECK constraint)
export const PROSPECT_STATUSES = {
  active: { label: "Actif", color: "bg-green-500" },
  bounced: { label: "Bounce", color: "bg-red-500" },
  unsubscribed: { label: "Desabonne", color: "bg-gray-500" },
  replied: { label: "Repondu", color: "bg-blue-500" },
  converted: { label: "Converti", color: "bg-purple-500" },
} as const;

// CRM status (stored in custom_fields.crm_status)
export const CRM_STATUSES = {
  active: { label: "En cours", color: "bg-blue-500", emoji: "🔵" },
  lost: { label: "Perdu", color: "bg-red-500", emoji: "🔴" },
  converted: { label: "Client", color: "bg-green-500", emoji: "🟢" },
} as const;

// Pipeline stages (stored in custom_fields.pipeline_stage)
export const PIPELINE_STAGES = {
  to_contact: { label: "A contacter", color: "bg-cyan-500", order: 1 },
  contacted: { label: "Contacte", color: "bg-blue-400", order: 2 },
  negotiation: { label: "En nego", color: "bg-indigo-500", order: 3 },
  demo_scheduled: { label: "Demo planifiee", color: "bg-violet-500", order: 4 },
  demo_done: { label: "Demo faite", color: "bg-purple-500", order: 5 },
  trial: { label: "Essai", color: "bg-amber-500", order: 6 },
  client: { label: "Client", color: "bg-green-500", order: 7 },
  standby: { label: "Stand-by", color: "bg-yellow-500", order: 8 },
  lost_recontact: { label: "Perdu - A relancer", color: "bg-orange-500", order: 9 },
  lost: { label: "Perdu", color: "bg-red-500", order: 10 },
} as const;

// Countries for targeting
export const COUNTRIES = {
  France: { label: "France", flag: "🇫🇷" },
  Espagne: { label: "Espagne", flag: "🇪🇸" },
  Portugal: { label: "Portugal", flag: "🇵🇹" },
  Italie: { label: "Italie", flag: "🇮🇹" },
  Suisse: { label: "Suisse", flag: "🇨🇭" },
  "Royaume-Uni": { label: "Royaume-Uni", flag: "🇬🇧" },
  Allemagne: { label: "Allemagne", flag: "🇩🇪" },
  "Pays-Bas": { label: "Pays-Bas", flag: "🇳🇱" },
  Grece: { label: "Grece", flag: "🇬🇷" },
  Croatie: { label: "Croatie", flag: "🇭🇷" },
  "Etats-Unis": { label: "Etats-Unis", flag: "🇺🇸" },
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

// Source labels for prospect source badges
export const SOURCE_LABELS = {
  manual: { label: "Manuel", className: "bg-slate-100 text-slate-700 border-slate-200" },
  csv_import: { label: "CSV", className: "bg-gray-100 text-gray-700 border-gray-200" },
  crm_import: { label: "CRM", className: "bg-amber-100 text-amber-700 border-amber-200" },
  directory_import: { label: "Annuaire", className: "bg-teal-100 text-teal-700 border-teal-200" },
  linkedin: { label: "LinkedIn", className: "bg-blue-100 text-blue-700 border-blue-200" },
  google_maps: { label: "Google Maps", className: "bg-green-100 text-green-700 border-green-200" },
  api: { label: "API", className: "bg-purple-100 text-purple-700 border-purple-200" },
} as const;

// CRM Activity types
export const ACTIVITY_TYPES = {
  call: { label: "Appel", icon: "Phone", color: "text-green-600", bgColor: "bg-green-50" },
  meeting: { label: "Reunion", icon: "Calendar", color: "text-blue-600", bgColor: "bg-blue-50" },
  email: { label: "Email", icon: "Mail", color: "text-purple-600", bgColor: "bg-purple-50" },
  task: { label: "Tache", icon: "CheckSquare", color: "text-amber-600", bgColor: "bg-amber-50" },
  follow_up: { label: "Relance", icon: "RefreshCw", color: "text-orange-600", bgColor: "bg-orange-50" },
  demo: { label: "Demo", icon: "Monitor", color: "text-indigo-600", bgColor: "bg-indigo-50" },
} as const;

export const DEAL_STATUSES = {
  open: { label: "En cours", color: "bg-blue-500" },
  won: { label: "Gagne", color: "bg-green-500" },
  lost: { label: "Perdu", color: "bg-red-500" },
} as const;

export const ACTIVITY_PRIORITIES = {
  low: { label: "Basse", color: "text-slate-500" },
  normal: { label: "Normale", color: "text-blue-500" },
  high: { label: "Haute", color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
} as const;
