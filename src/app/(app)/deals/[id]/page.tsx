import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DealDetail } from "@/components/deals/DealDetail";

interface DealPageProps {
  params: Promise<{ id: string }>;
}

export default async function DealPage({ params }: DealPageProps) {
  const { id } = await params;
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

  // Fetch the single deal with joins
  const { data: deal, error } = await supabase
    .from("deals")
    .select(
      `
      *,
      prospect:prospects(id, first_name, last_name, email, company),
      stage:pipeline_stages(id, name, color, slug),
      owner:profiles!deals_owner_id_fkey(id, full_name)
    `
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !deal) {
    notFound();
  }

  // Fetch pipeline stages for the stage selector
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("display_order", { ascending: true });

  return (
    <DealDetail
      deal={deal}
      stages={stages ?? []}
    />
  );
}
