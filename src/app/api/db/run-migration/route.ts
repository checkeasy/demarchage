import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/db/run-migration — Run pending SQL migrations (auth required)
export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const results: { migration: string; status: string }[] = [];

  // Migration: Add custom_fields to activities
  const { error: e1 } = await supabase.rpc('exec_sql' as never, {
    query: "ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';"
  } as never);

  // If rpc doesn't work, try via direct REST
  if (e1) {
    // Try checking if column already exists
    const { error: checkError } = await supabase
      .from('activities')
      .select('custom_fields')
      .limit(1);

    if (checkError) {
      results.push({
        migration: 'activities_custom_fields',
        status: `needs_manual_apply: Run in Supabase SQL Editor: ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';`,
      });
    } else {
      results.push({ migration: 'activities_custom_fields', status: 'already_applied' });
    }
  } else {
    results.push({ migration: 'activities_custom_fields', status: 'applied' });
  }

  return NextResponse.json({ success: true, results });
}
