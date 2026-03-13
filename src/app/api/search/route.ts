import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/search?q=xxx — Cross-entity search
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

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${q}%`;

  // Search prospects
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, first_name, last_name, email, company")
    .eq("workspace_id", workspaceId)
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},company.ilike.${pattern}`)
    .limit(5);

  // Search deals
  const { data: deals } = await supabase
    .from("deals")
    .select("id, title, value, status")
    .eq("workspace_id", workspaceId)
    .ilike("title", pattern)
    .limit(5);

  // Search organizations
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, domain")
    .eq("workspace_id", workspaceId)
    .or(`name.ilike.${pattern},domain.ilike.${pattern}`)
    .limit(5);

  const results = [
    ...(prospects || []).map((p) => ({
      type: "prospect" as const,
      id: p.id,
      title: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email,
      subtitle: p.company || p.email,
      href: `/prospects/${p.id}`,
    })),
    ...(deals || []).map((d) => ({
      type: "deal" as const,
      id: d.id,
      title: d.title,
      subtitle: d.status === "won" ? "Gagne" : d.status === "lost" ? "Perdu" : "En cours",
      href: `/deals/${d.id}`,
    })),
    ...(organizations || []).map((o) => ({
      type: "organization" as const,
      id: o.id,
      title: o.name,
      subtitle: o.domain || "",
      href: `/organizations/${o.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
