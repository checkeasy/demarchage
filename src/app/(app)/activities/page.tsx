import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActivityCalendar } from "@/components/activities/ActivityCalendar";

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

  // Fetch ALL activities (calendar needs full range, not just pending + done today)
  // Get activities from 3 months ago to 3 months ahead
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAhead = new Date();
  threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

  const { data: allActivities } = await supabase
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
    .or(
      `due_date.gte.${threeMonthsAgo.toISOString()},due_date.is.null`
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(2000);

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
      <ActivityCalendar
        activities={allActivities ?? []}
        deals={deals ?? []}
        prospects={prospects ?? []}
      />
    </div>
  );
}
