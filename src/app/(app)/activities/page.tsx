import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActivityList } from "@/components/activities/ActivityList";

export default async function ActivitiesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get current workspace_id from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;

  if (!workspaceId) {
    redirect("/onboarding");
  }

  // Fetch pending activities (is_done = false, ordered by due_date ASC NULLS LAST)
  const { data: pendingActivities } = await supabase
    .from("activities")
    .select(
      `
      *,
      deal:deals(id, title),
      prospect:prospects(id, first_name, last_name, email),
      assignee:profiles!activities_assigned_to_fkey(id, full_name)
    `
    )
    .eq("workspace_id", workspaceId)
    .eq("is_done", false)
    .order("due_date", { ascending: true, nullsFirst: false });

  // Fetch activities done today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: doneToday } = await supabase
    .from("activities")
    .select(
      `
      *,
      deal:deals(id, title),
      prospect:prospects(id, first_name, last_name, email),
      assignee:profiles!activities_assigned_to_fkey(id, full_name)
    `
    )
    .eq("workspace_id", workspaceId)
    .eq("is_done", true)
    .gte("done_at", todayStart.toISOString())
    .order("done_at", { ascending: false });

  // Combine all activities
  const activities = [...(pendingActivities || []), ...(doneToday || [])];

  // Fetch deals list (for dropdown in AddActivityDialog)
  const { data: deals } = await supabase
    .from("deals")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .eq("status", "open")
    .order("title", { ascending: true });

  // Fetch prospects list (for dropdown in AddActivityDialog)
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, first_name, last_name, email")
    .eq("workspace_id", workspaceId)
    .order("first_name", { ascending: true })
    .limit(500);

  return (
    <div className="space-y-6">
      <ActivityList
        activities={activities ?? []}
        deals={deals ?? []}
        prospects={prospects ?? []}
      />
    </div>
  );
}
