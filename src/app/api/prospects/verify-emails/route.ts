import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export const maxDuration = 120;

const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'guerrillamailblock.com',
  'grr.la', 'dispostable.com', 'maildrop.cc', 'temp-mail.org',
  'fakeinbox.com', 'mailnesia.com', 'tempail.com', 'emailondeck.com',
  'mohmal.com', '10minutemail.com', 'minutemailbox.com', 'tempr.email',
]);

const ROLE_ADDRESSES = new Set([
  'info', 'contact', 'admin', 'support', 'hello', 'office',
  'sales', 'marketing', 'webmaster', 'postmaster', 'abuse',
  'noreply', 'no-reply', 'newsletter', 'billing', 'team',
  'help', 'service', 'enquiries', 'reception', 'general',
]);

const PLACEHOLDER_PATTERNS = [
  '@linkedin-prospect.local',
  '@crm-import.local',
  '@directory-import.local',
];

interface VerificationResult {
  email: string;
  score: number;
  checks: {
    format_valid: boolean;
    mx_exists: boolean;
    is_placeholder: boolean;
    is_disposable: boolean;
    is_role_based: boolean;
    domain: string;
  };
}

async function verifyEmail(email: string): Promise<VerificationResult> {
  const result: VerificationResult = {
    email,
    score: 0,
    checks: {
      format_valid: false,
      mx_exists: false,
      is_placeholder: false,
      is_disposable: false,
      is_role_based: false,
      domain: '',
    },
  };

  // Check placeholder patterns first
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (email.toLowerCase().endsWith(pattern)) {
      result.checks.is_placeholder = true;
      return result; // Score stays 0
    }
  }

  // Format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(email)) {
    result.checks.format_valid = true;
    result.score += 30;
  } else {
    return result;
  }

  const [localPart, domain] = email.toLowerCase().split('@');
  result.checks.domain = domain;

  // Check disposable
  if (DISPOSABLE_DOMAINS.has(domain)) {
    result.checks.is_disposable = true;
  } else {
    result.score += 10;
  }

  // Check role-based
  if (ROLE_ADDRESSES.has(localPart)) {
    result.checks.is_role_based = true;
  } else {
    result.score += 10;
  }

  // MX record check
  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      result.checks.mx_exists = true;
      result.score += 30;
    }
  } catch {
    // No MX records = domain doesn't accept email
  }

  // Business domain bonus (not free email)
  const freeProviders = new Set([
    'gmail.com', 'yahoo.com', 'yahoo.fr', 'hotmail.com', 'hotmail.fr',
    'outlook.com', 'outlook.fr', 'live.com', 'live.fr', 'aol.com',
    'wanadoo.fr', 'orange.fr', 'free.fr', 'sfr.fr', 'laposte.net',
    'icloud.com', 'protonmail.com', 'neuf.fr', 'numericable.fr',
  ]);

  if (!freeProviders.has(domain)) {
    result.score += 20; // Business domain = more likely to be real
  } else {
    result.score += 10; // Free provider but still valid
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { prospectIds } = await request.json();

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: 'prospectIds requis' }, { status: 400 });
    }

    if (prospectIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 prospects par lot' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: prospects, error: fetchError } = await admin
      .from('prospects')
      .select('id, email')
      .in('id', prospectIds);

    if (fetchError || !prospects) {
      return NextResponse.json({ error: 'Erreur lecture prospects' }, { status: 500 });
    }

    let verified = 0;
    let errors = 0;
    const results: VerificationResult[] = [];

    // Process in batches of 10 for DNS lookups
    for (let i = 0; i < prospects.length; i += 10) {
      const batch = prospects.slice(i, i + 10);
      const verifications = await Promise.allSettled(
        batch.map(async (prospect) => {
          const result = await verifyEmail(prospect.email);
          results.push(result);

          const { error: updateError } = await admin
            .from('prospects')
            .update({
              email_validity_score: result.score,
              email_verified_at: new Date().toISOString(),
            })
            .eq('id', prospect.id);

          if (updateError) throw updateError;
          return result;
        })
      );

      for (const r of verifications) {
        if (r.status === 'fulfilled') verified++;
        else errors++;
      }
    }

    // Summary stats
    const scores = results.map(r => r.score);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const highQuality = scores.filter(s => s >= 70).length;
    const medium = scores.filter(s => s >= 40 && s < 70).length;
    const low = scores.filter(s => s > 0 && s < 40).length;
    const invalid = scores.filter(s => s === 0).length;

    return NextResponse.json({
      success: true,
      verified,
      errors,
      summary: {
        avg_score: avgScore,
        high_quality: highQuality,
        medium,
        low,
        invalid,
      },
      details: results,
    });
  } catch (err) {
    console.error('[API Verify Emails]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 }
    );
  }
}
