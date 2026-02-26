import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgentsPageClient } from "@/components/agents/AgentsPageClient";

export default async function AgentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();
  if (!profile?.current_workspace_id) redirect("/dashboard");

  // Fetch agent configs
  const { data: configs } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("workspace_id", profile.current_workspace_id)
    .order("agent_type");

  // Fetch workspace context
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name, ai_company_context, settings")
    .eq("id", profile.current_workspace_id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Agents IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez et pilotez vos agents intelligents de prospection
        </p>
      </div>
      <AgentsPageClient
        configs={configs || []}
        workspaceId={profile.current_workspace_id}
        workspaceName={workspace?.name || ""}
        companyContext={workspace?.ai_company_context || ""}
      />
    </div>
  );
}
