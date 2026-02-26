import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

interface IncomingProspect {
  email?: string;
  businessName?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerRole?: string;
  ownerLinkedInUrl?: string;
  phone?: string;
  website?: string;
  address?: string;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
}

interface ProspectRow {
  workspace_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string;
  job_title: string;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  location: string | null;
  source: 'google_maps';
  status: 'active';
  custom_fields: Record<string, unknown>;
}

interface ExistingProspect {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  location: string | null;
  custom_fields: Record<string, unknown>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalise un numéro de téléphone en retirant espaces, tirets, points et parenthèses.
 * Ex: "+33 6 12-34.56.78" => "+33612345678"
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-.\(\)]/g, '');
}

/**
 * Transforme les données entrantes (format Google Maps) en un objet prêt pour insert/merge.
 */
function toProspectRow(workspaceId: string, b: IncomingProspect): ProspectRow {
  return {
    workspace_id: workspaceId,
    email: b.email || '',
    first_name: b.ownerFirstName || null,
    last_name: b.ownerLastName || null,
    company: b.businessName || '',
    job_title: b.ownerRole || 'Gerant',
    phone: b.phone || null,
    linkedin_url: b.ownerLinkedInUrl || null,
    website: b.website || null,
    location: b.address || null,
    source: 'google_maps' as const,
    status: 'active' as const,
    custom_fields: {
      google_maps_url: b.googleMapsUrl || '',
      rating: b.rating || null,
      review_count: b.reviewCount || null,
      category: b.category || '',
    },
  };
}

/**
 * Recherche un prospect existant dans le workspace selon 3 critères (par priorité) :
 *   1. Même email (non vide, insensible à la casse)
 *   2. Même company + location (non vides, insensible à la casse)
 *   3. Même téléphone (non vide, après normalisation)
 *
 * Retourne le prospect existant ou null.
 */
async function findExistingProspect(
  supabase: SupabaseClient,
  workspaceId: string,
  prospect: ProspectRow
): Promise<ExistingProspect | null> {
  const selectFields =
    'id, email, first_name, last_name, company, job_title, phone, linkedin_url, website, location, custom_fields';

  // --- Critère 1 : email exact (insensible à la casse) ---
  if (prospect.email && prospect.email.trim() !== '') {
    const { data } = await supabase
      .from('prospects')
      .select(selectFields)
      .eq('workspace_id', workspaceId)
      .ilike('email', prospect.email.trim())
      .limit(1)
      .single();

    if (data) return data as ExistingProspect;
  }

  // --- Critère 2 : company + location (insensible à la casse) ---
  if (
    prospect.company &&
    prospect.company.trim() !== '' &&
    prospect.location &&
    prospect.location.trim() !== ''
  ) {
    const { data } = await supabase
      .from('prospects')
      .select(selectFields)
      .eq('workspace_id', workspaceId)
      .ilike('company', prospect.company.trim())
      .ilike('location', prospect.location.trim())
      .limit(1)
      .single();

    if (data) return data as ExistingProspect;
  }

  // --- Critère 3 : téléphone normalisé ---
  if (prospect.phone && prospect.phone.trim() !== '') {
    const normalizedNew = normalizePhone(prospect.phone);

    // On récupère les prospects du workspace qui ont un téléphone renseigné
    const { data } = await supabase
      .from('prospects')
      .select(selectFields)
      .eq('workspace_id', workspaceId)
      .not('phone', 'is', null)
      .neq('phone', '');

    if (data && data.length > 0) {
      const match = data.find(
        (p: { phone: string | null }) =>
          p.phone && normalizePhone(p.phone) === normalizedNew
      );
      if (match) return match as ExistingProspect;
    }
  }

  return null;
}

/**
 * Fusionne les données d'un nouveau prospect dans un prospect existant.
 * Règle : on ne remplace QUE les champs NULL/vides du prospect existant.
 * Les custom_fields sont fusionnés (merge JSON, les nouvelles clés s'ajoutent,
 * les clés existantes sont conservées).
 */
async function mergeProspect(
  supabase: SupabaseClient,
  existing: ExistingProspect,
  incoming: ProspectRow
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  // Champs texte : on met à jour seulement si l'existant est null/vide
  if (!existing.first_name && incoming.first_name) {
    updateData.first_name = incoming.first_name;
  }
  if (!existing.last_name && incoming.last_name) {
    updateData.last_name = incoming.last_name;
  }
  if (!existing.company && incoming.company) {
    updateData.company = incoming.company;
  }
  if (!existing.job_title && incoming.job_title) {
    updateData.job_title = incoming.job_title;
  }
  if (!existing.phone && incoming.phone) {
    updateData.phone = incoming.phone;
  }
  if (!existing.linkedin_url && incoming.linkedin_url) {
    updateData.linkedin_url = incoming.linkedin_url;
  }
  if (!existing.website && incoming.website) {
    updateData.website = incoming.website;
  }
  if (!existing.location && incoming.location) {
    updateData.location = incoming.location;
  }
  // Si l'email existant est vide et le nouveau ne l'est pas, on le met à jour
  if ((!existing.email || existing.email.trim() === '') && incoming.email && incoming.email.trim() !== '') {
    updateData.email = incoming.email;
  }

  // Fusion des custom_fields : les clés existantes sont prioritaires
  const existingCustom = (existing.custom_fields || {}) as Record<string, unknown>;
  const incomingCustom = (incoming.custom_fields || {}) as Record<string, unknown>;
  const mergedCustom = { ...incomingCustom, ...existingCustom };

  // On vérifie si les custom_fields ont changé
  const customChanged =
    JSON.stringify(mergedCustom) !== JSON.stringify(existingCustom);

  if (customChanged) {
    updateData.custom_fields = mergedCustom;
  }

  // Rien à mettre à jour
  if (Object.keys(updateData).length === 0) return;

  // Mise à jour du timestamp
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('prospects')
    .update(updateData)
    .eq('id', existing.id);

  if (error) {
    console.error(
      `[Dedup] Erreur lors du merge du prospect ${existing.id}:`,
      error
    );
  }
}

/**
 * Génère un label lisible pour identifier un doublon dans la réponse API.
 * Priorité : company + location > company > email
 */
function duplicateLabel(prospect: ProspectRow): string {
  if (prospect.company && prospect.location) {
    return `${prospect.company} (${prospect.location})`;
  }
  if (prospect.company) {
    return prospect.company;
  }
  return prospect.email || 'Prospect inconnu';
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // --- Authentification ---
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    // --- Workspace actif ---
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = profile?.current_workspace_id;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Aucun workspace actif' },
        { status: 400 }
      );
    }

    // =========================================================================
    // Bulk add (avec déduplication)
    // =========================================================================
    if (body.bulk && Array.isArray(body.bulk)) {
      const prospects = body.bulk.map((b: IncomingProspect) =>
        toProspectRow(workspaceId, b)
      );

      let insertedCount = 0;
      let mergedCount = 0;
      const duplicateLabels: string[] = [];
      const toInsert: ProspectRow[] = [];

      // Pour chaque prospect, vérifier s'il existe déjà
      for (const prospect of prospects) {
        const existing = await findExistingProspect(
          supabase,
          workspaceId,
          prospect
        );

        if (existing) {
          // Doublon trouvé : fusionner les données
          await mergeProspect(supabase, existing, prospect);
          mergedCount++;
          duplicateLabels.push(duplicateLabel(prospect));
        } else {
          // Pas de doublon : on accumule pour un insert groupé
          toInsert.push(prospect);
        }
      }

      // Insert groupé des nouveaux prospects
      if (toInsert.length > 0) {
        const { error } = await supabase.from('prospects').insert(toInsert);
        if (error) {
          console.error('[API add-maps-prospects] Bulk insert error:', error);
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }
        insertedCount = toInsert.length;
      }

      return NextResponse.json({
        success: true,
        count: prospects.length,
        inserted: insertedCount,
        merged: mergedCount,
        duplicates: duplicateLabels,
      });
    }

    // =========================================================================
    // Single add (avec déduplication)
    // =========================================================================
    const prospect = toProspectRow(workspaceId, body as IncomingProspect);

    const existing = await findExistingProspect(
      supabase,
      workspaceId,
      prospect
    );

    if (existing) {
      // Doublon trouvé : fusionner
      await mergeProspect(supabase, existing, prospect);
      return NextResponse.json({
        success: true,
        count: 1,
        inserted: 0,
        merged: 1,
        duplicates: [duplicateLabel(prospect)],
      });
    }

    // Pas de doublon : insert normal
    const { error } = await supabase.from('prospects').insert(prospect);

    if (error) {
      console.error('[API add-maps-prospects] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: 1,
      inserted: 1,
      merged: 0,
      duplicates: [],
    });
  } catch (err) {
    console.error('[API add-maps-prospects] Fatal error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
