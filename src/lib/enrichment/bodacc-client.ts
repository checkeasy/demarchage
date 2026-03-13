// ─── BODACC Client ──────────────────────────────────────────────────────────
// Queries the OpenDataSoft BODACC API for new company registrations
// related to vacation rental / conciergerie business.

const BODACC_API = "https://bodacc-datadila.opendatasoft.com/api/records/1.0/search";

const KEYWORDS = [
  "conciergerie",
  "location saisonniere",
  "gestion locative",
  "location meublee",
  "locations de vacances",
  "hebergement touristique",
  "meuble de tourisme",
  "airbnb",
  "gite",
  "chambre d'hote",
];

export interface BodaccResult {
  company_name: string;
  siren: string;
  city: string;
  department: string;
  registration_date: string;
  activity_description: string;
  source: "bodacc";
  raw_data: Record<string, unknown>;
}

export async function fetchNewRegistrations(options?: {
  since?: Date;
  limit?: number;
}): Promise<BodaccResult[]> {
  const since = options?.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const limit = options?.limit ?? 50;

  const results: BodaccResult[] = [];

  for (const keyword of KEYWORDS) {
    try {
      const params = new URLSearchParams({
        dataset: "annonces-commerciales",
        q: keyword,
        "refine.typeavis": "Immatriculation",
        rows: String(Math.min(limit, 20)),
        sort: "-dateparution",
      });

      // Filter by date
      const sinceStr = since.toISOString().split("T")[0];
      params.append("refine.dateparution", sinceStr);

      const res = await fetch(`${BODACC_API}?${params.toString()}`, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) continue;

      const data = await res.json();
      const records = data.records || [];

      for (const record of records) {
        const fields = record.fields || {};
        const companyName = fields.denomination || fields.nomcommercial || "";
        const siren = fields.registre || fields.numerodepartement || "";

        if (!companyName) continue;

        // Avoid duplicates
        if (results.some((r) => r.siren === siren && r.company_name === companyName)) continue;

        results.push({
          company_name: companyName,
          siren,
          city: fields.ville || "",
          department: fields.numerodepartement || "",
          registration_date: fields.dateparution || sinceStr,
          activity_description: fields.activite || keyword,
          source: "bodacc",
          raw_data: fields,
        });
      }
    } catch (err) {
      console.error(`[BODACC] Error searching "${keyword}":`, err);
    }
  }

  return results;
}
