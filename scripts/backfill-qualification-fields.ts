import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Region mapping from city/location
const REGION_MAP: Record<string, string> = {
  // Ile-de-France
  paris: "ile_de_france", "ile-de-france": "ile_de_france", idf: "ile_de_france",
  // PACA
  marseille: "paca", nice: "paca", cannes: "paca", toulon: "paca", antibes: "paca",
  "saint-tropez": "paca", "aix-en-provence": "paca", avignon: "paca",
  "provence": "paca", "cote d'azur": "paca",
  // Occitanie
  toulouse: "occitanie", montpellier: "occitanie", perpignan: "occitanie", nimes: "occitanie",
  // Nouvelle-Aquitaine
  bordeaux: "nouvelle_aquitaine", "la rochelle": "nouvelle_aquitaine", biarritz: "nouvelle_aquitaine",
  "arcachon": "nouvelle_aquitaine", bayonne: "nouvelle_aquitaine",
  // Auvergne-Rhone-Alpes
  lyon: "auvergne_rhone_alpes", grenoble: "auvergne_rhone_alpes", annecy: "auvergne_rhone_alpes",
  chamonix: "auvergne_rhone_alpes", "saint-etienne": "auvergne_rhone_alpes",
  // Bretagne
  rennes: "bretagne", brest: "bretagne", "saint-malo": "bretagne", quimper: "bretagne",
  // Pays de la Loire
  nantes: "pays_de_la_loire", angers: "pays_de_la_loire",
  // Normandie
  rouen: "normandie", caen: "normandie", deauville: "normandie",
  // Grand Est
  strasbourg: "grand_est", metz: "grand_est", nancy: "grand_est", colmar: "grand_est",
  // Hauts-de-France
  lille: "hauts_de_france",
  // Corse
  ajaccio: "corse", bastia: "corse", "porto-vecchio": "corse", corse: "corse",
};

// Country mapping
const COUNTRY_MAP: Record<string, string> = {
  france: "france", fr: "france",
  espagne: "espagne", spain: "espagne", es: "espagne", espana: "espagne",
  portugal: "portugal", pt: "portugal",
  italie: "italie", italy: "italie", it: "italie",
  grece: "grece", greece: "grece", gr: "grece",
  croatie: "croatie", croatia: "croatie", hr: "croatie",
  thailande: "thailande", thailand: "thailande", th: "thailande",
  maurice: "maurice", mauritius: "maurice",
  maroc: "maroc", morocco: "maroc", ma: "maroc",
  "royaume-uni": "autre", uk: "autre",
  allemagne: "autre", germany: "autre",
  suisse: "autre", switzerland: "autre",
  "pays-bas": "autre", netherlands: "autre",
  "etats-unis": "autre", usa: "autre",
};

// Source mapping
const SOURCE_MAP: Record<string, string> = {
  manual: "cold_email",
  csv_import: "annuaire",
  crm_import: "annuaire",
  directory_import: "annuaire",
  linkedin: "linkedin",
  google_maps: "google_maps",
  api: "site_web",
};

function deduceRegion(location: string | null, city: string | null): string[] {
  const text = [location, city].filter(Boolean).join(" ").toLowerCase();
  const regions: string[] = [];
  for (const [keyword, region] of Object.entries(REGION_MAP)) {
    if (text.includes(keyword) && !regions.includes(region)) {
      regions.push(region);
    }
  }
  return regions;
}

function deduceCountry(country: string | null, location: string | null): string[] {
  if (!country && !location) return [];
  const text = [country, location].filter(Boolean).join(" ").toLowerCase();
  for (const [keyword, mapped] of Object.entries(COUNTRY_MAP)) {
    if (text.includes(keyword)) return [mapped];
  }
  // Default to france if location mentions French cities
  if (deduceRegion(location, null).length > 0) return ["france"];
  return [];
}

function deducePositionnement(standing: string | null): string[] {
  if (!standing) return [];
  const s = standing.toLowerCase();
  if (s.includes("luxe") || s.includes("luxury")) return ["luxe"];
  if (s.includes("premium") || s.includes("haut")) return ["haut_de_gamme"];
  if (s.includes("standard") || s.includes("eco") || s.includes("budget")) return ["standard"];
  return [];
}

function deduceObjectifParc(vision: string | null): string[] {
  if (!vision) return [];
  const v = vision.toLowerCase();
  if (v.includes("develop") || v.includes("crois") || v.includes("grandir") || v.includes("expansion")) return ["grandir"];
  if (v.includes("maintien") || v.includes("stable") || v.includes("consolid")) return ["maintenir"];
  if (v.includes("redui") || v.includes("diminu")) return ["reduire"];
  return [];
}

function deduceTaille(nbProperties: number | null): string[] {
  if (nbProperties === null || nbProperties === undefined) return [];
  return nbProperties > 50 ? ["grands"] : ["petits_moyens"];
}

function deduceTypeStructure(typeConciergerie: string | null, company: string | null): string[] {
  const text = [typeConciergerie, company].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("franchise") || text.includes("reseau")) {
    if (text.includes("independant")) return ["reseau_independants"];
    return ["reseau_franchise"];
  }
  return ["independante"];
}

async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");

  const { data: prospects, error } = await supabase
    .from("prospects")
    .select("id, company, location, city, country, source, custom_fields, nb_properties");

  if (error || !prospects) {
    console.error("Error fetching prospects:", error?.message);
    return;
  }

  console.log(`Found ${prospects.length} prospects to process`);
  let updatedCount = 0;

  for (const p of prospects) {
    const cf = (p.custom_fields || {}) as Record<string, unknown>;

    // Skip if already has qualification data
    const hasQualification = [
      'objectif_parc', 'type_organisation', 'qui_controle', 'taille_conciergerie',
      'positionnement_logement', 'type_structure', 'region', 'pays_activite', 'source_acquisition',
    ].some(key => Array.isArray(cf[key]) && (cf[key] as string[]).length > 0);

    if (hasQualification) continue;

    const updates: Record<string, string[]> = {};

    // Deduce from existing data
    const region = deduceRegion(p.location, p.city);
    if (region.length > 0) updates.region = region;

    const pays = deduceCountry(p.country as string | null, p.location);
    if (pays.length > 0) updates.pays_activite = pays;

    const positionnement = deducePositionnement(cf.standing as string | null);
    if (positionnement.length > 0) updates.positionnement_logement = positionnement;

    const objectif = deduceObjectifParc(cf.vision_conciergerie as string | null);
    if (objectif.length > 0) updates.objectif_parc = objectif;

    const taille = deduceTaille(p.nb_properties || cf.nb_properties as number | null);
    if (taille.length > 0) updates.taille_conciergerie = taille;

    const typeStruct = deduceTypeStructure(cf.type_conciergerie as string | null, p.company);
    if (typeStruct.length > 0) updates.type_structure = typeStruct;

    // Source acquisition from prospect source
    const source = SOURCE_MAP[p.source as string];
    if (source) updates.source_acquisition = [source];

    if (Object.keys(updates).length === 0) continue;

    if (DRY_RUN) {
      console.log(`[DRY] ${p.company || p.id}: ${JSON.stringify(updates)}`);
      updatedCount++;
      continue;
    }

    const { error: updateErr } = await supabase
      .from("prospects")
      .update({ custom_fields: { ...cf, ...updates } })
      .eq("id", p.id);

    if (updateErr) {
      console.error(`Error updating ${p.id}:`, updateErr.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would update' : 'Updated'} ${updatedCount}/${prospects.length} prospects`);
}

main();
