import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProspectPageClient } from "@/components/prospects/ProspectPageClient";

export default async function ProspectsPage() {
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

  // Fetch prospects for this workspace
  const { data: prospects } = await supabase
    .from("prospects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Prospects</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerez votre base de prospects et importez de nouveaux contacts
        </p>
      </div>

      <ProspectPageClient
        prospects={prospects ?? []}
        workspaceId={workspaceId}
      />
    </div>
  );
}
