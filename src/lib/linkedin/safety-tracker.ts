// =============================================================================
// LinkedIn Safety Tracker
// Suit les actions LinkedIn pour rester sous les seuils de détection
// Stockage en localStorage côté client
// =============================================================================

export interface LinkedInLimits {
  searches: { daily: number; hourly: number };
  profileViews: { daily: number; hourly: number };
  connectionRequests: { daily: number; weekly: number };
  messages: { daily: number; weekly: number };
  enrichments: { daily: number; hourly: number };
}

export interface ActionLog {
  type: 'search' | 'profileView' | 'connectionRequest' | 'message' | 'enrichment';
  timestamp: number;
}

export interface SafetyStatus {
  overall: 'safe' | 'warning' | 'danger';
  overallScore: number; // 0-100 (100 = safe)
  categories: {
    searches: CategoryStatus;
    profileViews: CategoryStatus;
    connectionRequests: CategoryStatus;
    messages: CategoryStatus;
    enrichments: CategoryStatus;
  };
  recommendations: string[];
}

export interface CategoryStatus {
  label: string;
  current: number;
  limit: number;
  percentage: number;
  status: 'safe' | 'warning' | 'danger';
  period: string;
}

// Limites conservatrices pour un compte établi
const SAFE_LIMITS: LinkedInLimits = {
  searches: { daily: 30, hourly: 10 },
  profileViews: { daily: 80, hourly: 20 },
  connectionRequests: { daily: 20, weekly: 80 },
  messages: { daily: 40, weekly: 100 },
  enrichments: { daily: 50, hourly: 15 },
};

const STORAGE_KEY = 'linkedin_safety_actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function hoursAgo(hours: number): number {
  return now() - hours * 60 * 60 * 1000;
}

function daysAgo(days: number): number {
  return now() - days * 24 * 60 * 60 * 1000;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function getActions(): ActionLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const actions: ActionLog[] = JSON.parse(raw);
    // Nettoyer les actions de plus de 7 jours
    const weekAgo = daysAgo(7);
    return actions.filter((a) => a.timestamp > weekAgo);
  } catch {
    return [];
  }
}

function saveActions(actions: ActionLog[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Garder seulement les 7 derniers jours
    const weekAgo = daysAgo(7);
    const cleaned = actions.filter((a) => a.timestamp > weekAgo);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // localStorage plein ou indisponible
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function trackAction(type: ActionLog['type']): void {
  const actions = getActions();
  actions.push({ type, timestamp: now() });
  saveActions(actions);
}

export function getActionCount(
  type: ActionLog['type'],
  period: 'hour' | 'day' | 'week'
): number {
  const actions = getActions();
  const since =
    period === 'hour' ? hoursAgo(1) :
    period === 'day' ? hoursAgo(24) :
    daysAgo(7);

  return actions.filter((a) => a.type === type && a.timestamp > since).length;
}

export function getSafetyStatus(): SafetyStatus {
  const categories = {
    searches: getCategoryStatus(
      'Recherches',
      'search',
      SAFE_LIMITS.searches.daily,
      'day',
      'Aujourd\'hui'
    ),
    profileViews: getCategoryStatus(
      'Vues de profil',
      'profileView',
      SAFE_LIMITS.profileViews.daily,
      'day',
      'Aujourd\'hui'
    ),
    connectionRequests: getCategoryStatus(
      'Demandes de connexion',
      'connectionRequest',
      SAFE_LIMITS.connectionRequests.daily,
      'day',
      'Aujourd\'hui'
    ),
    messages: getCategoryStatus(
      'Messages',
      'message',
      SAFE_LIMITS.messages.daily,
      'day',
      'Aujourd\'hui'
    ),
    enrichments: getCategoryStatus(
      'Enrichissements',
      'enrichment',
      SAFE_LIMITS.enrichments.daily,
      'day',
      'Aujourd\'hui'
    ),
  };

  // Vérifier aussi les limites hebdomadaires
  const weeklyConnections = getActionCount('connectionRequest', 'week');
  const weeklyConnectionPct = (weeklyConnections / SAFE_LIMITS.connectionRequests.weekly) * 100;
  if (weeklyConnectionPct > categories.connectionRequests.percentage) {
    categories.connectionRequests = {
      ...categories.connectionRequests,
      current: weeklyConnections,
      limit: SAFE_LIMITS.connectionRequests.weekly,
      percentage: weeklyConnectionPct,
      status: weeklyConnectionPct >= 90 ? 'danger' : weeklyConnectionPct >= 60 ? 'warning' : 'safe',
      period: 'Cette semaine',
    };
  }

  // Score global = la pire catégorie
  const percentages = Object.values(categories).map((c) => c.percentage);
  const worstPercentage = Math.max(...percentages, 0);
  const overallScore = Math.max(0, Math.round(100 - worstPercentage));

  const overall: SafetyStatus['overall'] =
    worstPercentage >= 90 ? 'danger' :
    worstPercentage >= 60 ? 'warning' :
    'safe';

  // Recommandations
  const recommendations: string[] = [];

  if (categories.searches.percentage >= 60) {
    recommendations.push('Reduisez le nombre de recherches. Affinez vos filtres pour moins de requetes.');
  }
  if (categories.connectionRequests.percentage >= 60) {
    recommendations.push('Espacez vos demandes de connexion. Max 20/jour, 80/semaine.');
  }
  if (categories.enrichments.percentage >= 60) {
    recommendations.push('Ralentissez les enrichissements. Attendez entre chaque profil.');
  }

  // Vérifier les limites horaires
  const searchesHour = getActionCount('search', 'hour');
  if (searchesHour >= SAFE_LIMITS.searches.hourly * 0.8) {
    recommendations.push(`${searchesHour}/${SAFE_LIMITS.searches.hourly} recherches cette heure. Faites une pause de 15-30 min.`);
  }

  const enrichHour = getActionCount('enrichment', 'hour');
  if (enrichHour >= SAFE_LIMITS.enrichments.hourly * 0.8) {
    recommendations.push(`${enrichHour}/${SAFE_LIMITS.enrichments.hourly} enrichissements cette heure. Patientez avant de continuer.`);
  }

  if (recommendations.length === 0 && overall === 'safe') {
    recommendations.push('Votre activite est dans les limites normales.');
  }

  return { overall, overallScore, categories, recommendations };
}

function getCategoryStatus(
  label: string,
  type: ActionLog['type'],
  limit: number,
  period: 'hour' | 'day' | 'week',
  periodLabel: string
): CategoryStatus {
  const current = getActionCount(type, period);
  const percentage = Math.min((current / limit) * 100, 100);

  return {
    label,
    current,
    limit,
    percentage,
    status: percentage >= 90 ? 'danger' : percentage >= 60 ? 'warning' : 'safe',
    period: periodLabel,
  };
}

export function resetTracker(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getLimits(): LinkedInLimits {
  return SAFE_LIMITS;
}
