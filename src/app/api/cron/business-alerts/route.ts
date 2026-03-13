import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchNewRegistrations } from "@/lib/enrichment/bodacc-client";
import { fetchNewCompaniesByNAF, TARGET_NAF_CODES } from "@/lib/enrichment/sirene-client";

// POST /api/cron/business-alerts — Detect new companies from BODACC + SIRENE
export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get first workspace (single-tenant for now)
  const { data: profile } = await admin
    .from("profiles")
    .select("id, current_workspace_id")
    .limit(1)
    .single();

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "No workspace" }, { status: 500 });
  }

  const workspaceId = profile.current_workspace_id;
  const userId = profile.id;

  // Run BODACC + SIRENE in parallel
  const [bodaccResults, sireneResults] = await Promise.all([
    fetchNewRegistrations().catch((err) => {
      console.error("[BusinessAlerts] BODACC error:", err);
      return [];
    }),
    fetchNewCompaniesByNAF(TARGET_NAF_CODES).catch((err) => {
      console.error("[BusinessAlerts] SIRENE error:", err);
      return [];
    }),
  ]);

  let alertsCreated = 0;
  let prospectsCreated = 0;

  // Normalize results to a common shape
  interface NormalizedResult {
    alert_type: string;
    company_name: string;
    siren: string;
    city: string;
    naf_code: string | null;
    source: string;
    raw_data: Record<string, unknown>;
    date: string;
  }

  const allResults: NormalizedResult[] = [
    ...bodaccResults.map((r) => ({
      alert_type: "new_company",
      company_name: r.company_name,
      siren: r.siren,
      city: r.city,
      naf_code: null as string | null,
      source: r.source,
      raw_data: r.raw_data,
      date: r.registration_date,
    })),
    ...sireneResults.map((r) => ({
      alert_type: "new_company",
      company_name: r.company_name,
      siren: r.siren,
      city: r.city,
      naf_code: r.naf_code,
      source: r.source,
      raw_data: r.raw_data,
      date: r.creation_date,
    })),
  ];

  for (const result of allResults) {
    // Check if alert already exists for this SIREN
    if (result.siren) {
      const { data: existing } = await admin
        .from("business_alerts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("siren", result.siren)
        .limit(1);

      if (existing && existing.length > 0) continue;
    }

    // Insert alert
    const { data: alert } = await admin
      .from("business_alerts")
      .insert({
        workspace_id: workspaceId,
        alert_type: result.alert_type,
        company_name: result.company_name,
        siren: result.siren || null,
        city: result.city || null,
        naf_code: result.naf_code || null,
        source: result.source,
        data: result.raw_data,
        detected_at: result.date || new Date().toISOString(),
      })
      .select("id")
      .single();

    if (alert) alertsCreated++;

    // Auto-create prospect for high-confidence matches (NAF 5520Z or 6820A)
    const isHighConfidence = result.naf_code && ["5520Z", "6820A"].includes(result.naf_code);
    if (isHighConfidence && result.company_name) {
      // Check if prospect already exists
      const { data: existingProspect } = await admin
        .from("prospects")
        .select("id")
        .eq("workspace_id", workspaceId)
        .ilike("company", result.company_name)
        .limit(1);

      if (!existingProspect || existingProspect.length === 0) {
        const { data: newProspect } = await admin
          .from("prospects")
          .insert({
            workspace_id: workspaceId,
            company: result.company_name,
            city: result.city || null,
            source: "api",
            status: "active",
            created_by: userId,
          })
          .select("id")
          .single();

        if (newProspect) {
          prospectsCreated++;

          // Link prospect to alert
          if (alert) {
            await admin
              .from("business_alerts")
              .update({ prospect_id: newProspect.id, is_processed: true })
              .eq("id", alert.id);
          }

          // Create signal on prospect
          await admin.from("prospect_signals").insert({
            workspace_id: workspaceId,
            prospect_id: newProspect.id,
            signal_type: "expansion",
            signal_source: "enrichment",
            title: `Nouvelle entreprise detectee (${result.source.toUpperCase()})`,
            description: `${result.company_name} — ${result.city || "France"} — NAF ${result.naf_code || "N/A"}`,
            signal_score: 25,
            created_by: userId,
          });
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    bodacc_results: bodaccResults.length,
    sirene_results: sireneResults.length,
    alerts_created: alertsCreated,
    prospects_created: prospectsCreated,
  });
}
