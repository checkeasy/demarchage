import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrichProspectWithGoogleMaps } from "@/lib/enrichment/google-places";
import { findAirbnbProfile } from "@/lib/enrichment/airbnb-detector";
import { findJobPostings } from "@/lib/enrichment/job-detector";
import { runReviewMonitoring } from "@/lib/enrichment/review-monitor";

// POST /api/cron/enrich-prospects — Batch enrichment (Google Places, Airbnb, Jobs)
export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get workspace
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

  const stats = {
    google_enriched: 0,
    airbnb_found: 0,
    jobs_found: 0,
    review_changes: 0,
    errors: 0,
  };

  // 1. Google Places enrichment — prospects without google_place_id or stale
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: toEnrich } = await admin
    .from("prospects")
    .select("id, company, organization, city, workspace_id, google_place_id, last_enriched_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .or(`google_place_id.is.null,last_enriched_at.lt.${thirtyDaysAgo.toISOString()}`)
    .order("lead_score", { ascending: false })
    .limit(50);

  if (toEnrich && toEnrich.length > 0 && process.env.GOOGLE_PLACES_API_KEY) {
    for (const p of toEnrich) {
      try {
        const result = await enrichProspectWithGoogleMaps(p as {
          id: string;
          company: string | null;
          organization: string | null;
          city: string | null;
          workspace_id: string;
        });
        if (result) stats.google_enriched++;
      } catch {
        stats.errors++;
      }
    }
  }

  // 2. Airbnb detection — top 30 prospects without airbnb_url
  const { data: toAirbnb } = await admin
    .from("prospects")
    .select("id, company, organization, city")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .is("airbnb_url", null)
    .order("lead_score", { ascending: false })
    .limit(30);

  if (toAirbnb) {
    for (const p of toAirbnb) {
      const name = (p as { organization?: string; company?: string }).organization || (p as { company?: string }).company;
      if (!name) continue;

      try {
        const result = await findAirbnbProfile(name, (p as { city?: string }).city || undefined);
        if (result) {
          // Merge enrichment_data
          const { data: current } = await admin
            .from("prospects")
            .select("enrichment_data")
            .eq("id", p.id)
            .single();

          await admin
            .from("prospects")
            .update({
              airbnb_url: result.airbnb_url,
              enrichment_data: {
                ...((current?.enrichment_data as Record<string, unknown>) || {}),
                airbnb_url: result.airbnb_url,
                airbnb_nb_properties: result.nb_properties,
              },
            })
            .eq("id", p.id);

          stats.airbnb_found++;
        }
      } catch {
        stats.errors++;
      }
    }
  }

  // 3. Job postings — top 200 prospects (check for hiring signals)
  const { data: toCheckJobs } = await admin
    .from("prospects")
    .select("id, company, organization, workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("lead_score", { ascending: false })
    .limit(200);

  if (toCheckJobs) {
    // Only check a sample (20 per run to avoid rate limiting)
    const sample = toCheckJobs.slice(0, 20);
    for (const p of sample) {
      const name = (p as { organization?: string; company?: string }).organization || (p as { company?: string }).company;
      if (!name) continue;

      try {
        const jobs = await findJobPostings(name);
        if (jobs.length > 0) {
          // Check if hiring signal already exists recently
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);

          const { data: existingSignal } = await admin
            .from("prospect_signals")
            .select("id")
            .eq("prospect_id", p.id)
            .eq("signal_type", "hiring")
            .gte("created_at", weekAgo.toISOString())
            .limit(1);

          if (!existingSignal || existingSignal.length === 0) {
            await admin.from("prospect_signals").insert({
              workspace_id: workspaceId,
              prospect_id: p.id,
              signal_type: "hiring",
              signal_source: "web_scrape",
              title: `Recrutement detecte: ${jobs[0].title.slice(0, 80)}`,
              description: `${jobs.length} offre(s) trouvee(s) — ${jobs.map((j) => j.source).join(", ")}`,
              signal_score: 20,
              signal_data: { jobs: jobs.slice(0, 3) },
              created_by: userId,
            });
            stats.jobs_found++;
          }
        }
      } catch {
        stats.errors++;
      }
    }
  }

  // 4. Review monitoring (weekly) — only on Mondays
  const today = new Date();
  if (today.getDay() === 1) {
    try {
      const reviewResult = await runReviewMonitoring(workspaceId);
      stats.review_changes = reviewResult.changed;
    } catch {
      stats.errors++;
    }
  }

  return NextResponse.json({
    success: true,
    ...stats,
  });
}
