import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const WS = '83da732a-a933-4ed4-a815-3f975c8ff0c6';

const { data: all } = await sb.from('prospects')
  .select('id, company, email, phone, website, job_title, location, custom_fields, created_at')
  .eq('workspace_id', WS)
  .order('created_at', { ascending: true });

const byCompany = {};
for (const p of all || []) {
  const key = (p.company || '').toLowerCase().trim();
  if (!key) continue;
  if (!byCompany[key]) byCompany[key] = [];
  byCompany[key].push(p);
}

let merged = 0, deleted = 0;
const toDelete = [];

for (const [name, entries] of Object.entries(byCompany)) {
  if (entries.length <= 1) continue;

  // Keep the best entry (prefer one with real email/phone/website)
  entries.sort((a, b) => {
    const scoreA = (a.email && !a.email.includes('@crm-import') && !a.email.includes('@directory-import') && !a.email.startsWith('contact@') ? 3 : 0)
      + (a.phone ? 2 : 0) + (a.website && !a.website.includes('cocoonr') ? 1 : 0);
    const scoreB = (b.email && !b.email.includes('@crm-import') && !b.email.includes('@directory-import') && !b.email.startsWith('contact@') ? 3 : 0)
      + (b.phone ? 2 : 0) + (b.website && !b.website.includes('cocoonr') ? 1 : 0);
    return scoreB - scoreA; // Higher score first = keep
  });

  const keep = entries[0];
  const duplicates = entries.slice(1);

  // Merge useful info from duplicates into the keeper
  const updates = {};
  for (const dup of duplicates) {
    if (!keep.email && dup.email && !dup.email.includes('@crm-import') && !dup.email.includes('@directory-import')) {
      updates.email = dup.email;
    }
    if (!keep.phone && dup.phone) updates.phone = dup.phone;
    if (!keep.website && dup.website && !dup.website.includes('cocoonr')) updates.website = dup.website;
    if (!keep.location && dup.location) updates.location = dup.location;

    // Merge custom_fields
    if (dup.custom_fields && typeof dup.custom_fields === 'object') {
      updates.custom_fields = { ...(keep.custom_fields || {}), ...dup.custom_fields, ...(updates.custom_fields || {}) };
    }

    toDelete.push(dup.id);
  }

  if (Object.keys(updates).length > 0) {
    await sb.from('prospects').update(updates).eq('id', keep.id);
    merged++;
  }
}

// Delete duplicates
if (toDelete.length > 0) {
  for (const id of toDelete) {
    await sb.from('prospects').delete().eq('id', id);
    deleted++;
  }
}

console.log(`Deduplication terminee:`);
console.log(`  Doublons supprimes: ${deleted}`);
console.log(`  Entries enrichies par merge: ${merged}`);

// Recount
const { count } = await sb.from('prospects')
  .select('id', { count: 'exact', head: true })
  .eq('workspace_id', WS);
console.log(`  Total prospects restants: ${count}`);
