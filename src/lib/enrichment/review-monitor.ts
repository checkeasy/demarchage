import { createAdminClient } from "@/lib/supabase/admin";
import { getPlaceDetails } from "./google-places";

/**
 * Check for review changes on a prospect's Google Maps listing.
 * Compares current review_count vs stored value and creates signals on big changes.
 */
export async function checkReviewChanges(prospect: {
  id: string;
  workspace_id: string;
  google_place_id: string;
  google_review_count: number | null;
  google_rating: number | null;
}): Promise<{ changed: boolean; delta: number }> {
  const details = await getPlaceDetails(prospect.google_place_id);
  if (!details) return { changed: false, delta: 0 };

  const prevCount = prospect.google_review_count ?? 0;
  const newCount = details.user_ratings_total ?? 0;
  const newRating = details.rating ?? null;
  const delta = newCount - prevCount;

  const supabase = createAdminClient();

  // Update stored values
  await supabase
    .from("prospects")
    .update({
      google_review_count: newCount,
      google_rating: newRating,
      last_enriched_at: new Date().toISOString(),
    })
    .eq("id", prospect.id);

  if (Math.abs(delta) < 3) return { changed: false, delta };

  // Significant negative reviews
  if (newRating !== null && prospect.google_rating !== null && newRating < prospect.google_rating - 0.3 && delta >= 5) {
    await supabase.from("prospect_signals").insert({
      workspace_id: prospect.workspace_id,
      prospect_id: prospect.id,
      signal_type: "pain_point_detected",
      signal_source: "enrichment",
      title: `Chute des avis Google (${prospect.google_rating} → ${newRating}, +${delta} avis)`,
      description: "Baisse significative de la note Google avec afflux d'avis — possible probleme qualite.",
      signal_score: 25,
    });
  }

  // Significant positive growth
  if (delta >= 20) {
    await supabase.from("prospect_signals").insert({
      workspace_id: prospect.workspace_id,
      prospect_id: prospect.id,
      signal_type: "expansion",
      signal_source: "enrichment",
      title: `Forte croissance des avis Google (+${delta} avis)`,
      description: "Croissance rapide du nombre d'avis — entreprise en expansion.",
      signal_score: 15,
    });
  }

  return { changed: true, delta };
}

/**
 * Run review monitoring for top prospects in a workspace.
 */
export async function runReviewMonitoring(workspaceId: string): Promise<{
  checked: number;
  changed: number;
}> {
  const supabase = createAdminClient();

  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, workspace_id, google_place_id, google_review_count, google_rating, lead_score")
    .eq("workspace_id", workspaceId)
    .not("google_place_id", "is", null)
    .order("lead_score", { ascending: false })
    .limit(100);

  if (!prospects || prospects.length === 0) {
    return { checked: 0, changed: 0 };
  }

  let changed = 0;
  for (const p of prospects) {
    try {
      const result = await checkReviewChanges(p as {
        id: string;
        workspace_id: string;
        google_place_id: string;
        google_review_count: number | null;
        google_rating: number | null;
      });
      if (result.changed) changed++;
    } catch (err) {
      console.error(`[ReviewMonitor] Error for prospect ${p.id}:`, err);
    }
  }

  return { checked: prospects.length, changed };
}
