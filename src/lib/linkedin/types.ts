// =============================================================================
// LinkedIn Module - Types & Interfaces
// =============================================================================

/**
 * Actions LinkedIn soumises au rate limiting
 */
export enum LinkedInActionType {
  SEARCH = 'search',
  VIEW = 'view',
  CONNECT = 'connect',
  MESSAGE = 'message',
  WITHDRAW = 'withdraw',
}

/**
 * Limites quotidiennes par défaut par compte LinkedIn
 */
export const DEFAULT_DAILY_LIMITS: Record<LinkedInActionType, { min: number; max: number }> = {
  [LinkedInActionType.SEARCH]: { min: 25, max: 30 },
  [LinkedInActionType.VIEW]: { min: 80, max: 150 },
  [LinkedInActionType.CONNECT]: { min: 20, max: 25 },
  [LinkedInActionType.MESSAGE]: { min: 50, max: 100 },
  [LinkedInActionType.WITHDRAW]: { min: 50, max: 50 },
};

// -----------------------------------------------------------------------------
// Configuration du compte LinkedIn
// -----------------------------------------------------------------------------

export interface LinkedInAccountConfig {
  /** Cookie li_at de session LinkedIn */
  liAt: string;
  /** Cookie JSESSIONID (sans les guillemets) */
  jsessionId: string;
  /** URL du proxy optionnel (ex: http://user:pass@proxy:port) */
  proxyUrl?: string;
  /** Limites quotidiennes personnalisées (sinon DEFAULT_DAILY_LIMITS) */
  dailyLimits?: Partial<Record<LinkedInActionType, number>>;
}

// -----------------------------------------------------------------------------
// Profil LinkedIn
// -----------------------------------------------------------------------------

export interface LinkedInProfile {
  profileId: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  summary: string | null;
  location: string | null;
  industryName: string | null;
  profileUrl: string;
  profilePictureUrl: string | null;
  connectionDegree: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
  emailAddress: string | null;
}

export interface LinkedInExperience {
  title: string;
  companyName: string;
  companyId: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  isCurrent: boolean;
}

export interface LinkedInEducation {
  schoolName: string;
  degreeName: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
}

// -----------------------------------------------------------------------------
// Résultats de recherche
// -----------------------------------------------------------------------------

export interface LinkedInSearchResult {
  profileId: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  location: string | null;
  profileUrl: string;
  profilePictureUrl: string | null;
  connectionDegree: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
}

export interface LinkedInSearchParams {
  /** Mots-clés de recherche */
  keywords?: string;
  /** Filtre par titre de poste */
  title?: string;
  /** Filtre par localisation (ex: "France", "Paris") */
  location?: string;
  /** Filtre par secteur d'activité */
  industry?: string;
  /** Filtre par taille d'entreprise (ex: "B", "C", "D" = 11-50, 51-200, 201-500) */
  companySize?: string[];
  /** Filtre par nom d'entreprise */
  company?: string;
  /** Filtre par école */
  school?: string;
  /** Filtre par degré de connexion (F=1st, S=2nd, O=3rd+) */
  connectionOf?: string;
  /** Filtre par réseau (F, S, O) */
  network?: ('F' | 'S' | 'O')[];
  /** Début de la pagination (offset) */
  start?: number;
  /** Nombre de résultats par page (max 49) */
  count?: number;
}

export interface LinkedInSearchResponse {
  results: LinkedInSearchResult[];
  total: number;
  start: number;
  count: number;
  hasMore: boolean;
}

// -----------------------------------------------------------------------------
// Entreprise LinkedIn
// -----------------------------------------------------------------------------

export interface LinkedInCompany {
  companyId: string;
  name: string;
  universalName: string | null;
  description: string | null;
  industry: string | null;
  companySize: string | null;
  employeeCount: number | null;
  website: string | null;
  headquartersLocation: string | null;
  logoUrl: string | null;
  specialities: string[];
}

// -----------------------------------------------------------------------------
// Statut de connexion
// -----------------------------------------------------------------------------

export type LinkedInConnectionStatus =
  | 'not_connected'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'connected'
  | 'unknown';

export interface LinkedInConnectionInfo {
  status: LinkedInConnectionStatus;
  invitationId?: string;
  connectedAt?: string;
}

// -----------------------------------------------------------------------------
// Message LinkedIn
// -----------------------------------------------------------------------------

export interface LinkedInMessage {
  profileUrn: string;
  body: string;
  subject?: string;
}

export interface LinkedInConversation {
  conversationUrn: string;
  participantUrns: string[];
  lastMessageText: string | null;
  lastMessageSenderUrn: string | null;
  lastMessageAt: string | null;
}

// -----------------------------------------------------------------------------
// Erreurs
// -----------------------------------------------------------------------------

export class LinkedInError extends Error {
  public statusCode: number;
  public errorType: LinkedInErrorType;

  constructor(message: string, statusCode: number, errorType: LinkedInErrorType) {
    super(message);
    this.name = 'LinkedInError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

export enum LinkedInErrorType {
  RATE_LIMITED = 'RATE_LIMITED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// -----------------------------------------------------------------------------
// Rate limiter
// -----------------------------------------------------------------------------

export interface RateLimitRecord {
  accountId: string;
  actionType: LinkedInActionType;
  date: string; // YYYY-MM-DD
  count: number;
  limit: number;
}

export interface LinkedInActionLog {
  id?: string;
  workspace_id: string;
  account_id: string;
  action_type: LinkedInActionType;
  target_profile_id: string | null;
  target_public_id: string | null;
  payload: Record<string, unknown> | null;
  status: 'success' | 'failed' | 'rate_limited';
  error_message: string | null;
  created_at?: string;
}
