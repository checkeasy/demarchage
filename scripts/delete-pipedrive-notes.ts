import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  let deleted = 0;
  while (true) {
    const { data, error } = await supabase
      .from('notes')
      .select('id')
      .not('custom_fields->pipedrive_id', 'is', null)
      .limit(500);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    const ids = data.map((n: { id: string }) => n.id);
    const { error: delErr } = await supabase.from('notes').delete().in('id', ids);
    if (delErr) { console.error(delErr); break; }
    deleted += ids.length;
    console.log('Deleted batch:', ids.length, 'Total:', deleted);
  }
  console.log('Done. Total deleted:', deleted);
}

main();
