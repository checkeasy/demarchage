import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const baseUrl = request.url.replace(/\/import-all$/, '');

  // Forward request headers (including cookies for auth) to sub-routes
  const headers = Object.fromEntries(request.headers.entries());

  // Step 1: Import CRM (Pipedrive)
  let crmResult;
  try {
    const crmRes = await fetch(`${baseUrl}/import-crm`, { method: 'POST', headers });
    crmResult = await crmRes.json();
  } catch (e) {
    crmResult = { success: false, error: String(e) };
  }

  // Step 2: Import Directory (Hostinfly)
  let directoryResult;
  try {
    const dirRes = await fetch(`${baseUrl}/import-directory`, { method: 'POST', headers });
    directoryResult = await dirRes.json();
  } catch (e) {
    directoryResult = { success: false, error: String(e) };
  }

  return NextResponse.json({
    success: true,
    crm: crmResult,
    directory: directoryResult,
  });
}
