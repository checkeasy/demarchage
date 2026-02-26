// =============================================================================
// GET /api/linkedin/profile/[publicId]
// Récupère le profil LinkedIn complet d'une personne
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLinkedInClient } from '@/lib/linkedin/client';
import { canPerformAction, recordAction, logLinkedInAction } from '@/lib/linkedin/rate-limiter';
import { LinkedInActionType, LinkedInError, LinkedInErrorType } from '@/lib/linkedin/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;

    // --- Authentification ---
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non autorisé. Veuillez vous connecter.' },
        { status: 401 }
      );
    }

    // --- Récupérer le workspace ---
    const workspaceId = request.nextUrl.searchParams.get('workspace_id');
    const saveToProspects = request.nextUrl.searchParams.get('save') === 'true';

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspace_id est requis en paramètre de requête' },
        { status: 400 }
      );
    }

    // --- Vérifier l'accès au workspace ---
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'Accès au workspace non autorisé' },
        { status: 403 }
      );
    }

    // --- Vérifier le rate limit (comptabilisé comme une vue) ---
    const accountId = `linkedin_${workspaceId}`;
    const canView = await canPerformAction(accountId, LinkedInActionType.VIEW);

    if (!canView) {
      await logLinkedInAction({
        workspaceId,
        accountId,
        actionType: LinkedInActionType.VIEW,
        targetPublicId: publicId,
        status: 'rate_limited',
      });

      return NextResponse.json(
        {
          error: 'Quota de consultations LinkedIn épuisé pour aujourd\'hui.',
          code: 'QUOTA_EXCEEDED',
        },
        { status: 429 }
      );
    }

    // --- Récupérer le profil ---
    const client = getLinkedInClient();

    // Enregistrer une vue de profil d'abord (warm-up)
    try {
      await client.viewProfile(publicId);
    } catch {
      // Non bloquant si la vue échoue
    }

    const profile = await client.getProfile(publicId);

    // --- Enregistrer l'action ---
    await recordAction(accountId, LinkedInActionType.VIEW);

    await logLinkedInAction({
      workspaceId,
      accountId,
      actionType: LinkedInActionType.VIEW,
      targetProfileId: profile.profileId,
      targetPublicId: publicId,
      status: 'success',
    });

    // --- Optionnel: sauvegarder en tant que prospect ---
    let prospectId: string | null = null;

    if (saveToProspects) {
      const prospectData = {
        workspace_id: workspaceId,
        email: profile.emailAddress || `${publicId}@linkedin.placeholder`,
        first_name: profile.firstName || null,
        last_name: profile.lastName || null,
        company: profile.currentCompany || null,
        job_title: profile.currentTitle || profile.headline || null,
        linkedin_url: profile.profileUrl,
        location: profile.location || null,
        source: 'linkedin' as const,
        custom_fields: {
          linkedin_profile_id: profile.profileId,
          linkedin_public_id: profile.publicIdentifier,
          linkedin_headline: profile.headline,
          linkedin_summary: profile.summary,
          linkedin_industry: profile.industryName,
          linkedin_experience: profile.experience,
          linkedin_education: profile.education,
          linkedin_skills: profile.skills,
        },
      };

      const { data: prospect, error: prospectError } = await supabase
        .from('prospects')
        .upsert(prospectData, {
          onConflict: 'workspace_id,email',
          ignoreDuplicates: false,
        })
        .select('id')
        .single();

      if (!prospectError && prospect) {
        prospectId = prospect.id;
      }
    }

    return NextResponse.json({
      profile,
      prospectId,
    });
  } catch (err) {
    console.error('[API LinkedIn Profile] Erreur:', err);

    if (err instanceof LinkedInError) {
      const status =
        err.errorType === LinkedInErrorType.SESSION_EXPIRED
          ? 401
          : err.errorType === LinkedInErrorType.NOT_FOUND
            ? 404
            : err.errorType === LinkedInErrorType.RATE_LIMITED
              ? 429
              : 500;

      return NextResponse.json(
        {
          error: err.message,
          code: err.errorType,
        },
        { status }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne lors de la récupération du profil LinkedIn' },
      { status: 500 }
    );
  }
}
