import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// DELETE /api/automation/sequences/[id]/prospects — Remove prospects from sequence
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sequenceId } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { prospectIds } = body;

    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: "Aucun prospect fourni" }, { status: 400 });
    }

    // Verify sequence exists
    const { data: sequence, error: seqError } = await supabase
      .from("automation_sequences")
      .select("id")
      .eq("id", sequenceId)
      .single();

    if (seqError || !sequence) {
      return NextResponse.json({ error: "Sequence non trouvee" }, { status: 404 });
    }

    // Delete prospects from the sequence
    const { error: deleteError, count } = await supabase
      .from("automation_prospects")
      .delete({ count: "exact" })
      .eq("sequence_id", sequenceId)
      .in("prospect_id", prospectIds);

    if (deleteError) {
      console.error("[Automation] Remove prospects error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
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
      removed: count || 0,
    });
  } catch (err) {
    console.error("[Automation] Remove prospects error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
