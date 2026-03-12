import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/automation/activity — Get recent automation activity
export async function GET() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single();
  if (!profile?.current_workspace_id) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const workspaceId = profile.current_workspace_id;

  try {
    const { data: logs, error } = await supabase
      .from("automation_actions_log")
      .select(`
        id,
        action_type,
        status,
        message_sent,
        error_message,
        created_at
      `)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[Automation Activity] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map action types to frontend format
    const typeMap: Record<string, string> = {
      view_profile: "view",
      connect: "connect",
      message: "message",
      email: "email",
      check_accepted: "connect",
      search: "view",
    };

    const formatted = (logs || []).map((log) => ({
      id: log.id,
      type: typeMap[log.action_type] || "view",
      message: log.message_sent || log.error_message || log.action_type,
      status: log.status,
      timestamp: formatTimestamp(log.created_at),
    }));

    return NextResponse.json({ activity: formatted });
  } catch (err) {
    console.error("[Automation Activity] Error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
