import { NextRequest, NextResponse } from 'next/server';
import { findCompanyWebsite } from '@/lib/scraper/company-finder';
import { findEmailsForDomain } from '@/lib/scraper/email-finder';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { companyName, websiteUrl, contactName } = await request.json();

    if (!companyName && !websiteUrl) {
      return NextResponse.json({
        success: false,
        error: 'companyName ou websiteUrl requis',
        data: { website: null, emails: null },
      });
    }

    // Step 1: Find website if not provided
    const website = websiteUrl
      ? { companyName: companyName || '', websiteUrl, source: 'provided' as const, confidence: 1 }
      : await findCompanyWebsite(companyName);

    if (!website.websiteUrl) {
      return NextResponse.json({
        success: false,
        error: `Aucun site web trouve pour "${companyName}"`,
        data: { website, emails: null },
      });
    }

    // Step 2: Find emails
    const emails = await findEmailsForDomain(
      website.websiteUrl,
      companyName,
      contactName
    );

    return NextResponse.json({
      success: true,
      data: {
        website,
        emails,
        enrichedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[API enrich-company] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
