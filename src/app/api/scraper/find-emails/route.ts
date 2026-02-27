import { NextRequest, NextResponse } from 'next/server';
import { findEmailsForDomain } from '@/lib/scraper/email-finder';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { websiteUrl, companyName, contactName } = await request.json();

    if (!websiteUrl || typeof websiteUrl !== 'string') {
      return NextResponse.json(
        { error: 'websiteUrl est requis' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(websiteUrl);
    } catch {
      return NextResponse.json(
        { error: 'URL invalide' },
        { status: 400 }
      );
    }

    const result = await findEmailsForDomain(websiteUrl, companyName, contactName);

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[API find-emails] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
