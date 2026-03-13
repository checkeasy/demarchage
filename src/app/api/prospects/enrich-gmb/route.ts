import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrichProspectWithGoogleMaps } from "@/lib/enrichment/google-places";

// POST /api/prospects/enrich-gmb — Enrich prospect(s) with Google Places data
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const body = await request.json();
  const { prospect_ids } = body as { prospect_ids: string[] };

  if (!prospect_ids || !Array.isArray(prospect_ids) || prospect_ids.length === 0) {
    return NextResponse.json({ error: "prospect_ids array required" }, { status: 400 });
  }

  if (prospect_ids.length > 20) {
    return NextResponse.json({ error: "Max 20 prospects per batch" }, { status: 400 });
  }

  // Fetch prospects
  const { data: prospects } = await admin
    .from("prospects")
    .select("id, company, organization, city, google_place_id, last_enriched_at, workspace_id")
    .eq("workspace_id", profile.current_workspace_id)
    .in("id", prospect_ids);

  if (!prospects || prospects.length === 0) {
    return NextResponse.json({ error: "No prospects found" }, { status: 404 });
  }

  const results: Array<{ id: string; status: string; rating?: number | null }> = [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const p of prospects) {
    // Skip if recently enriched
    if (p.google_place_id && p.last_enriched_at && new Date(p.last_enriched_at) > sevenDaysAgo) {
      results.push({ id: p.id, status: "skipped_recent" });
      continue;
    }

    try {
      const enrichment = await enrichProspectWithGoogleMaps(p as {
        id: string;
        company: string | null;
        organization: string | null;
        city: string | null;
        workspace_id: string;
      });

      if (enrichment) {
        results.push({ id: p.id, status: "enriched", rating: enrichment.google_rating });
      } else {
        results.push({ id: p.id, status: "not_found" });
      }
    } catch (err) {
      console.error(`[EnrichGMB] Error for ${p.id}:`, err);
      results.push({ id: p.id, status: "error" });
    }
  }

  return NextResponse.json({
    success: true,
    enriched: results.filter((r) => r.status === "enriched").length,
    results,
  });
}
