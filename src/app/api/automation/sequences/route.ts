import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/automation/sequences — List all sequences with stats
export async function GET() {
  const supabase = createAdminClient();

  try {
    const { data: sequences, error } = await supabase
      .from("automation_sequences")
      .select(`
        *,
        automation_steps(id, step_order, action_type, delay_days, delay_hours, message_template, subject_template, use_ai_generation, condition_type, is_active),
        automation_prospects(id, status)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Automation] List error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format for frontend
    const formatted = (sequences || []).map((seq) => ({
      id: seq.id,
      name: seq.name,
      status: seq.status === "draft" ? "paused" : seq.status,
      totalProspects: seq.total_prospects || 0,
      processedProspects: seq.total_processed || 0,
      stats: {
        connected: seq.total_connected || 0,
        replied: seq.total_replied || 0,
        ignored: Math.max(0, (seq.total_processed || 0) - (seq.total_connected || 0) - (seq.total_replied || 0)),
        meetings: seq.total_meetings || 0,
      },
      stepsCount: (seq.automation_steps || []).length,
      activeProspects: (seq.automation_prospects || []).filter((p: { status: string }) => p.status === "active").length,
      createdAt: seq.created_at,
    }));

    return NextResponse.json({ sequences: formatted });
  } catch (err) {
    console.error("[Automation] List error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

// POST /api/automation/sequences — Create a new sequence with steps
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { name, steps, config } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nom de sequence requis" }, { status: 400 });
    }

    // Get workspace
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .limit(1)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Aucun workspace trouve" }, { status: 400 });
    }

    // Get or create LinkedIn account from env cookies
    let linkedinAccountId: string | null = null;
    const liAt = process.env.LINKEDIN_SESSION_COOKIE;
    const jsessionId = process.env.LINKEDIN_JSESSIONID;

    if (liAt && jsessionId) {
      // Check if account already exists
      const { data: existingAccount } = await supabase
        .from("linkedin_accounts")
        .select("id")
        .eq("workspace_id", workspace.id)
        .limit(1)
        .single();

      if (existingAccount) {
        linkedinAccountId = existingAccount.id;
        // Update cookies
        await supabase
          .from("linkedin_accounts")
          .update({
            li_at_cookie: liAt,
            jsessionid_cookie: jsessionId,
            session_valid: true,
          })
          .eq("id", existingAccount.id);
      } else {
        // Create account
        const { data: newAccount, error: accError } = await supabase
          .from("linkedin_accounts")
          .insert({
            workspace_id: workspace.id,
            name: "Compte principal",
            li_at_cookie: liAt,
            jsessionid_cookie: jsessionId,
            daily_connection_limit: config?.maxConnectionsDay || 20,
            daily_message_limit: config?.maxMessagesDay || 50,
          })
          .select("id")
          .single();

        if (accError) {
          console.error("[Automation] LinkedIn account error:", accError);
        } else {
          linkedinAccountId = newAccount?.id || null;
        }
      }
    }

    // Create sequence
    const { data: sequence, error: seqError } = await supabase
      .from("automation_sequences")
      .insert({
        workspace_id: workspace.id,
        name: name.trim(),
        status: "active",
        daily_connection_limit: config?.maxConnectionsDay || 20,
        daily_message_limit: config?.maxMessagesDay || 50,
        sending_window_start: config?.sendingHoursStart || "08:00",
        sending_window_end: config?.sendingHoursEnd || "18:00",
        sending_days: (config?.sendingDays || [true, true, true, true, true, false, false])
          .map((d: boolean, i: number) => d ? i + 1 : null)
          .filter((d: number | null) => d !== null),
        min_delay_seconds: config?.delayMin || 2,
        max_delay_seconds: config?.delayMax || 8,
        linkedin_account_id: linkedinAccountId,
        launched_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (seqError || !sequence) {
      console.error("[Automation] Create sequence error:", seqError);
      return NextResponse.json({ error: seqError?.message || "Erreur creation sequence" }, { status: 500 });
    }

    // Create steps
    if (steps && Array.isArray(steps) && steps.length > 0) {
      const stepInserts = steps.map((step: {
        type: string;
        delayDays: number;
        label: string;
        message: string;
        conditionType?: string;
      }, index: number) => ({
        sequence_id: sequence.id,
        step_order: index + 1,
        action_type: step.type === "condition" ? "check_accepted" : step.type,
        delay_days: step.delayDays || 0,
        message_template: step.message || null,
        condition_type: step.conditionType || null,
        use_ai_generation: false,
        is_active: true,
      }));

      const { error: stepsError } = await supabase
        .from("automation_steps")
        .insert(stepInserts);

      if (stepsError) {
        console.error("[Automation] Create steps error:", stepsError);
        // Don't fail - sequence is created, steps can be added later
      }
    }

    return NextResponse.json({
      success: true,
      sequenceId: sequence.id,
    });
  } catch (err) {
    console.error("[Automation] Create error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
