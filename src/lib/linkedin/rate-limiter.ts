// =============================================================================
// LinkedIn Rate Limiter
// Gère les quotas quotidiens par compte LinkedIn et les délais entre actions
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  LinkedInActionType,
  DEFAULT_DAILY_LIMITS,
  type RateLimitRecord,
} from './types';

// -----------------------------------------------------------------------------
// Cache mémoire pour les compteurs (évite d'appeler Supabase à chaque action)
// -----------------------------------------------------------------------------

const memoryCache = new Map<string, RateLimitRecord>();

function getCacheKey(accountId: string, actionType: LinkedInActionType, date: string): string {
  return `${accountId}:${actionType}:${date}`;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Génère une limite quotidienne aléatoire entre min et max
 * pour rendre le comportement moins prévisible par LinkedIn
 */
function getRandomDailyLimit(actionType: LinkedInActionType): number {
  const range = DEFAULT_DAILY_LIMITS[actionType];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// -----------------------------------------------------------------------------
// Fonctions principales
// -----------------------------------------------------------------------------

/**
 * Vérifie si une action peut être effectuée sans dépasser le quota quotidien
 */
export async function canPerformAction(
  accountId: string,
  actionType: LinkedInActionType
): Promise<boolean> {
  const today = getTodayDate();
  const record = await getOrCreateRecord(accountId, actionType, today);
  return record.count < record.limit;
}

/**
 * Enregistre une action effectuée et met à jour le compteur
 */
export async function recordAction(
  accountId: string,
  actionType: LinkedInActionType
): Promise<void> {
  const today = getTodayDate();
  const record = await getOrCreateRecord(accountId, actionType, today);

  record.count += 1;

  // Mise à jour du cache mémoire
  const key = getCacheKey(accountId, actionType, today);
  memoryCache.set(key, record);

  // Persistance dans Supabase (fire-and-forget pour ne pas bloquer)
  persistRecord(record).catch((err) => {
    console.error('[LinkedIn RateLimiter] Erreur persistance Supabase:', err);
  });
}

/**
 * Retourne le nombre d'actions restantes pour aujourd'hui
 */
export async function getRemainingQuota(
  accountId: string,
  actionType: LinkedInActionType
): Promise<number> {
  const today = getTodayDate();
  const record = await getOrCreateRecord(accountId, actionType, today);
  return Math.max(0, record.limit - record.count);
}

/**
 * Retourne les quotas complets pour un compte
 */
export async function getAllQuotas(
  accountId: string
): Promise<Record<LinkedInActionType, { used: number; limit: number; remaining: number }>> {
  const result = {} as Record<LinkedInActionType, { used: number; limit: number; remaining: number }>;

  for (const actionType of Object.values(LinkedInActionType)) {
    const remaining = await getRemainingQuota(accountId, actionType);
    const today = getTodayDate();
    const record = await getOrCreateRecord(accountId, actionType, today);
    result[actionType] = {
      used: record.count,
      limit: record.limit,
      remaining,
    };
  }

  return result;
}

/**
 * Délai aléatoire entre actions pour simuler un comportement humain
 * @param minSeconds - Délai minimum en secondes (défaut: 2)
 * @param maxSeconds - Délai maximum en secondes (défaut: 8)
 */
export function sleep(minSeconds = 2, maxSeconds = 8): Promise<void> {
  const delayMs = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Délai aléatoire plus court pour les actions rapides
 */
export function shortSleep(): Promise<void> {
  return sleep(1, 3);
}

/**
 * Délai plus long après une erreur rate-limit
 */
export function rateLimitSleep(): Promise<void> {
  return sleep(30, 60);
}

// -----------------------------------------------------------------------------
// Fonctions internes
// -----------------------------------------------------------------------------

async function getOrCreateRecord(
  accountId: string,
  actionType: LinkedInActionType,
  date: string
): Promise<RateLimitRecord> {
  const key = getCacheKey(accountId, actionType, date);

  // Vérifier le cache mémoire d'abord
  const cached = memoryCache.get(key);
  if (cached) {
    return cached;
  }

  // Sinon, chercher dans Supabase
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('linkedin_rate_limits')
      .select('*')
      .eq('account_id', accountId)
      .eq('action_type', actionType)
      .eq('date', date)
      .single();

    if (data) {
      const record: RateLimitRecord = {
        accountId: data.account_id,
        actionType: data.action_type as LinkedInActionType,
        date: data.date,
        count: data.count,
        limit: data.daily_limit,
      };
      memoryCache.set(key, record);
      return record;
    }
  } catch {
    // Table n'existe pas encore ou erreur réseau - on continue avec le cache
  }

  // Créer un nouveau record
  const record: RateLimitRecord = {
    accountId,
    actionType,
    date,
    count: 0,
    limit: getRandomDailyLimit(actionType),
  };
  memoryCache.set(key, record);

  return record;
}

async function persistRecord(record: RateLimitRecord): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from('linkedin_rate_limits')
      .upsert(
        {
          account_id: record.accountId,
          action_type: record.actionType,
          date: record.date,
          count: record.count,
          daily_limit: record.limit,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'account_id,action_type,date',
        }
      );
  } catch (err) {
    // Silencieux - la table n'existe peut-être pas encore
    console.warn('[LinkedIn RateLimiter] Impossible de persister dans Supabase:', err);
  }
}

/**
 * Enregistre une action dans le log d'activité LinkedIn (pour audit/analytics)
 */
export async function logLinkedInAction(params: {
  workspaceId: string;
  accountId: string;
  actionType: LinkedInActionType;
  targetProfileId?: string | null;
  targetPublicId?: string | null;
  payload?: Record<string, unknown> | null;
  status: 'success' | 'failed' | 'rate_limited';
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('linkedin_action_logs').insert({
      workspace_id: params.workspaceId,
      account_id: params.accountId,
      action_type: params.actionType,
      target_profile_id: params.targetProfileId ?? null,
      target_public_id: params.targetPublicId ?? null,
      payload: params.payload ?? null,
      status: params.status,
      error_message: params.errorMessage ?? null,
    });
  } catch (err) {
    console.error('[LinkedIn ActionLog] Erreur enregistrement:', err);
  }
}
