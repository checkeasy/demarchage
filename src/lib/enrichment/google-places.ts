import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: { location: { lat: number; lng: number } };
}

interface PlaceDetails {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  formatted_address?: string;
  url?: string; // Google Maps URL
  opening_hours?: { weekday_text?: string[] };
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
    relative_time_description: string;
  }>;
}

export interface EnrichmentResult {
  google_place_id: string;
  google_rating: number | null;
  google_review_count: number;
  google_maps_url: string | null;
  phone?: string;
  website?: string;
  address?: string;
  reviews?: PlaceDetails["reviews"];
}

// ─── Rate limiter ───────────────────────────────────────────────────────────

const REQUEST_QUEUE: Array<() => Promise<void>> = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;
  while (REQUEST_QUEUE.length > 0) {
    const fn = REQUEST_QUEUE.shift();
    if (fn) {
      await fn();
      await new Promise((r) => setTimeout(r, 100)); // 10 req/sec max
    }
  }
  processing = false;
}

function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    REQUEST_QUEUE.push(async () => {
      try {
        resolve(await fn());
      } catch (err) {
        reject(err);
      }
    });
    processQueue();
  });
}

// ─── API Calls ──────────────────────────────────────────────────────────────

const API_KEY = () => process.env.GOOGLE_PLACES_API_KEY || "";

export async function findPlace(
  businessName: string,
  city?: string
): Promise<PlaceSearchResult | null> {
  return rateLimited(async () => {
    const query = city ? `${businessName} ${city}` : businessName;
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address,rating,user_ratings_total,geometry&key=${API_KEY()}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0] as PlaceSearchResult;
    }
    return null;
  });
}

export async function getPlaceDetails(
  placeId: string
): Promise<PlaceDetails | null> {
  return rateLimited(async () => {
    const fields = "place_id,name,rating,user_ratings_total,formatted_phone_number,international_phone_number,website,formatted_address,url,opening_hours,reviews";
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=fr&key=${API_KEY()}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (data.result) {
      return data.result as PlaceDetails;
    }
    return null;
  });
}

// ─── Prospect Enrichment ────────────────────────────────────────────────────

export async function enrichProspectWithGoogleMaps(prospect: {
  id: string;
  company?: string | null;
  organization?: string | null;
  city?: string | null;
  workspace_id: string;
}): Promise<EnrichmentResult | null> {
  const businessName = prospect.organization || prospect.company;
  if (!businessName) return null;

  // Find the place
  const place = await findPlace(businessName, prospect.city || undefined);
  if (!place) return null;

  // Get details
  const details = await getPlaceDetails(place.place_id);
  if (!details) return null;

  const result: EnrichmentResult = {
    google_place_id: place.place_id,
    google_rating: details.rating ?? null,
    google_review_count: details.user_ratings_total ?? 0,
    google_maps_url: details.url ?? null,
    phone: details.formatted_phone_number || details.international_phone_number,
    website: details.website,
    address: details.formatted_address,
    reviews: details.reviews,
  };

  // Update prospect in DB
  const supabase = createAdminClient();
  await supabase
    .from("prospects")
    .update({
      google_place_id: result.google_place_id,
      google_rating: result.google_rating,
      google_review_count: result.google_review_count,
      google_maps_url: result.google_maps_url,
      enrichment_data: {
        google_reviews: (details.reviews || []).slice(0, 5),
        google_phone: result.phone,
        google_website: result.website,
        google_address: result.address,
      },
      last_enriched_at: new Date().toISOString(),
    })
    .eq("id", prospect.id);

  // Auto-create signals based on ratings
  if (result.google_rating !== null && result.google_rating < 3.5) {
    await supabase.from("prospect_signals").insert({
      workspace_id: prospect.workspace_id,
      prospect_id: prospect.id,
      signal_type: "pain_point_detected",
      signal_source: "enrichment",
      title: `Avis Google negatifs (${result.google_rating}/5, ${result.google_review_count} avis)`,
      description: "Note Google Maps inferieure a 3.5 — potentiel besoin d'amelioration qualite.",
      signal_score: 20,
    });
  }

  if (result.google_review_count > 50) {
    await supabase.from("prospect_signals").insert({
      workspace_id: prospect.workspace_id,
      prospect_id: prospect.id,
      signal_type: "expansion",
      signal_source: "enrichment",
      title: `Entreprise bien etablie (${result.google_review_count} avis Google)`,
      description: "Nombre eleve d'avis Google — entreprise etablie avec volume significatif.",
      signal_score: 15,
    });
  }

  return result;
}
