import { NextRequest, NextResponse } from 'next/server';
import { findCompanyWebsite } from '@/lib/scraper/company-finder';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { companyName } = await request.json();

    if (!companyName || typeof companyName !== 'string') {
      return NextResponse.json(
        { error: 'companyName est requis' },
        { status: 400 }
      );
    }

    const result = await findCompanyWebsite(companyName);

    if (!result.websiteUrl) {
      return NextResponse.json(
        { success: false, error: `Aucun site web trouve pour "${companyName}"`, data: result },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[API find-website] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
