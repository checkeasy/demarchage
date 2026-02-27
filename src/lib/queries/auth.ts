import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types/database";

export type UserRole = "super_admin" | "user";

export async function getUserProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Use admin client to bypass RLS
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function isSuperAdmin(): Promise<boolean> {
  const profile = await getUserProfile();
  return profile?.role === "super_admin";
}
