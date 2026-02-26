import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: all } = await sb.from('prospects')
  .select('id, company, email, location, job_title, phone, website')
  .eq('workspace_id', '83da732a-a933-4ed4-a815-3f975c8ff0c6')
  .order('company');

const byCompany = {};
for (const p of all || []) {
  const key = (p.company || '').toLowerCase().trim();
  if (!byCompany[key]) byCompany[key] = [];
  byCompany[key].push(p);
}

const dupes = Object.entries(byCompany).filter(([, v]) => v.length > 1);
console.log('Total prospects:', all?.length);
console.log('Noms uniques:', Object.keys(byCompany).length);
console.log('Doublons trouves:', dupes.length);

for (const [name, entries] of dupes) {
  console.log(`  DOUBLON: "${name}" (${entries.length}x)`);
  for (const e of entries) {
    console.log(`    - ${e.id.slice(0,8)} | ${e.email} | ${e.location} | job=${e.job_title}`);
  }
}

// Stats
const conciergeries = all?.filter(p => p.job_title === 'Conciergerie') || [];
const others = all?.filter(p => p.job_title !== 'Conciergerie') || [];
console.log('\nConciergeries (scrape):', conciergeries.length);
console.log('Autres prospects:', others.length);
if (others.length) {
  console.log('Exemples autres:');
  for (const o of others.slice(0, 5)) {
    console.log(`  - ${o.company} | ${o.email} | ${o.job_title}`);
  }
}

// Stats enrichissement
const withRealEmail = conciergeries.filter(c => c.email && !c.email.startsWith('contact@'));
const withPhone = conciergeries.filter(c => c.phone);
const withWebsite = conciergeries.filter(c => c.website && !c.website.includes('cocoonr'));
console.log('\n--- Etat enrichissement conciergeries ---');
console.log('Avec email reel:', withRealEmail.length);
console.log('Avec telephone:', withPhone.length);
console.log('Avec site web externe:', withWebsite.length);
console.log('A enrichir:', conciergeries.length - Math.max(withRealEmail.length, withPhone.length, withWebsite.length));
