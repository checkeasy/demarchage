export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/queries/auth";
import { AdminView } from "@/components/admin/AdminView";

export default async function AdminPage() {
  const profile = await getUserProfile();

  if (!profile || profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Administration</h2>
        <p className="text-sm text-muted-foreground">
          Gerez les utilisateurs et leurs acces aux workspaces.
        </p>
      </div>
      <AdminView />
    </div>
  );
}
