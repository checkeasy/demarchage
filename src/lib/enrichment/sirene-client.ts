// ─── SIRENE / INSEE Client ──────────────────────────────────────────────────
// Queries INSEE API for newly created companies by NAF code.
// NAF codes relevant to vacation rentals:
//   6820A - Location de logements
//   5520Z - Hebergements touristiques
//   6831Z - Agences immobilieres

const SIRENE_API = "https://api.insee.fr/entreprises/sirene/V3.11";

// Target NAF codes
export const TARGET_NAF_CODES = ["6820A", "5520Z", "6831Z"];

export interface SireneResult {
  company_name: string;
  siren: string;
  siret: string;
  address: string;
  postal_code: string;
  city: string;
  naf_code: string;
  creation_date: string;
  source: "sirene";
  raw_data: Record<string, unknown>;
}

// ─── Auto-renewing OAuth2 token ─────────────────────────────────────────────
// Uses INSEE_CONSUMER_KEY + INSEE_CONSUMER_SECRET (permanent credentials)
// to auto-generate a Bearer token via client_credentials grant.
// Token is cached in memory and refreshed 5 min before expiry.

let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  // If a static token is set, use it directly (backward compat)
  if (process.env.INSEE_API_TOKEN) {
    return process.env.INSEE_API_TOKEN;
  }

  const consumerKey = process.env.INSEE_CONSUMER_KEY;
  const consumerSecret = process.env.INSEE_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return "";
  }

  // Return cached token if still valid (with 5 min margin)
  if (_cachedToken && Date.now() < _tokenExpiresAt - 5 * 60 * 1000) {
    return _cachedToken;
  }

  // Fetch new token
  try {
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const res = await fetch("https://api.insee.fr/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[SIRENE] Token refresh failed: ${res.status}`);
      return _cachedToken || "";
    }

    const data = await res.json();
    _cachedToken = data.access_token;
    // expires_in is in seconds (typically 604800 = 7 days)
    _tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    console.log(`[SIRENE] Token refreshed, expires in ${Math.round((data.expires_in || 3600) / 3600)}h`);

    return _cachedToken!;
  } catch (err) {
    console.error("[SIRENE] Token refresh error:", err);
    return _cachedToken || "";
  }
}

export async function fetchNewCompaniesByNAF(
  nafCodes: string[] = TARGET_NAF_CODES,
  since?: Date
): Promise<SireneResult[]> {
  const token = await getToken();
  if (!token) {
    console.warn("[SIRENE] INSEE credentials not configured (set INSEE_CONSUMER_KEY + INSEE_CONSUMER_SECRET), skipping");
    return [];
  }

  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
  const sinceStr = sinceDate.toISOString().split("T")[0];

  const results: SireneResult[] = [];

  for (const naf of nafCodes) {
    try {
      // Build query: companies created since date with specific NAF code
      const query = `activitePrincipaleUniteLegale:${naf} AND dateCreationUniteLegale:[${sinceStr} TO *]`;
      const params = new URLSearchParams({
        q: query,
        nombre: "50",
        tri: "dateCreationUniteLegale desc",
      });

      const res = await fetch(`${SIRENE_API}/siren?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 401) {
        console.error("[SIRENE] Invalid INSEE token (401)");
        break;
      }

      if (res.status === 404 || res.status === 204) continue; // No results
      if (!res.ok) {
        console.warn(`[SIRENE] API error for NAF ${naf}: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const units = data.unitesLegales || [];

      for (const unit of units) {
        const periods = unit.periodesUniteLegale || [];
        const current = periods[0] || {};
        const companyName = current.denominationUniteLegale
          || current.denominationUsuelleUniteLegale
          || `${current.prenomUsuelUniteLegale || ""} ${current.nomUniteLegale || ""}`.trim();

        if (!companyName) continue;

        results.push({
          company_name: companyName,
          siren: unit.siren || "",
          siret: "", // Will be filled from siret endpoint if needed
          address: "",
          postal_code: "",
          city: "",
          naf_code: naf,
          creation_date: unit.dateCreationUniteLegale || sinceStr,
          source: "sirene",
          raw_data: { unit, current_period: current },
        });
      }
    } catch (err) {
      console.error(`[SIRENE] Error for NAF ${naf}:`, err);
    }
  }

  return results;
}
