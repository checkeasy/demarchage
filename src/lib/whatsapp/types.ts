// =============================================================================
// WhatsApp Module - Types & Interfaces
// =============================================================================

/**
 * Actions WhatsApp soumises au rate limiting
 */
export enum WhatsAppActionType {
  MESSAGE = 'message',
}

/**
 * Limites quotidiennes par defaut (conservateur pour eviter les bans)
 */
export const DEFAULT_DAILY_LIMITS: Record<WhatsAppActionType, { min: number; max: number }> = {
  [WhatsAppActionType.MESSAGE]: { min: 18, max: 22 },
};

// -----------------------------------------------------------------------------
// Statut du client WhatsApp
// -----------------------------------------------------------------------------

export type WhatsAppClientStatus =
  | 'disconnected'
  | 'qr_pending'
  | 'authenticating'
  | 'ready'
  | 'error';

export interface WhatsAppClientInfo {
  status: WhatsAppClientStatus;
  phoneNumber?: string;
  qrCode?: string;
  lastError?: string;
}

// -----------------------------------------------------------------------------
// Rate limiter
// -----------------------------------------------------------------------------

export interface WhatsAppRateLimitRecord {
  accountId: string;
  actionType: WhatsAppActionType;
  date: string; // YYYY-MM-DD
  count: number;
  limit: number;
}

// -----------------------------------------------------------------------------
// Erreurs
// -----------------------------------------------------------------------------

export class WhatsAppError extends Error {
  public statusCode: number;
  public errorType: WhatsAppErrorType;

  constructor(message: string, statusCode: number, errorType: WhatsAppErrorType) {
    super(message);
    this.name = 'WhatsAppError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

export enum WhatsAppErrorType {
  NOT_READY = 'NOT_READY',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_NUMBER = 'INVALID_NUMBER',
  MESSAGE_FAILED = 'MESSAGE_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}
