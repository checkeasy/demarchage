// =============================================================================
// WhatsApp Rate Limiter
// Gere les quotas quotidiens pour eviter les bans WhatsApp
// Meme pattern que src/lib/linkedin/rate-limiter.ts
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  WhatsAppActionType,
  DEFAULT_DAILY_LIMITS,
  type WhatsAppRateLimitRecord,
} from './types';

// -----------------------------------------------------------------------------
// Cache memoire
// -----------------------------------------------------------------------------

const memoryCache = new Map<string, WhatsAppRateLimitRecord>();

function getCacheKey(accountId: string, actionType: WhatsAppActionType, date: string): string {
  return `wa:${accountId}:${actionType}:${date}`;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getRandomDailyLimit(actionType: WhatsAppActionType): number {
  const range = DEFAULT_DAILY_LIMITS[actionType];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// -----------------------------------------------------------------------------
// Fonctions principales
// -----------------------------------------------------------------------------

export async function canPerformAction(
  accountId: string,
  actionType: WhatsAppActionType
): Promise<boolean> {
  const today = getTodayDate();
  const record = await getOrCreateRecord(accountId, actionType, today);
  return record.count < record.limit;
}

export async function recordAction(
  accountId: string,
  actionType: WhatsAppActionType
): Promise<void> {
  const today = getTodayDate();
  const record = await getOrCreateRecord(accountId, actionType, today);

  record.count += 1;

  const key = getCacheKey(accountId, actionType, today);
  memoryCache.set(key, record);

  persistRecord(record).catch((err) => {
    console.error('[WhatsApp RateLimiter] Erreur persistance Supabase:', err);
  });
}

export async function getRemainingQuota(
  accountId: string,
  actionType: WhatsAppActionType
): Promise<number> {
  const today = getTodayDate();
  const record = await getOrCreateRecord(accountId, actionType, today);
  return Math.max(0, record.limit - record.count);
}

/**
 * Delai aleatoire entre messages pour simuler un comportement humain
 */
export function sleep(minSeconds = 3, maxSeconds = 8): Promise<void> {
  const delayMs = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

// -----------------------------------------------------------------------------
// Fonctions internes
// -----------------------------------------------------------------------------

async function getOrCreateRecord(
  accountId: string,
  actionType: WhatsAppActionType,
  date: string
): Promise<WhatsAppRateLimitRecord> {
  const key = getCacheKey(accountId, actionType, date);

  const cached = memoryCache.get(key);
  if (cached) {
    return cached;
  }

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('whatsapp_rate_limits')
      .select('*')
      .eq('account_id', accountId)
      .eq('action_type', actionType)
      .eq('date', date)
      .single();

    if (data) {
      const record: WhatsAppRateLimitRecord = {
        accountId: data.account_id,
        actionType: data.action_type as WhatsAppActionType,
        date: data.date,
        count: data.count,
        limit: data.daily_limit,
      };
      memoryCache.set(key, record);
      return record;
    }
  } catch {
    // Table n'existe pas encore ou erreur - on continue avec le cache
  }

  const record: WhatsAppRateLimitRecord = {
    accountId,
    actionType,
    date,
    count: 0,
    limit: getRandomDailyLimit(actionType),
  };
  memoryCache.set(key, record);

  return record;
}

async function persistRecord(record: WhatsAppRateLimitRecord): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from('whatsapp_rate_limits')
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
    console.warn('[WhatsApp RateLimiter] Impossible de persister dans Supabase:', err);
  }
}

/**
 * Enregistre une action WhatsApp dans les logs (audit/analytics)
 */
export async function logWhatsAppAction(params: {
  workspaceId: string;
  prospectId?: string | null;
  phoneNumber?: string | null;
  messageText?: string | null;
  status: 'success' | 'failed' | 'rate_limited' | 'invalid_number';
  errorMessage?: string | null;
  waMessageId?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('whatsapp_action_logs').insert({
      workspace_id: params.workspaceId,
      prospect_id: params.prospectId ?? null,
      phone_number: params.phoneNumber ?? null,
      message_text: params.messageText ?? null,
      action_type: 'message',
      status: params.status,
      error_message: params.errorMessage ?? null,
      wa_message_id: params.waMessageId ?? null,
    });
  } catch (err) {
    console.error('[WhatsApp ActionLog] Erreur enregistrement:', err);
  }
}
