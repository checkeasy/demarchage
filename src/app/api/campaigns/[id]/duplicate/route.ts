import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { data: original, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !original) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const { data: newCampaign, error: createError } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: original.workspace_id,
      email_account_id: original.email_account_id,
      name: `${original.name} (copie)`,
      description: original.description,
      timezone: original.timezone,
      sending_window_start: original.sending_window_start,
      sending_window_end: original.sending_window_end,
      sending_days: original.sending_days,
      daily_limit: original.daily_limit,
      track_opens: original.track_opens,
      track_clicks: original.track_clicks,
      status: "draft",
    })
    .select()
    .single();

  if (createError || !newCampaign) {
    return NextResponse.json({ error: "Erreur lors de la duplication" }, { status: 500 });
  }

  // Duplicate sequence steps
  const { data: steps } = await supabase
    .from("sequence_steps")
    .select("*")
    .eq("campaign_id", id)
    .order("step_order", { ascending: true });

  if (steps && steps.length > 0) {
    await supabase.from("sequence_steps").insert(
      steps.map((s) => ({
        campaign_id: newCampaign.id,
        step_order: s.step_order,
        step_type: s.step_type,
        subject: s.subject,
        body_html: s.body_html,
        body_text: s.body_text,
        delay_days: s.delay_days,
        delay_hours: s.delay_hours,
        is_active: s.is_active,
      }))
    );
  }

  return NextResponse.json({ id: newCampaign.id });
}
