/**
 * Backfill qualification criteria from Pipedrive deal custom fields
 * into ColdReach prospect custom_fields.
 *
 * Maps Pipedrive deal fields -> ColdReach qualification criteria (multi-select arrays)
 *
 * Usage: npx tsx scripts/backfill-pipedrive-criteria.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";

const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN || "160fb10826b0c5b96730daf64fc6b3be927c27ab";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eykdqbpdxyowpvbflzcn.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = "https://api.pipedrive.com/v1";

const isDryRun = process.argv.includes("--dry-run");

// ─── Pipedrive field keys and their option ID -> ColdReach value mapping ───

const FIELD_MAP: Record<string, {
  criteriaKey: string;
  optionMap: Record<number, string>;
}> = {
  // Vision de la conciergerie -> objectif_parc
  "2e157a4b4a1b5a1f94a1bb6060070c7fe0fd9078": {
    criteriaKey: "objectif_parc",
    optionMap: {
      76: "reduire",      // Réduire leur parc
      77: "maintenir",    // Maintenir leur parc
      78: "grandir",      // Grandir leur parc (industrialisation)
    },
  },
  // Equipe de ménage -> type_organisation
  "ad8118a21021dd557a786721f6ba00b21467f416": {
    criteriaKey: "type_organisation",
    optionMap: {
      69: "interne",
      70: "externe",
    },
  },
  // Utilisateurs -> qui_controle
  "e257f1105289c0365250da528a697eed5416680d": {
    criteriaKey: "qui_controle",
    optionMap: {
      74: "agents_menage",
      75: "voyageurs",
    },
  },
  // Type de biens -> taille_conciergerie
  "917fd4ad7ced867dc371a49f62d65f6e224b756e": {
    criteriaKey: "taille_conciergerie",
    optionMap: {
      65: "petits_moyens",
      66: "grands",
    },
  },
  // Standing des biens -> positionnement_logement
  "11c7f0e188b7613afab1f70aa7e070dc1baa24b4": {
    criteriaKey: "positionnement_logement",
    optionMap: {
      62: "luxe",
      63: "haut_de_gamme",
      64: "standard",
    },
  },
  // Type de conciergerie -> type_structure
  "00d33b3af5cdd4e945bf9cd21c534d1694b6e96c": {
    criteriaKey: "type_structure",
    optionMap: {
      71: "independante",
      72: "reseau_independants",
      73: "reseau_franchise",
    },
  },
  // Région (set) -> region
  "d9af8d6873c01fcb2a720d17763f0a892c2d9b1b": {
    criteriaKey: "region",
    optionMap: {
      60: "bouches_du_rhone",
      61: "normandie",
      80: "auvergne_rhone_alpes",
      81: "bourgogne_franche_comte",
      82: "bretagne",
      83: "centre_val_de_loire",
      84: "corse",
      85: "grand_est",
      86: "hauts_de_france",
      87: "ile_de_france",
      88: "nouvelle_aquitaine",
      89: "occitanie",
      90: "pays_de_la_loire",
      91: "bouches_du_rhone", // PACA -> Bouches-du-Rhône (closest match)
    },
  },
  // Pays -> pays
  "2d18a152b6aec3e0a79e783bab96767e7cb1e4b1": {
    criteriaKey: "pays",
    optionMap: {
      58: "france",
      59: "espagne",
      79: "allemagne",
      96: "etats_unis",
      99: "bresil",
      100: "colombie",
      101: "grece",
      102: "italie",
      103: "portugal",
      104: "suisse",
      105: "mexique",
    },
  },
  // Source du lead -> source_acquisition
  "4a3fb32acfa90f1063cedb3526849d2feeb1587c": {
    criteriaKey: "source_acquisition",
    optionMap: {
      54: "prospection",
      55: "linkedin_claire",
      56: "scale_france",
      57: "chatgpt",
      92: "contact_claire",
      97: "bouche_a_oreille",
      109: "meta_ads",
      110: "instagram_organique",
      111: "google_ads",
    },
  },
};

// Nombre de logements (double field, not a set)
const NB_LOGEMENTS_KEY = "1584150b46c56994f946341aef58b1d5ce0a3df6";

// ─── Helpers ───

function parseSetField(value: string | number | null | undefined): number[] {
  if (!value) return [];
  const str = String(value);
  return str.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
}

async function fetchAllDeals(): Promise<any[]> {
  const all: any[] = [];
  let start = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${BASE_URL}/deals?api_token=${PIPEDRIVE_API_TOKEN}&limit=500&start=${start}&status=all_not_deleted`;
    const res = await fetch(url);
    const json = await res.json();

    if (!json.success || !json.data) break;

    all.push(...json.data);
    hasMore = json.additional_data?.pagination?.more_items_in_collection || false;
    start = json.additional_data?.pagination?.next_start || start + 500;
  }

  return all;
}

// ─── Main ───

async function main() {
  console.log(`🔄 Backfill Pipedrive criteria -> ColdReach prospects ${isDryRun ? "(DRY RUN)" : ""}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Fetch all deals from Pipedrive
  console.log("📥 Fetching deals from Pipedrive...");
  const deals = await fetchAllDeals();
  console.log(`   Found ${deals.length} deals`);

  // 2. Fetch all prospects from ColdReach (CheckEasy workspace)
  const CHECKEASY_WORKSPACE_ID = "83da732a-a933-4ed4-a815-3f975c8ff0c6";
  let allProspects: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error: err } = await supabase
      .from("prospects")
      .select("id, company, email, custom_fields, nb_properties")
      .eq("workspace_id", CHECKEASY_WORKSPACE_ID)
      .range(from, from + pageSize - 1);
    if (err) {
      console.error("❌ Error fetching prospects:", err.message);
      return;
    }
    if (!data || data.length === 0) break;
    allProspects.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  const prospects = allProspects;
  console.log(`📋 Found ${prospects.length} prospects in CheckEasy`);

  // 3. Build lookup by company name (normalized)
  const byCompanyName = new Map<string, typeof prospects[0]>();

  for (const p of prospects) {
    if (p.company) {
      byCompanyName.set(p.company.toLowerCase().trim(), p);
    }
  }

  // 4. Process each deal
  let matched = 0;
  let updated = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const deal of deals) {
    // Try to find matching prospect by org name
    let prospect: typeof prospects[0] | undefined;

    if (deal.org_name) {
      prospect = byCompanyName.get(deal.org_name.toLowerCase().trim());
    }

    if (!prospect) {
      noMatch++;
      continue;
    }

    matched++;

    // Extract criteria from deal custom fields
    const criteriaUpdates: Record<string, string[]> = {};
    let nbProperties: number | undefined;
    let hasAnyData = false;

    for (const [fieldKey, config] of Object.entries(FIELD_MAP)) {
      const rawValue = deal[fieldKey];
      if (!rawValue) continue;

      const optionIds = parseSetField(rawValue);
      const mappedValues = optionIds
        .map((id) => config.optionMap[id])
        .filter(Boolean);

      if (mappedValues.length > 0) {
        criteriaUpdates[config.criteriaKey] = mappedValues;
        hasAnyData = true;
      }
    }

    // Nombre de logements
    const nbRaw = deal[NB_LOGEMENTS_KEY];
    if (nbRaw !== null && nbRaw !== undefined && nbRaw !== "") {
      nbProperties = Number(nbRaw);
      if (!isNaN(nbProperties) && nbProperties > 0) {
        hasAnyData = true;
      } else {
        nbProperties = undefined;
      }
    }

    if (!hasAnyData) {
      skipped++;
      continue;
    }

    // Merge with existing custom_fields
    const existingFields = (prospect.custom_fields as Record<string, unknown>) || {};
    const updatedFields = { ...existingFields };

    for (const [key, values] of Object.entries(criteriaUpdates)) {
      // Don't overwrite if prospect already has values
      const existing = existingFields[key] as string[] | undefined;
      if (existing && existing.length > 0) continue;
      updatedFields[key] = values;
    }

    // Check if anything actually changed for custom_fields
    const customFieldsChanged = JSON.stringify(updatedFields) !== JSON.stringify(existingFields);
    const nbPropertiesChanged = nbProperties !== undefined && !prospect.nb_properties;

    if (!customFieldsChanged && !nbPropertiesChanged) {
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(`  📝 [DRY] ${prospect.company}: ${JSON.stringify(criteriaUpdates)}${nbProperties ? `, nb=${nbProperties}` : ""}`);
      updated++;
      continue;
    }

    // Update in Supabase
    const updatePayload: Record<string, unknown> = {};
    if (customFieldsChanged) updatePayload.custom_fields = updatedFields;
    if (nbPropertiesChanged) updatePayload.nb_properties = nbProperties;

    const { error: updateError } = await supabase
      .from("prospects")
      .update(updatePayload)
      .eq("id", prospect.id);

    if (updateError) {
      console.error(`  ❌ Error updating ${prospect.company}: ${updateError.message}`);
    } else {
      updated++;
    }
  }

  console.log("\n📊 Results:");
  console.log(`   Deals total:     ${deals.length}`);
  console.log(`   Matched:         ${matched}`);
  console.log(`   Updated:         ${updated}`);
  console.log(`   Skipped (empty): ${skipped}`);
  console.log(`   No match:        ${noMatch}`);
}

main().catch(console.error);
