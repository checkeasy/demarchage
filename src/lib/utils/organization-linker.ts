import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Extract a bare domain from a URL string.
 * e.g. "https://www.example.com/page" -> "example.com"
 */
function extractDomain(url: string): string | null {
  try {
    let cleaned = url.trim();
    if (!/^https?:\/\//i.test(cleaned)) {
      cleaned = `https://${cleaned}`;
    }
    const parsed = new URL(cleaned);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Auto-link a prospect to an existing organization, or create a new one.
 *
 * Resolution order:
 *   1. Match by exact normalized company name within the workspace
 *   2. Match by domain (if a website/domain is available)
 *   3. If no match and companyName is provided, create a new organization
 *
 * Returns the organization id if linked, or null.
 */
export async function autoLinkToOrganization(
  supabase: SupabaseClient,
  workspaceId: string,
  data: {
    prospectId: string;
    companyName?: string | null;
    website?: string | null;
  }
): Promise<string | null> {
  const { prospectId, companyName, website } = data;

  // Nothing to match on
  if (!companyName?.trim() && !website?.trim()) {
    return null;
  }

  const normalizedName = companyName?.trim().toLowerCase() ?? null;
  const domain = website ? extractDomain(website) : null;

  let orgId: string | null = null;

  // 1. Try to find by exact normalized name
  if (normalizedName) {
    const { data: byName } = await supabase
      .from("organizations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", normalizedName)
      .limit(1)
      .maybeSingle();

    if (byName) {
      orgId = byName.id;
    }
  }

  // 2. Try to find by domain
  if (!orgId && domain) {
    const { data: byDomain } = await supabase
      .from("organizations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("domain", domain)
      .limit(1)
      .maybeSingle();

    if (byDomain) {
      orgId = byDomain.id;
    }
  }

  // 3. Create new organization if we have a company name but no match
  if (!orgId && normalizedName) {
    const displayName = companyName!.trim();
    const { data: created, error } = await supabase
      .from("organizations")
      .insert({
        workspace_id: workspaceId,
        name: displayName,
        website: website?.trim() || null,
        domain,
      })
      .select("id")
      .single();

    if (!error && created) {
      orgId = created.id;
    }
  }

  // 4. Link prospect to organization
  if (orgId) {
    await supabase
      .from("prospects")
      .update({ organization_id: orgId })
      .eq("id", prospectId);
  }

  return orgId;
}
