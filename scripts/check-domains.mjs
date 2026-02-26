import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const WS = '83da732a-a933-4ed4-a815-3f975c8ff0c6';

const { data: concs } = await sb.from('prospects')
  .select('id, company, email, phone, website, location, custom_fields')
  .eq('workspace_id', WS)
  .eq('job_title', 'Conciergerie')
  .order('company')
  .range(0, 999);

// Classify current state
const stats = { total: 0, hasContactEmail: 0, hasDomain: 0, hasPhone: 0, hasExternalWeb: 0 };
const domainsToTry = [];

for (const c of concs || []) {
  stats.total++;
  if (c.phone) stats.hasPhone++;
  if (c.website && !c.website.includes('cocoonr')) stats.hasExternalWeb++;

  // Check if email contains a domain we can try
  if (c.email && c.email.includes('@')) {
    const domain = c.email.split('@')[1];
    if (domain && !domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail') &&
        !domain.includes('outlook') && !domain.includes('crm-import') && !domain.includes('directory-import') &&
        !domain.includes('wanadoo') && !domain.includes('orange') && !domain.includes('free.fr') &&
        !domain.includes('sfr.fr') && !domain.includes('laposte') && !domain.includes('icloud')) {
      stats.hasDomain++;
      if (!c.phone || !c.website || c.website.includes('cocoonr')) {
        domainsToTry.push({
          id: c.id,
          company: c.company,
          domain: domain,
          email: c.email,
          needsPhone: !c.phone,
          needsWebsite: !c.website || c.website.includes('cocoonr'),
        });
      }
    }
    if (c.email.startsWith('contact@')) stats.hasContactEmail++;
  }
}

console.log('=== ETAT ACTUEL ===');
console.log(`Total conciergeries: ${stats.total}`);
console.log(`Avec email contact@: ${stats.hasContactEmail}`);
console.log(`Avec domaine pro: ${stats.hasDomain}`);
console.log(`Avec telephone: ${stats.hasPhone}`);
console.log(`Avec site web externe: ${stats.hasExternalWeb}`);
console.log(`\nDomaines a visiter pour enrichissement: ${domainsToTry.length}`);
console.log('\n--- 20 premiers domaines ---');
for (const d of domainsToTry.slice(0, 20)) {
  console.log(`  ${d.company} → https://${d.domain} (need: ${d.needsPhone ? 'P' : ''}${d.needsWebsite ? 'W' : ''})`);
}
