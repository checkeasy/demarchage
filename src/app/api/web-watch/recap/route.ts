import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDailyRecap } from "@/lib/web-watch/daily-recap";

// POST /api/web-watch/recap — Send daily recap email (manual or cron)
export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  let workspaceId: string;

  // Support CRON_SECRET auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (isCronAuth) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, current_workspace_id")
      .limit(1)
      .single();
    if (!profile?.current_workspace_id) {
      return NextResponse.json({ error: "No workspace" }, { status: 500 });
    }
    workspaceId = profile.current_workspace_id;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await admin
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", user.id)
      .single();

    if (!profile?.current_workspace_id) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 });
    }
    workspaceId = profile.current_workspace_id;
  }

  try {
    const result = await sendDailyRecap(workspaceId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[WebWatch Recap] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne" },
      { status: 500 }
    );
  }
}
