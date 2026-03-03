import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  const userData = {
    email: user.email,
    full_name: profile?.full_name ?? undefined,
    avatar_url: profile?.avatar_url ?? undefined,
    role: (profile?.role as "super_admin" | "user") ?? "user",
  };

  // Fetch sidebar count badges (lightweight count queries)
  const currentWsQuery = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();
  const wsId = currentWsQuery.data?.current_workspace_id;

  let sidebarCounts: { campaigns?: number; prospects?: number; activities?: number; deals?: number } = {};
  if (wsId) {
    const [campaignsRes, prospectsRes, activitiesRes, dealsRes] = await Promise.all([
      supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).in("status", ["active", "draft"]),
      supabase.from("prospects").select("id", { count: "exact", head: true }).eq("workspace_id", wsId),
      supabase.from("activities").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("is_done", false),
      supabase.from("deals").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("status", "open"),
    ]);
    sidebarCounts = {
      campaigns: campaignsRes.count ?? undefined,
      prospects: prospectsRes.count ?? undefined,
      activities: activitiesRes.count ?? undefined,
      deals: dealsRes.count ?? undefined,
    };
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <Sidebar user={userData} counts={sidebarCounts} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <Header title="ColdReach" user={userData} />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
          <div className="mx-auto max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
