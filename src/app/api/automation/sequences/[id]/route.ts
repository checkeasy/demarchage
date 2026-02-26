import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/automation/sequences/[id] — Update sequence status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { status } = body;

    if (!["active", "paused", "completed"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { status };

    if (status === "completed") {
      updates.completed_at = new Date().toISOString();
      // Also pause all active prospects
      await supabase
        .from("automation_prospects")
        .update({ status: "paused" })
        .eq("sequence_id", id)
        .eq("status", "active");
    }

    if (status === "active") {
      // Resume paused prospects
      await supabase
        .from("automation_prospects")
        .update({ status: "active" })
        .eq("sequence_id", id)
        .eq("status", "paused");
    }

    if (status === "paused") {
      // Pause active prospects
      await supabase
        .from("automation_prospects")
        .update({ status: "paused" })
        .eq("sequence_id", id)
        .eq("status", "active");
    }

    const { error } = await supabase
      .from("automation_sequences")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("[Automation] Update status error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Automation] Update error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
