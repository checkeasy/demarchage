import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const WS = '83da732a-a933-4ed4-a815-3f975c8ff0c6';

const { data: concs } = await sb.from('prospects')
  .select('id, company, email, phone, website, location, custom_fields')
  .eq('workspace_id', WS)
  .eq('job_title', 'Conciergerie')
  .order('company')
  .range(0, 999);

const { count: total } = await sb.from('prospects')
  .select('id', { count: 'exact', head: true })
  .eq('workspace_id', WS);

console.log(`\n${'='.repeat(55)}`);
console.log(`   RAPPORT FINAL - ENRICHISSEMENT CONCIERGERIES`);
console.log(`${'='.repeat(55)}\n`);

console.log(`Total prospects workspace: ${total}`);
console.log(`Conciergeries (Cocoonr): ${concs?.length}\n`);

// Classify
let withRealWebsite = 0, withPhone = 0, withVerifiedEmail = 0;
let withFakeEmail = 0, withSocials = 0, fullyEnriched = 0;
const enriched = [];

for (const c of concs || []) {
  const hasPhone = !!c.phone;
  const hasRealWeb = c.website && !c.website.includes('cocoonr');
  const emailDomain = c.email?.split('@')[1] || '';
  const hasFakeEmail = emailDomain.endsWith('.fr') && !hasRealWeb; // domain doesn't resolve
  const hasSocials = c.custom_fields?.socials && Object.keys(c.custom_fields.socials).length > 0;

  if (hasPhone) withPhone++;
  if (hasRealWeb) withRealWebsite++;
  if (hasSocials) withSocials++;
  if (hasFakeEmail) withFakeEmail++;

  if (hasPhone || hasRealWeb) {
    enriched.push(c);
    if (hasPhone && hasRealWeb) fullyEnriched++;
  }
}

console.log(`--- Resultats d'enrichissement ---`);
console.log(`  Avec site web reel:    ${withRealWebsite} (${(withRealWebsite*100/concs.length).toFixed(1)}%)`);
console.log(`  Avec telephone:        ${withPhone} (${(withPhone*100/concs.length).toFixed(1)}%)`);
console.log(`  Avec reseaux sociaux:  ${withSocials}`);
console.log(`  Complet (web+tel):     ${fullyEnriched}`);
console.log(`  Email probablement faux: ${withFakeEmail}`);

console.log(`\n--- Prospects EXPLOITABLES pour demarchage ---`);
const exploitables = enriched.filter(c => c.phone || (c.website && !c.website.includes('cocoonr')));
console.log(`  Total: ${exploitables.length}\n`);

for (const c of exploitables.slice(0, 30)) {
  const web = c.website && !c.website.includes('cocoonr') ? c.website : '-';
  console.log(`  ${c.company}`);
  console.log(`    Email: ${c.email}`);
  console.log(`    Tel:   ${c.phone || '-'}`);
  console.log(`    Web:   ${web}`);
  console.log(`    Loc:   ${c.location || '-'}`);
  if (c.custom_fields?.socials) {
    const soc = Object.entries(c.custom_fields.socials).map(([k,v]) => `${k}: ${v}`).join(' | ');
    console.log(`    Social: ${soc}`);
  }
  console.log('');
}
