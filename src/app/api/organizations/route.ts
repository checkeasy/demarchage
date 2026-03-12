import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/organizations — List organizations for current workspace
export async function GET(_request: NextRequest) {
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

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors du chargement", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ organizations: organizations || [] });
}

// POST /api/organizations — Create a new organization
export async function POST(request: NextRequest) {
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
  const { name, website, industry, city, country } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Le nom de l'organisation est requis" },
      { status: 400 }
    );
  }

  // Extract domain from website if provided
  let domain: string | null = null;
  if (website) {
    try {
      let cleaned = website.trim();
      if (!/^https?:\/\//i.test(cleaned)) {
        cleaned = `https://${cleaned}`;
      }
      const parsed = new URL(cleaned);
      domain = parsed.hostname.replace(/^www\./i, "").toLowerCase() || null;
    } catch {
      // invalid URL, keep domain null
    }
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .insert({
      workspace_id: workspaceId,
      name: name.trim(),
      website: website?.trim() || null,
      domain,
      industry: industry?.trim() || null,
      city: city?.trim() || null,
      country: country?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la creation", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ organization });
}
