import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifySuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (user.app_metadata?.role === "super_admin") return user;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") return null;
  return user;
}

// PATCH /api/admin/users/[id] — Update user
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const { id: userId } = await params;
  const body = await request.json();
  const { full_name, is_active, workspace_ids } = body as {
    full_name?: string;
    is_active?: boolean;
    workspace_ids?: string[];
  };

  const adminClient = createAdminClient();

  // Update profile fields
  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (is_active !== undefined) updates.is_active = is_active;

  if (Object.keys(updates).length > 0) {
    const { error } = await adminClient
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Update workspace assignments if provided
  if (workspace_ids !== undefined) {
    // Get current memberships
    const { data: currentMembers } = await adminClient
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", userId);

    const currentWsIds = (currentMembers ?? []).map((m) => m.workspace_id);
    const isOwner = (currentMembers ?? []).reduce(
      (map, m) => {
        if (m.role === "owner") map[m.workspace_id] = true;
        return map;
      },
      {} as Record<string, boolean>
    );

    // Remove from workspaces no longer assigned (but not if owner)
    const toRemove = currentWsIds.filter(
      (wsId) => !workspace_ids.includes(wsId) && !isOwner[wsId]
    );
    if (toRemove.length > 0) {
      await adminClient
        .from("workspace_members")
        .delete()
        .eq("user_id", userId)
        .in("workspace_id", toRemove);
    }

    // Add to new workspaces
    const toAdd = workspace_ids.filter((wsId) => !currentWsIds.includes(wsId));
    for (const wsId of toAdd) {
      await adminClient.from("workspace_members").upsert(
        {
          workspace_id: wsId,
          user_id: userId,
          role: "member",
        },
        { onConflict: "workspace_id,user_id" }
      );
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/users/[id] — Soft-delete (deactivate)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const { id: userId } = await params;

  // Prevent self-deactivation
  if (userId === admin.id) {
    return NextResponse.json(
      { error: "Impossible de desactiver votre propre compte" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
