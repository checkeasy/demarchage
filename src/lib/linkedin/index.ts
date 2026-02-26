// =============================================================================
// LinkedIn Module - Barrel Export
// =============================================================================

export { LinkedInClient, getLinkedInClient, createLinkedInClient } from './client';
export {
  canPerformAction,
  recordAction,
  getRemainingQuota,
  getAllQuotas,
  logLinkedInAction,
  sleep,
  shortSleep,
  rateLimitSleep,
} from './rate-limiter';
export {
  LinkedInActionType,
  LinkedInErrorType,
  LinkedInError,
  DEFAULT_DAILY_LIMITS,
  type LinkedInProfile,
  type LinkedInSearchResult,
  type LinkedInSearchParams,
  type LinkedInSearchResponse,
  type LinkedInCompany,
  type LinkedInConnectionInfo,
  type LinkedInConnectionStatus,
  type LinkedInMessage,
  type LinkedInAccountConfig,
  type LinkedInExperience,
  type LinkedInEducation,
  type LinkedInActionLog,
  type RateLimitRecord,
} from './types';
