import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { autoLinkToOrganization } from "@/lib/utils/organization-linker";

// POST /api/organizations/autolink — Re-run auto-linking for unlinked prospects
export async function POST(_request: NextRequest) {
  try {
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

    // Fetch all prospects where organization_id IS NULL
    // AND (company IS NOT NULL OR website IS NOT NULL)
    const allProspects: Array<{
      id: string;
      company: string | null;
      organization: string | null;
      website: string | null;
    }> = [];
    let offset = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("prospects")
        .select("id, company, organization, website")
        .eq("workspace_id", workspaceId)
        .is("organization_id", null)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        return NextResponse.json(
          { error: "Erreur lors du chargement des prospects", details: error.message },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) break;

      // Only keep those with company or website
      data.forEach((p) => {
        if (p.company || p.organization || p.website) {
          allProspects.push(p);
        }
      });

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    let linked = 0;

    for (const prospect of allProspects) {
      const companyName = prospect.organization || prospect.company || null;
      const result = await autoLinkToOrganization(supabase, workspaceId, {
        prospectId: prospect.id,
        companyName,
        website: prospect.website,
      });

      if (result) {
        linked++;
      }
    }

    return NextResponse.json({ linked });
  } catch (err) {
    console.error("[API Autolink] Error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
