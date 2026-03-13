import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/prospects — List prospects (for dropdowns/selectors)
export async function GET(request: NextRequest) {
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

  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "100", 10);

  const { data: prospects, error } = await supabase
    .from("prospects")
    .select("id, first_name, last_name, email, company")
    .eq("workspace_id", workspaceId)
    .order("last_name", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors du chargement", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ prospects: prospects || [] });
}
