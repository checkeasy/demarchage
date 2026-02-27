import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DealsViewToggle } from "@/components/deals/DealsViewToggle";

export default async function DealsPage() {
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

  // Fetch pipeline stages ordered by display_order
  const { data: stages } = await supabase
    .from("pipeline_stages_config")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("display_order", { ascending: true });

  // Fetch all deals with joins (prospect, stage)
  const { data: deals } = await supabase
    .from("deals")
    .select(
      `
      *,
      prospect:prospects(id, first_name, last_name, email, company),
      stage:pipeline_stages_config(id, name, color, slug)
    `
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  // Fetch prospects list for AddDealDialog dropdown
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, first_name, last_name, email, company")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Pipeline</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Visualisez et gerez vos deals dans le pipeline de vente
        </p>
      </div>

      <DealsViewToggle
        stages={stages ?? []}
        deals={deals ?? []}
        prospects={prospects ?? []}
      />
    </div>
  );
}
