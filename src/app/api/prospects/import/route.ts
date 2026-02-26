import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prospectSchema } from "@/lib/validations";

interface ProspectRow {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  job_title?: string;
  phone?: string;
  linkedin_url?: string;
  website?: string;
  location?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prospects, workspace_id } = body as {
      prospects: ProspectRow[];
      workspace_id: string;
    };

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json(
        { error: "Aucun prospect fourni" },
        { status: 400 }
      );
    }

    if (!workspace_id) {
      return NextResponse.json(
        { error: "workspace_id requis" },
        { status: 400 }
      );
    }

    // Verify user has access to this workspace
    const { data: member } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: "Acces au workspace non autorise" },
        { status: 403 }
      );
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Process prospects in batches of 100
    const batchSize = 100;
    for (let i = 0; i < prospects.length; i += batchSize) {
      const batch = prospects.slice(i, i + batchSize);
      const validProspects: {
        workspace_id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        company: string | null;
        job_title: string | null;
        phone: string | null;
        linkedin_url: string | null;
        website: string | null;
        location: string | null;
        source: "csv_import";
      }[] = [];

      for (const prospect of batch) {
        const result = prospectSchema.safeParse(prospect);
        if (!result.success) {
          errors++;
          continue;
        }

        // Clean empty strings to null
        const cleaned: Record<string, string | null> = {};
        for (const [key, value] of Object.entries(result.data)) {
          cleaned[key] = value && value.trim() !== "" ? value.trim() : null;
        }

        validProspects.push({
          workspace_id,
          email: cleaned.email!,
          first_name: cleaned.first_name ?? null,
          last_name: cleaned.last_name ?? null,
          company: cleaned.company ?? null,
          job_title: cleaned.job_title ?? null,
          phone: cleaned.phone ?? null,
          linkedin_url: cleaned.linkedin_url ?? null,
          website: cleaned.website ?? null,
          location: cleaned.location ?? null,
          source: "csv_import" as const,
        });
      }

      if (validProspects.length === 0) continue;

      // Upsert: on conflict (workspace_id, email) update the fields
      const { data, error } = await supabase
        .from("prospects")
        .upsert(validProspects, {
          onConflict: "workspace_id,email",
          ignoreDuplicates: false,
        })
        .select("id");

      if (error) {
        // If upsert fails, try inserting one by one
        for (const prospect of validProspects) {
          const { error: singleError } = await supabase
            .from("prospects")
            .upsert(prospect, {
              onConflict: "workspace_id,email",
              ignoreDuplicates: false,
            });

          if (singleError) {
            errors++;
          } else {
            imported++;
          }
        }
      } else {
        imported += data?.length ?? validProspects.length;
      }
    }

    skipped = prospects.length - imported - errors;

    return NextResponse.json({
      imported,
      skipped: Math.max(0, skipped),
      errors,
      total: prospects.length,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
