import {
  LayoutDashboard,
  Users,
  Search,
  Send,
  Mail,
  Inbox,
  Bot,
  Linkedin,
  Brain,
  Settings,
  MapPin,
  Shield,
  Kanban,
  CheckSquare,
  FileText,
  Target,
  Building2,
  Signal,
} from "lucide-react";

export const APP_NAME = "ColdReach";
export const APP_DESCRIPTION = "Plateforme de cold outreach multi-canal";

// ─── Navigation ──────────────────────────────────────────────────────────────

export type NavGroup = "crm" | "outreach" | "tools" | "settings" | "admin";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group: NavGroup;
}

export const NAV_ITEMS: NavItem[] = [
  // CRM
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "crm" },
  { label: "Pipeline", href: "/deals", icon: Kanban, group: "crm" },
  { label: "Activites", href: "/activities", icon: CheckSquare, group: "crm" },
  { label: "Prospects", href: "/prospects", icon: Users, group: "crm" },
  { label: "Organisations", href: "/organizations", icon: Building2, group: "crm" },
  // Outreach
  { label: "Missions", href: "/missions", icon: Target, group: "outreach" },
  { label: "Campagnes", href: "/campaigns", icon: Send, group: "outreach" },
  { label: "Emails", href: "/emails", icon: Mail, group: "outreach" },
  { label: "Inbox", href: "/inbox", icon: Inbox, group: "outreach" },
  { label: "LinkedIn", href: "/linkedin", icon: Linkedin, group: "outreach" },
  { label: "Automation", href: "/automation", icon: Bot, group: "outreach" },
  // Tools
  { label: "Scraper", href: "/scraper", icon: Search, group: "tools" },
  { label: "Google Maps", href: "/maps-scraper", icon: MapPin, group: "tools" },
  { label: "Agents IA", href: "/agents", icon: Brain, group: "tools" },
  { label: "Lead Magnets", href: "/lead-magnets", icon: FileText, group: "tools" },
  { label: "Signaux", href: "/signals", icon: Signal, group: "tools" },
  // Settings
  { label: "Parametres", href: "/settings", icon: Settings, group: "settings" },
];

export const ADMIN_NAV_ITEM: NavItem = {
  label: "Administration",
  href: "/admin",
  icon: Shield,
  group: "admin",
};

export const NAV_GROUP_ORDER: NavGroup[] = ["crm", "outreach", "tools", "settings", "admin"];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  crm: "CRM",
  outreach: "Outreach",
  tools: "Outils",
  settings: "Systeme",
  admin: "Admin",
};

/** Page titles for Header — includes sub-routes */
export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/prospects": "Prospects",
  "/prospects/import": "Importer des prospects",
  "/campaigns": "Campagnes",
  "/campaigns/new": "Nouvelle campagne",
  "/emails": "Emails envoyes",
  "/deals": "Pipeline",
  "/inbox": "Inbox",
  "/linkedin": "LinkedIn",
  "/agents": "Agents IA",
  "/settings": "Parametres",
  "/admin": "Administration",
  "/activities": "Activites",
  "/organizations": "Organisations",
  "/prospects/deduplicate": "Doublons",
  "/automation": "Automation",
  "/scraper": "Scraper",
  "/maps-scraper": "Google Maps",
  "/missions": "Missions",
  "/signals": "Signaux d'intention",
  "/onboarding": "Onboarding",
};

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

// Contact types (badge on each prospect)
export const CONTACT_TYPES = {
  prospect: { label: "Prospect", color: "bg-blue-500", textColor: "text-blue-700", bgLight: "bg-blue-50", icon: "Target" },
  lead_chaud: { label: "Lead chaud", color: "bg-orange-500", textColor: "text-orange-700", bgLight: "bg-orange-50", icon: "Flame" },
  client: { label: "Client", color: "bg-green-500", textColor: "text-green-700", bgLight: "bg-green-50", icon: "CheckCircle2" },
  ancien_client: { label: "Ancien client", color: "bg-emerald-400", textColor: "text-emerald-700", bgLight: "bg-emerald-50", icon: "History" },
  partenaire: { label: "Partenaire", color: "bg-purple-500", textColor: "text-purple-700", bgLight: "bg-purple-50", icon: "Handshake" },
  concurrent: { label: "Concurrent", color: "bg-slate-500", textColor: "text-slate-700", bgLight: "bg-slate-100", icon: "Swords" },
  influenceur: { label: "Influenceur", color: "bg-pink-500", textColor: "text-pink-700", bgLight: "bg-pink-50", icon: "Star" },
  a_recontacter: { label: "A recontacter", color: "bg-amber-500", textColor: "text-amber-700", bgLight: "bg-amber-50", icon: "Clock" },
  mauvaise_cible: { label: "Mauvaise cible", color: "bg-red-500", textColor: "text-red-700", bgLight: "bg-red-50", icon: "Ban" },
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

// Industries / Secteurs (vacation rental market segmentation)
export const INDUSTRIES: Record<string, { label: string; emoji: string }> = {
  conciergerie: { label: "Conciergerie", emoji: "🏠" },
  gestionnaire_locatif: { label: "Gestionnaire locatif", emoji: "📋" },
  proprietaire_bailleur: { label: "Proprietaire bailleur", emoji: "🔑" },
  location_vacances: { label: "Location vacances", emoji: "🌴" },
  agence_immo: { label: "Agence immobiliere", emoji: "🏢" },
  hotel: { label: "Hotel / Hostel", emoji: "🏨" },
  villa_rental: { label: "Location villas", emoji: "🏡" },
  gite: { label: "Gite / Insolite", emoji: "🏕" },
  chateau_domaine: { label: "Chateau / Domaine", emoji: "🏰" },
  residence: { label: "Residence / Aparthotel", emoji: "🏬" },
  chalet: { label: "Chalet", emoji: "⛷" },
  chambre_hote: { label: "Chambre d'hote", emoji: "🛏" },
  camping: { label: "Camping", emoji: "⛺" },
  gestion_locative: { label: "Gestion locative", emoji: "📊" },
  maison_vacances: { label: "Maison de vacances", emoji: "🏘" },
  non_classe: { label: "Non classe", emoji: "❓" },
};

// Business types (prospect relationship classification)
export const BUSINESS_TYPES: Record<string, { label: string; color: string }> = {
  client_potentiel: { label: "Client potentiel", color: "bg-green-500" },
  partenaire_potentiel: { label: "Partenaire potentiel", color: "bg-blue-500" },
  a_relancer: { label: "A relancer", color: "bg-amber-500" },
  a_concurrent: { label: "A un concurrent", color: "bg-orange-500" },
  trop_petit: { label: "Trop petit", color: "bg-slate-400" },
  traditionnel: { label: "Traditionnel", color: "bg-yellow-500" },
  sans_reponse: { label: "Sans reponse", color: "bg-gray-400" },
  perdu: { label: "Perdu", color: "bg-red-500" },
  mauvaise_cible: { label: "Mauvaise cible", color: "bg-red-300" },
  fermee: { label: "Fermee", color: "bg-gray-300" },
  donnees_invalides: { label: "Donnees invalides", color: "bg-gray-200" },
};

// Size tiers (based on nb_properties)
export const SIZE_TIERS: Record<string, { label: string; range: string }> = {
  micro: { label: "Micro", range: "1-5 biens" },
  petit: { label: "Petit", range: "6-20 biens" },
  moyen: { label: "Moyen", range: "21-50 biens" },
  grand: { label: "Grand", range: "51-100 biens" },
  tres_grand: { label: "Tres grand", range: "100+ biens" },
  inconnu: { label: "Inconnu", range: "N/A" },
};

// Tailles d'entreprise
export const EMPLOYEE_COUNTS: Record<string, { label: string }> = {
  "1-10": { label: "1-10" },
  "11-50": { label: "11-50" },
  "51-200": { label: "51-200" },
  "201-500": { label: "201-500" },
  "500+": { label: "500+" },
};

// Score IA
export const LEAD_SCORE_RANGES = {
  hot: { label: "Chaud", color: "bg-red-500", min: 80, max: 100 },
  warm: { label: "Tiede", color: "bg-orange-500", min: 50, max: 79 },
  cold: { label: "Froid", color: "bg-blue-400", min: 20, max: 49 },
  ice: { label: "Glacial", color: "bg-slate-400", min: 0, max: 19 },
} as const;

// Departements francais
export const DEPARTMENTS: Record<string, { label: string; region: string }> = {
  "01": { label: "01 - Ain", region: "Auvergne-Rhone-Alpes" },
  "02": { label: "02 - Aisne", region: "Hauts-de-France" },
  "03": { label: "03 - Allier", region: "Auvergne-Rhone-Alpes" },
  "04": { label: "04 - Alpes-de-Haute-Provence", region: "PACA" },
  "05": { label: "05 - Hautes-Alpes", region: "PACA" },
  "06": { label: "06 - Alpes-Maritimes", region: "PACA" },
  "07": { label: "07 - Ardeche", region: "Auvergne-Rhone-Alpes" },
  "08": { label: "08 - Ardennes", region: "Grand Est" },
  "09": { label: "09 - Ariege", region: "Occitanie" },
  "10": { label: "10 - Aube", region: "Grand Est" },
  "11": { label: "11 - Aude", region: "Occitanie" },
  "12": { label: "12 - Aveyron", region: "Occitanie" },
  "13": { label: "13 - Bouches-du-Rhone", region: "PACA" },
  "14": { label: "14 - Calvados", region: "Normandie" },
  "15": { label: "15 - Cantal", region: "Auvergne-Rhone-Alpes" },
  "16": { label: "16 - Charente", region: "Nouvelle-Aquitaine" },
  "17": { label: "17 - Charente-Maritime", region: "Nouvelle-Aquitaine" },
  "18": { label: "18 - Cher", region: "Centre-Val de Loire" },
  "19": { label: "19 - Correze", region: "Nouvelle-Aquitaine" },
  "20": { label: "20 - Corse", region: "Corse" },
  "21": { label: "21 - Cote-d'Or", region: "Bourgogne-Franche-Comte" },
  "22": { label: "22 - Cotes-d'Armor", region: "Bretagne" },
  "23": { label: "23 - Creuse", region: "Nouvelle-Aquitaine" },
  "24": { label: "24 - Dordogne", region: "Nouvelle-Aquitaine" },
  "25": { label: "25 - Doubs", region: "Bourgogne-Franche-Comte" },
  "26": { label: "26 - Drome", region: "Auvergne-Rhone-Alpes" },
  "27": { label: "27 - Eure", region: "Normandie" },
  "28": { label: "28 - Eure-et-Loir", region: "Centre-Val de Loire" },
  "29": { label: "29 - Finistere", region: "Bretagne" },
  "30": { label: "30 - Gard", region: "Occitanie" },
  "31": { label: "31 - Haute-Garonne", region: "Occitanie" },
  "32": { label: "32 - Gers", region: "Occitanie" },
  "33": { label: "33 - Gironde", region: "Nouvelle-Aquitaine" },
  "34": { label: "34 - Herault", region: "Occitanie" },
  "35": { label: "35 - Ille-et-Vilaine", region: "Bretagne" },
  "36": { label: "36 - Indre", region: "Centre-Val de Loire" },
  "37": { label: "37 - Indre-et-Loire", region: "Centre-Val de Loire" },
  "38": { label: "38 - Isere", region: "Auvergne-Rhone-Alpes" },
  "39": { label: "39 - Jura", region: "Bourgogne-Franche-Comte" },
  "40": { label: "40 - Landes", region: "Nouvelle-Aquitaine" },
  "41": { label: "41 - Loir-et-Cher", region: "Centre-Val de Loire" },
  "42": { label: "42 - Loire", region: "Auvergne-Rhone-Alpes" },
  "43": { label: "43 - Haute-Loire", region: "Auvergne-Rhone-Alpes" },
  "44": { label: "44 - Loire-Atlantique", region: "Pays de la Loire" },
  "45": { label: "45 - Loiret", region: "Centre-Val de Loire" },
  "46": { label: "46 - Lot", region: "Occitanie" },
  "47": { label: "47 - Lot-et-Garonne", region: "Nouvelle-Aquitaine" },
  "48": { label: "48 - Lozere", region: "Occitanie" },
  "49": { label: "49 - Maine-et-Loire", region: "Pays de la Loire" },
  "50": { label: "50 - Manche", region: "Normandie" },
  "51": { label: "51 - Marne", region: "Grand Est" },
  "52": { label: "52 - Haute-Marne", region: "Grand Est" },
  "53": { label: "53 - Mayenne", region: "Pays de la Loire" },
  "54": { label: "54 - Meurthe-et-Moselle", region: "Grand Est" },
  "55": { label: "55 - Meuse", region: "Grand Est" },
  "56": { label: "56 - Morbihan", region: "Bretagne" },
  "57": { label: "57 - Moselle", region: "Grand Est" },
  "58": { label: "58 - Nievre", region: "Bourgogne-Franche-Comte" },
  "59": { label: "59 - Nord", region: "Hauts-de-France" },
  "60": { label: "60 - Oise", region: "Hauts-de-France" },
  "61": { label: "61 - Orne", region: "Normandie" },
  "62": { label: "62 - Pas-de-Calais", region: "Hauts-de-France" },
  "63": { label: "63 - Puy-de-Dome", region: "Auvergne-Rhone-Alpes" },
  "64": { label: "64 - Pyrenees-Atlantiques", region: "Nouvelle-Aquitaine" },
  "65": { label: "65 - Hautes-Pyrenees", region: "Occitanie" },
  "66": { label: "66 - Pyrenees-Orientales", region: "Occitanie" },
  "67": { label: "67 - Bas-Rhin", region: "Grand Est" },
  "68": { label: "68 - Haut-Rhin", region: "Grand Est" },
  "69": { label: "69 - Rhone", region: "Auvergne-Rhone-Alpes" },
  "70": { label: "70 - Haute-Saone", region: "Bourgogne-Franche-Comte" },
  "71": { label: "71 - Saone-et-Loire", region: "Bourgogne-Franche-Comte" },
  "72": { label: "72 - Sarthe", region: "Pays de la Loire" },
  "73": { label: "73 - Savoie", region: "Auvergne-Rhone-Alpes" },
  "74": { label: "74 - Haute-Savoie", region: "Auvergne-Rhone-Alpes" },
  "75": { label: "75 - Paris", region: "Ile-de-France" },
  "76": { label: "76 - Seine-Maritime", region: "Normandie" },
  "77": { label: "77 - Seine-et-Marne", region: "Ile-de-France" },
  "78": { label: "78 - Yvelines", region: "Ile-de-France" },
  "79": { label: "79 - Deux-Sevres", region: "Nouvelle-Aquitaine" },
  "80": { label: "80 - Somme", region: "Hauts-de-France" },
  "81": { label: "81 - Tarn", region: "Occitanie" },
  "82": { label: "82 - Tarn-et-Garonne", region: "Occitanie" },
  "83": { label: "83 - Var", region: "PACA" },
  "84": { label: "84 - Vaucluse", region: "PACA" },
  "85": { label: "85 - Vendee", region: "Pays de la Loire" },
  "86": { label: "86 - Vienne", region: "Nouvelle-Aquitaine" },
  "87": { label: "87 - Haute-Vienne", region: "Nouvelle-Aquitaine" },
  "88": { label: "88 - Vosges", region: "Grand Est" },
  "89": { label: "89 - Yonne", region: "Bourgogne-Franche-Comte" },
  "90": { label: "90 - Territoire de Belfort", region: "Bourgogne-Franche-Comte" },
  "91": { label: "91 - Essonne", region: "Ile-de-France" },
  "92": { label: "92 - Hauts-de-Seine", region: "Ile-de-France" },
  "93": { label: "93 - Seine-Saint-Denis", region: "Ile-de-France" },
  "94": { label: "94 - Val-de-Marne", region: "Ile-de-France" },
  "95": { label: "95 - Val-d'Oise", region: "Ile-de-France" },
  "971": { label: "971 - Guadeloupe", region: "DOM-TOM" },
  "972": { label: "972 - Martinique", region: "DOM-TOM" },
  "973": { label: "973 - Guyane", region: "DOM-TOM" },
  "974": { label: "974 - Reunion", region: "DOM-TOM" },
  "976": { label: "976 - Mayotte", region: "DOM-TOM" },
};

// Zones touristiques
export const TOURIST_ZONES: Record<string, { label: string }> = {
  cote_azur: { label: "Cote d'Azur" },
  var_provence: { label: "Var / Provence" },
  marseille_aix: { label: "Marseille / Aix" },
  alpes_nord: { label: "Alpes du Nord" },
  alpes_sud: { label: "Alpes du Sud" },
  paris_idf: { label: "Paris / IDF" },
  lyon_rhone: { label: "Lyon / Rhone" },
  toulouse_occitanie: { label: "Toulouse / Occitanie" },
  languedoc: { label: "Languedoc" },
  pyrenees_orientales: { label: "Pyrenees Orientales" },
  pays_basque: { label: "Pays Basque" },
  bretagne: { label: "Bretagne" },
  normandie: { label: "Normandie" },
  bassin_arcachon: { label: "Bassin d'Arcachon" },
  bordeaux_gironde: { label: "Bordeaux / Gironde" },
  landes: { label: "Landes" },
  corse: { label: "Corse" },
  vendee_atlantique: { label: "Vendee / Atlantique" },
  charentes: { label: "Charentes" },
  ile_de_re_oleron: { label: "Ile de Re / Oleron" },
  dordogne_lot: { label: "Dordogne / Lot" },
};

// OTA strategy
export const OTA_STRATEGIES: Record<string, { label: string }> = {
  multi_ota_avance: { label: "Multi OTA (3+)" },
  multi_ota: { label: "Multi OTA (2)" },
  mono_ota: { label: "Mono OTA" },
  hors_ota: { label: "Hors OTA" },
};

// Review quality
export const REVIEW_QUALITY: Record<string, { label: string; color: string }> = {
  top_rated: { label: "Top rated (4.5+ & 10+ avis)", color: "bg-green-500" },
  excellent: { label: "Excellent (4.5+)", color: "bg-emerald-500" },
  bon: { label: "Bon (4-4.5)", color: "bg-blue-500" },
  moyen: { label: "Moyen (3-4)", color: "bg-yellow-500" },
  faible: { label: "Faible (<3)", color: "bg-red-500" },
};

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

// Call outcomes (structured results for phone activities)
export const CALL_OUTCOMES = {
  connected: { label: "Connecte", color: "text-green-600", icon: "PhoneCall" },
  no_answer: { label: "Pas de reponse", color: "text-orange-500", icon: "PhoneOff" },
  left_message: { label: "Message laisse", color: "text-blue-500", icon: "MessageSquare" },
  left_voicemail: { label: "Messagerie vocale", color: "text-indigo-500", icon: "Voicemail" },
  wrong_number: { label: "Mauvais numero", color: "text-red-500", icon: "PhoneOff" },
  busy: { label: "Occupe", color: "text-yellow-600", icon: "PhoneMissed" },
  callback_scheduled: { label: "Rappel prevu", color: "text-cyan-600", icon: "PhoneForwarded" },
} as const;

// Deal contact roles (multi-participants on deals)
export const DEAL_CONTACT_ROLES = {
  primary: { label: "Contact principal", color: "text-blue-600" },
  contact: { label: "Contact", color: "text-slate-600" },
  decision_maker: { label: "Decideur", color: "text-purple-600" },
  influencer: { label: "Influenceur", color: "text-amber-600" },
  champion: { label: "Champion", color: "text-green-600" },
  blocker: { label: "Bloqueur", color: "text-red-600" },
} as const;

// Intent Signal types (inspired by Gojiberry AI)
export const SIGNAL_TYPES: Record<string, { label: string; icon: string; color: string; defaultScore: number }> = {
  job_change: { label: "Changement de poste", icon: "Briefcase", color: "text-blue-600", defaultScore: 25 },
  funding: { label: "Levee de fonds", icon: "TrendingUp", color: "text-green-600", defaultScore: 30 },
  hiring: { label: "Recrutement en cours", icon: "UserPlus", color: "text-purple-600", defaultScore: 20 },
  competitor_engagement: { label: "Engage avec un concurrent", icon: "Swords", color: "text-orange-600", defaultScore: 35 },
  content_engagement: { label: "Engage avec notre contenu", icon: "Heart", color: "text-pink-600", defaultScore: 40 },
  website_visit: { label: "Visite du site", icon: "Globe", color: "text-cyan-600", defaultScore: 15 },
  technology_change: { label: "Changement de techno", icon: "Zap", color: "text-amber-600", defaultScore: 20 },
  social_engagement: { label: "Actif sur LinkedIn", icon: "Linkedin", color: "text-blue-500", defaultScore: 10 },
  event_attendance: { label: "Participe a un evenement", icon: "Calendar", color: "text-indigo-600", defaultScore: 20 },
  warm_intro: { label: "Introduction chaude", icon: "Handshake", color: "text-emerald-600", defaultScore: 50 },
  pain_point_detected: { label: "Point de douleur detecte", icon: "AlertTriangle", color: "text-red-600", defaultScore: 30 },
  expansion: { label: "Expansion / croissance", icon: "Rocket", color: "text-violet-600", defaultScore: 25 },
};

export const SIGNAL_SOURCES = {
  manual: { label: "Manuel" },
  linkedin: { label: "LinkedIn" },
  web_scrape: { label: "Web scraping" },
  enrichment: { label: "Enrichissement IA" },
  pipedrive: { label: "Pipedrive" },
  content_tracking: { label: "Tracking contenu" },
} as const;

// Qualification criteria (Pipedrive-style, multi-select)
export const QUALIFICATION_CRITERIA: Record<string, {
  label: string;
  icon: string;
  options: readonly { value: string; label: string }[];
}> = {
  objectif_parc: {
    label: "Objectif sur le parc",
    icon: "Target",
    options: [
      { value: "reduire", label: "Reduire" },
      { value: "maintenir", label: "Maintenir" },
      { value: "grandir", label: "Grandir" },
    ],
  },
  type_organisation: {
    label: "Type d'organisation",
    icon: "Building2",
    options: [
      { value: "interne", label: "Interne" },
      { value: "externe", label: "Externe" },
    ],
  },
  qui_controle: {
    label: "Qui realise le controle",
    icon: "ClipboardCheck",
    options: [
      { value: "agents_menage", label: "Agents de menage" },
      { value: "voyageurs", label: "Voyageurs" },
    ],
  },
  taille_conciergerie: {
    label: "Taille de la conciergerie",
    icon: "Scaling",
    options: [
      { value: "petits_moyens", label: "Petits & moyens" },
      { value: "grands", label: "Grands" },
    ],
  },
  positionnement_logement: {
    label: "Positionnement du logement",
    icon: "Star",
    options: [
      { value: "luxe", label: "Luxe" },
      { value: "haut_de_gamme", label: "Haut de gamme" },
      { value: "standard", label: "Standard" },
    ],
  },
  type_structure: {
    label: "Type de structure",
    icon: "Network",
    options: [
      { value: "independante", label: "Independante" },
      { value: "reseau_independants", label: "Reseau d'independants" },
      { value: "reseau_franchise", label: "Reseau franchise" },
    ],
  },
  region: {
    label: "Region",
    icon: "MapPin",
    options: [
      { value: "ile_de_france", label: "Ile-de-France" },
      { value: "paca", label: "PACA" },
      { value: "occitanie", label: "Occitanie" },
      { value: "nouvelle_aquitaine", label: "Nouvelle-Aquitaine" },
      { value: "auvergne_rhone_alpes", label: "Auvergne-Rhone-Alpes" },
      { value: "bretagne", label: "Bretagne" },
      { value: "pays_de_la_loire", label: "Pays de la Loire" },
      { value: "normandie", label: "Normandie" },
      { value: "grand_est", label: "Grand Est" },
      { value: "hauts_de_france", label: "Hauts-de-France" },
      { value: "bourgogne_franche_comte", label: "Bourgogne-Franche-Comte" },
      { value: "centre_val_de_loire", label: "Centre-Val de Loire" },
      { value: "corse", label: "Corse" },
      { value: "dom_tom", label: "DOM-TOM" },
      { value: "international", label: "International" },
    ],
  },
  pays: {
    label: "Pays",
    icon: "Flag",
    options: [
      { value: "france", label: "France" },
      { value: "espagne", label: "Espagne" },
      { value: "portugal", label: "Portugal" },
      { value: "italie", label: "Italie" },
      { value: "grece", label: "Grece" },
      { value: "croatie", label: "Croatie" },
      { value: "thailande", label: "Thailande" },
      { value: "maurice", label: "Maurice" },
      { value: "republique_dominicaine", label: "Republique Dominicaine" },
      { value: "maroc", label: "Maroc" },
      { value: "autre", label: "Autre" },
    ],
  },
  source_acquisition: {
    label: "Source d'acquisition",
    icon: "Megaphone",
    options: [
      { value: "google_maps", label: "Google Maps" },
      { value: "linkedin", label: "LinkedIn" },
      { value: "bouche_a_oreille", label: "Bouche a oreille" },
      { value: "site_web", label: "Site web" },
      { value: "cold_email", label: "Cold email" },
      { value: "cold_call", label: "Cold call" },
      { value: "salon", label: "Salon/Evenement" },
      { value: "partenaire", label: "Partenaire" },
      { value: "annuaire", label: "Annuaire pro" },
    ],
  },
};
