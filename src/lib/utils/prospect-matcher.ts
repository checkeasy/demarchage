import { SupabaseClient } from '@supabase/supabase-js';

interface MatchCriteria {
  email?: string;
  linkedin_url?: string;
  organization?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
}

/**
 * Find an existing prospect by email, LinkedIn URL, or organization+name.
 * Returns the prospect ID if found, null otherwise.
 */
export async function findExistingProspect(
  supabase: SupabaseClient,
  workspaceId: string,
  criteria: MatchCriteria
): Promise<string | null> {
  // 1. Match by real email (skip placeholders)
  if (criteria.email && !criteria.email.endsWith('@crm-import.local') && !criteria.email.endsWith('@linkedin-prospect.local')) {
    const { data } = await supabase
      .from('prospects')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', criteria.email.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (data) return data.id;
  }

  // 2. Match by LinkedIn URL
  if (criteria.linkedin_url) {
    const { data } = await supabase
      .from('prospects')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('linkedin_url', criteria.linkedin_url)
      .limit(1)
      .maybeSingle();

    if (data) return data.id;
  }

  // 3. Match by organization/company + name
  const org = criteria.organization || criteria.company;
  const name = [criteria.first_name, criteria.last_name].filter(Boolean).join(' ').toLowerCase();

  if (org && name.length > 2) {
    const { data } = await supabase
      .from('prospects')
      .select('id, first_name, last_name')
      .eq('workspace_id', workspaceId)
      .eq('company', org)
      .limit(50);

    if (data) {
      for (const p of data) {
        const existingName = [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase();
        if (existingName === name) return p.id;
      }
    }
  }

  return null;
}

/**
 * Merge new data into an existing prospect without overwriting non-null values with null.
 */
export function mergeProspectData(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(incoming)) {
    if (key === 'custom_fields') {
      // Deep merge custom_fields
      const existingCf = (existing.custom_fields || {}) as Record<string, unknown>;
      const incomingCf = (value || {}) as Record<string, unknown>;
      const mergedCf: Record<string, unknown> = { ...existingCf };
      for (const [cfKey, cfVal] of Object.entries(incomingCf)) {
        if (cfVal !== null && cfVal !== undefined && cfVal !== '') {
          mergedCf[cfKey] = cfVal;
        }
      }
      merged.custom_fields = mergedCf;
    } else if (value !== null && value !== undefined && value !== '') {
      // Only overwrite if incoming value is non-empty
      merged[key] = value;
    }
    // If incoming is null/empty and existing has a value, we skip (keep existing)
  }

  // Replace placeholder email with real one
  const existingEmail = existing.email as string;
  const incomingEmail = incoming.email as string;
  if (existingEmail && (existingEmail.endsWith('@crm-import.local') || existingEmail.endsWith('@linkedin-prospect.local'))) {
    if (incomingEmail && !incomingEmail.endsWith('@crm-import.local') && !incomingEmail.endsWith('@linkedin-prospect.local')) {
      merged.email = incomingEmail.toLowerCase();
    }
  }

  return merged;
}
