import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/organizations/[id] — Fetch single org with its prospects
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "Pas de workspace" }, { status: 400 });
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !organization) {
    return NextResponse.json(
      { error: "Organisation introuvable" },
      { status: 404 }
    );
  }

  const { data: prospects } = await supabase
    .from("prospects")
    .select(
      "id, first_name, last_name, email, job_title, status, last_contacted_at"
    )
    .eq("organization_id", id)
    .order("last_name");

  return NextResponse.json({
    organization,
    prospects: prospects || [],
  });
}

// PATCH /api/organizations/[id] — Update org fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "Pas de workspace" }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.website !== undefined) {
    updates.website = body.website;
    // Re-extract domain
    if (body.website) {
      try {
        let cleaned = body.website.trim();
        if (!/^https?:\/\//i.test(cleaned)) {
          cleaned = `https://${cleaned}`;
        }
        const parsed = new URL(cleaned);
        updates.domain =
          parsed.hostname.replace(/^www\./i, "").toLowerCase() || null;
      } catch {
        updates.domain = null;
      }
    } else {
      updates.domain = null;
    }
  }
  if (body.industry !== undefined) updates.industry = body.industry;
  if (body.city !== undefined) updates.city = body.city;
  if (body.country !== undefined) updates.country = body.country;
  if (body.description !== undefined) updates.description = body.description;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Aucun champ a mettre a jour" },
      { status: 400 }
    );
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la mise a jour", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ organization });
}

// DELETE /api/organizations/[id] — Delete org
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "Pas de workspace" }, { status: 400 });
  }

  // Unlink all prospects first (workspace isolated)
  await supabase
    .from("prospects")
    .update({ organization_id: null })
    .eq("organization_id", id)
    .eq("workspace_id", workspaceId);

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la suppression", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
