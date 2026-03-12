import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/automation/sequences/[id]/enroll — Add prospects to sequence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sequenceId } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single();
  if (!profile?.current_workspace_id) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const workspaceId = profile.current_workspace_id;

  try {
    const body = await request.json();
    const { prospectIds } = body;

    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: "Aucun prospect fourni" }, { status: 400 });
    }

    // Get sequence and its first step (with workspace isolation)
    const { data: sequence, error: seqError } = await supabase
      .from("automation_sequences")
      .select("id, status")
      .eq("id", sequenceId)
      .eq("workspace_id", workspaceId)
      .single();

    if (seqError || !sequence) {
      return NextResponse.json({ error: "Sequence non trouvee" }, { status: 404 });
    }

    const { data: firstStep } = await supabase
      .from("automation_steps")
      .select("id, delay_days, delay_hours, delay_minutes")
      .eq("sequence_id", sequenceId)
      .eq("is_active", true)
      .order("step_order", { ascending: true })
      .limit(1)
      .single();

    if (!firstStep) {
      return NextResponse.json({ error: "Aucune etape dans la sequence" }, { status: 400 });
    }

    // Get prospects with their LinkedIn data (with workspace isolation)
    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, linkedin_url, first_name, last_name")
      .eq("workspace_id", workspaceId)
      .in("id", prospectIds);

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ error: "Aucun prospect valide" }, { status: 400 });
    }

    // Check for already enrolled prospects
    const { data: alreadyEnrolled } = await supabase
      .from("automation_prospects")
      .select("prospect_id")
      .eq("sequence_id", sequenceId)
      .in("prospect_id", prospectIds);

    const enrolledIds = new Set((alreadyEnrolled || []).map((e) => e.prospect_id));

    // Calculate first action time
    const nextActionAt = new Date();
    nextActionAt.setDate(nextActionAt.getDate() + (firstStep.delay_days || 0));
    nextActionAt.setHours(nextActionAt.getHours() + (firstStep.delay_hours || 0));
    nextActionAt.setMinutes(nextActionAt.getMinutes() + (firstStep.delay_minutes || 0));

    // Enroll prospects
    const enrollments = prospects
      .filter((p) => !enrolledIds.has(p.id))
      .map((p) => {
        // Extract public ID from LinkedIn URL
        const match = p.linkedin_url?.match(/\/in\/([^/?]+)/);
        const publicId = match ? match[1] : null;

        return {
          sequence_id: sequenceId,
          prospect_id: p.id,
          current_step_id: firstStep.id,
          status: "active",
          next_action_at: nextActionAt.toISOString(),
          linkedin_public_id: publicId,
          linkedin_profile_urn: publicId
            ? `urn:li:fsd_profile:${publicId}`
            : null,
        };
      });

    if (enrollments.length === 0) {
      return NextResponse.json({
        success: true,
        enrolled: 0,
        message: "Tous les prospects sont deja inscrits",
      });
    }

    const { error: enrollError } = await supabase
      .from("automation_prospects")
      .insert(enrollments);

    if (enrollError) {
      console.error("[Automation] Enroll error:", enrollError);
      return NextResponse.json({ error: enrollError.message }, { status: 500 });
    }

    // Update sequence total prospects count
    const { count: totalCount } = await supabase
      .from("automation_prospects")
      .select("id", { count: "exact", head: true })
      .eq("sequence_id", sequenceId);

    await supabase
      .from("automation_sequences")
      .update({ total_prospects: totalCount || 0 })
      .eq("id", sequenceId);

    return NextResponse.json({
      success: true,
      enrolled: enrollments.length,
      skipped: prospects.length - enrollments.length,
    });
  } catch (err) {
    console.error("[Automation] Enroll error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
