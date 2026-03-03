import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/automation/sequences/[id] — Get single sequence with details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  try {
    // Fetch sequence with steps
    const { data: sequence, error } = await supabase
      .from("automation_sequences")
      .select(`
        *,
        automation_steps(id, step_order, action_type, delay_days, delay_hours, message_template, subject_template, use_ai_generation, condition_type, is_active)
      `)
      .eq("id", id)
      .single();

    if (error || !sequence) {
      return NextResponse.json({ error: "Sequence non trouvee" }, { status: 404 });
    }

    // Fetch prospects enrolled in this sequence
    const { data: prospects } = await supabase
      .from("automation_prospects")
      .select(`
        id,
        prospect_id,
        status,
        current_step_id,
        next_action_at,
        created_at,
        completed_at,
        prospect:prospects(id, first_name, last_name, email, company, organization, linkedin_url, lead_score)
      `)
      .eq("sequence_id", id)
      .order("created_at", { ascending: false })
      .limit(500);

    // Fetch activity log for this sequence
    const { data: activity } = await supabase
      .from("automation_actions_log")
      .select(`
        id,
        action_type,
        status,
        message_sent,
        error_message,
        created_at
      `)
      .eq("sequence_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    // Sort steps by order
    const steps = (sequence.automation_steps || []).sort(
      (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
    );

    // Convert sending_days back to boolean array
    const sendingDaysArray = [false, false, false, false, false, false, false];
    if (Array.isArray(sequence.sending_days)) {
      for (const day of sequence.sending_days) {
        if (typeof day === "number" && day >= 1 && day <= 7) {
          sendingDaysArray[day - 1] = true;
        }
      }
    }

    return NextResponse.json({
      sequence: {
        id: sequence.id,
        name: sequence.name,
        status: sequence.status === "draft" ? "paused" : sequence.status,
        totalProspects: sequence.total_prospects || 0,
        processedProspects: sequence.total_processed || 0,
        stats: {
          connected: sequence.total_connected || 0,
          replied: sequence.total_replied || 0,
          ignored: Math.max(0, (sequence.total_processed || 0) - (sequence.total_connected || 0) - (sequence.total_replied || 0)),
          meetings: sequence.total_meetings || 0,
        },
        config: {
          maxConnectionsDay: sequence.daily_connection_limit || 20,
          maxMessagesDay: sequence.daily_message_limit || 50,
          sendingHoursStart: sequence.sending_window_start || "08:00",
          sendingHoursEnd: sequence.sending_window_end || "18:00",
          sendingDays: sendingDaysArray,
          delayMin: sequence.min_delay_seconds || 2,
          delayMax: sequence.max_delay_seconds || 8,
        },
        steps: steps.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          stepOrder: s.step_order as number,
          actionType: s.action_type as string,
          delayDays: (s.delay_days as number) || 0,
          delayHours: (s.delay_hours as number) || 0,
          messageTemplate: s.message_template as string | null,
          subjectTemplate: s.subject_template as string | null,
          useAiGeneration: s.use_ai_generation as boolean,
          conditionType: s.condition_type as string | null,
          isActive: s.is_active as boolean,
        })),
        createdAt: sequence.created_at,
        launchedAt: sequence.launched_at,
        completedAt: sequence.completed_at,
      },
      prospects: prospects || [],
      activity: activity || [],
    });
  } catch (err) {
    console.error("[Automation] GET sequence error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

// PUT /api/automation/sequences/[id] — Update sequence config and steps
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { name, config, steps } = body;

    // Update sequence config
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name.trim();
    if (config) {
      if (config.maxConnectionsDay !== undefined) updates.daily_connection_limit = config.maxConnectionsDay;
      if (config.maxMessagesDay !== undefined) updates.daily_message_limit = config.maxMessagesDay;
      if (config.sendingHoursStart) updates.sending_window_start = config.sendingHoursStart;
      if (config.sendingHoursEnd) updates.sending_window_end = config.sendingHoursEnd;
      if (config.delayMin !== undefined) updates.min_delay_seconds = config.delayMin;
      if (config.delayMax !== undefined) updates.max_delay_seconds = config.delayMax;
      if (config.sendingDays) {
        updates.sending_days = config.sendingDays
          .map((d: boolean, i: number) => d ? i + 1 : null)
          .filter((d: number | null) => d !== null);
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("automation_sequences")
        .update(updates)
        .eq("id", id);

      if (error) {
        console.error("[Automation] Update config error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Update steps if provided
    if (steps && Array.isArray(steps)) {
      // Delete existing steps
      await supabase
        .from("automation_steps")
        .delete()
        .eq("sequence_id", id);

      // Insert new steps
      const stepInserts = steps.map((step: {
        actionType: string;
        delayDays: number;
        messageTemplate: string | null;
        subjectTemplate?: string | null;
        conditionType?: string | null;
      }, index: number) => ({
        sequence_id: id,
        step_order: index + 1,
        action_type: step.actionType,
        delay_days: step.delayDays || 0,
        message_template: step.messageTemplate || null,
        subject_template: step.subjectTemplate || null,
        condition_type: step.conditionType || null,
        use_ai_generation: false,
        is_active: true,
      }));

      const { error: stepsError } = await supabase
        .from("automation_steps")
        .insert(stepInserts);

      if (stepsError) {
        console.error("[Automation] Update steps error:", stepsError);
        return NextResponse.json({ error: stepsError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Automation] PUT error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

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
