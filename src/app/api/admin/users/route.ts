import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifySuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Check JWT metadata first (fast)
  if (user.app_metadata?.role === "super_admin") return user;

  // Fallback: check profiles table
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") return null;
  return user;
}

// GET /api/admin/users — List all users with workspace memberships
export async function GET() {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const adminClient = createAdminClient();

  // Get all profiles
  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get workspace memberships with workspace info
  const { data: memberships } = await adminClient
    .from("workspace_members")
    .select("user_id, workspace_id, role, workspaces(id, name, slug, plan)");

  // Get all workspaces for the assign dialog
  const { data: workspaces } = await adminClient
    .from("workspaces")
    .select("id, name, slug, plan")
    .order("name");

  // Group memberships by user_id
  const membershipMap: Record<
    string,
    { id: string; name: string; slug: string; plan: string; role: string }[]
  > = {};
  for (const m of memberships ?? []) {
    if (!membershipMap[m.user_id]) membershipMap[m.user_id] = [];
    const ws = m.workspaces as unknown as {
      id: string;
      name: string;
      slug: string;
      plan: string;
    } | null;
    if (ws) {
      membershipMap[m.user_id].push({ ...ws, role: m.role });
    }
  }

  // Get auth users for emails
  const {
    data: { users: authUsers },
  } = await adminClient.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  for (const u of authUsers ?? []) {
    emailMap[u.id] = u.email ?? "";
  }

  const users = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap[p.id] || "",
    workspaces: membershipMap[p.id] || [],
  }));

  return NextResponse.json({ users, workspaces: workspaces ?? [] });
}

// POST /api/admin/users — Invite a new user
export async function POST(request: Request) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const body = await request.json();
  const { email, full_name, workspace_ids } = body as {
    email: string;
    full_name?: string;
    workspace_ids?: string[];
  };

  if (!email) {
    return NextResponse.json({ error: "Email requis" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const origin = request.headers.get("origin") || "";

  // Invite user via Supabase Auth (sends magic link email)
  const { data: authData, error: authError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name || "" },
      redirectTo: `${origin}/auth/callback`,
    });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  // Set app_metadata role
  await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { role: "user" },
  });

  // Profile is auto-created by trigger; update with correct data
  // Small delay to let trigger fire
  await new Promise((r) => setTimeout(r, 500));

  await adminClient
    .from("profiles")
    .update({
      full_name: full_name || null,
      role: "user",
      is_active: true,
    })
    .eq("id", userId);

  // Assign to workspaces
  if (workspace_ids && workspace_ids.length > 0) {
    for (const wsId of workspace_ids) {
      await adminClient.from("workspace_members").upsert(
        {
          workspace_id: wsId,
          user_id: userId,
          role: "member",
        },
        { onConflict: "workspace_id,user_id" }
      );
    }

    // Set first workspace as current
    await adminClient
      .from("profiles")
      .update({ current_workspace_id: workspace_ids[0] })
      .eq("id", userId);
  }

  return NextResponse.json({ success: true, userId });
}
