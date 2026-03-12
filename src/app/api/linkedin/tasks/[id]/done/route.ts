import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNextSendTime } from "@/lib/email/scheduler";

/**
 * POST /api/linkedin/tasks/[id]/done
 * Marks a LinkedIn task as completed and advances the campaign sequence step.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Get the task details
  const { data: task, error: taskError } = await admin
    .from("linkedin_tasks")
    .select("id, campaign_prospect_id, step_id, status")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status === "completed") {
    return NextResponse.json({ message: "Task already completed" });
  }

  // 2. Mark task as completed
  await admin
    .from("linkedin_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .eq("id", taskId);

  // 3. Advance the campaign prospect to the next step
  if (task.campaign_prospect_id) {
    const { data: cp } = await admin
      .from("campaign_prospects")
      .select("id, campaign_id, current_step_id")
      .eq("id", task.campaign_prospect_id)
      .single();

    if (cp) {
      // Get current step order
      const { data: currentStep } = await admin
        .from("sequence_steps")
        .select("step_order")
        .eq("id", cp.current_step_id)
        .single();

      const currentStepOrder = currentStep?.step_order || 0;

      // Find the next step
      const { data: nextStep } = await admin
        .from("sequence_steps")
        .select("*")
        .eq("campaign_id", cp.campaign_id)
        .gt("step_order", currentStepOrder)
        .eq("is_active", true)
        .order("step_order", { ascending: true })
        .limit(1)
        .single();

      if (nextStep) {
        // Get campaign settings for send window
        const { data: campaign } = await admin
          .from("campaigns")
          .select("timezone, sending_window_start, sending_window_end, sending_days")
          .eq("id", cp.campaign_id)
          .single();

        let nextSendAt: Date;

        if (nextStep.step_type === "delay") {
          // Calculate send time after delay, then find the action step after
          nextSendAt = getNextSendTime(
            campaign?.timezone || "Europe/Paris",
            campaign?.sending_window_start || "08:00",
            campaign?.sending_window_end || "18:00",
            campaign?.sending_days || [1, 2, 3, 4, 5],
            nextStep.delay_days || 0,
            nextStep.delay_hours || 0
          );

          // Find the action step after delay
          const { data: actionStep } = await admin
            .from("sequence_steps")
            .select("*")
            .eq("campaign_id", cp.campaign_id)
            .gt("step_order", nextStep.step_order)
            .eq("is_active", true)
            .order("step_order", { ascending: true })
            .limit(1)
            .single();

          if (actionStep) {
            await admin
              .from("campaign_prospects")
              .update({
                status: "active",
                status_reason: null,
                current_step_id: actionStep.id,
                next_send_at: nextSendAt.toISOString(),
              })
              .eq("id", cp.id);
          } else {
            // No more steps after delay — complete
            await admin
              .from("campaign_prospects")
              .update({
                status: "completed",
                status_reason: null,
                completed_at: new Date().toISOString(),
                current_step_id: null,
                next_send_at: null,
              })
              .eq("id", cp.id);
          }
        } else {
          // Direct action step
          nextSendAt = getNextSendTime(
            campaign?.timezone || "Europe/Paris",
            campaign?.sending_window_start || "08:00",
            campaign?.sending_window_end || "18:00",
            campaign?.sending_days || [1, 2, 3, 4, 5],
            0,
            0
          );

          await admin
            .from("campaign_prospects")
            .update({
              status: "active",
              status_reason: null,
              current_step_id: nextStep.id,
              next_send_at: nextSendAt.toISOString(),
            })
            .eq("id", cp.id);
        }
      } else {
        // No more steps — mark as completed
        await admin
          .from("campaign_prospects")
          .update({
            status: "completed",
            status_reason: null,
            completed_at: new Date().toISOString(),
            current_step_id: null,
            next_send_at: null,
          })
          .eq("id", cp.id);
      }
    }
  }

  return NextResponse.json({ success: true, message: "Task completed and campaign step advanced" });
}
