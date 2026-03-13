import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/signals/detect — AI-powered signal detection from prospect data
// Analyzes prospect notes, activities, and enrichment data to detect buying signals
export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  let userId: string;
  let workspaceId: string;

  // Support CRON_SECRET auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (isCronAuth) {
    const { data: profile } = await admin.from("profiles").select("id, current_workspace_id").limit(1).single();
    if (!profile?.current_workspace_id) return NextResponse.json({ error: "No workspace" }, { status: 500 });
    workspaceId = profile.current_workspace_id;
    userId = profile.id;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;

    const { data: profile } = await admin
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", user.id)
      .single();

    if (!profile?.current_workspace_id) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 });
    }
    workspaceId = profile.current_workspace_id;
  }
  const body = await request.json();
  const { prospect_ids, scan_all } = body;

  // Get prospects to scan
  let prospects;
  if (scan_all) {
    const { data } = await admin
      .from("prospects")
      .select("id, first_name, last_name, company, email, linkedin_url, phone, status, lead_score, custom_fields, nb_properties, source, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["active"])
      .order("updated_at", { ascending: false })
      .limit(200);
    prospects = data || [];
  } else if (prospect_ids?.length > 0) {
    const { data } = await admin
      .from("prospects")
      .select("id, first_name, last_name, company, email, linkedin_url, phone, status, lead_score, custom_fields, nb_properties, source, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .in("id", prospect_ids);
    prospects = data || [];
  } else {
    return NextResponse.json({ error: "prospect_ids or scan_all required" }, { status: 400 });
  }

  // Get recent notes for these prospects
  const prospectIds = prospects.map((p: { id: string }) => p.id);
  const { data: notes } = await admin
    .from("notes")
    .select("id, prospect_id, content, created_at")
    .in("prospect_id", prospectIds)
    .order("created_at", { ascending: false })
    .limit(500);

  // Get recent activities
  const { data: activities } = await admin
    .from("activities")
    .select("id, prospect_id, activity_type, title, description, outcome, is_done, due_date")
    .in("prospect_id", prospectIds)
    .order("created_at", { ascending: false })
    .limit(500);

  // Get existing signals to avoid duplicates
  const { data: existingSignals } = await admin
    .from("prospect_signals")
    .select("prospect_id, signal_type, title")
    .eq("workspace_id", workspaceId)
    .in("prospect_id", prospectIds);

  const existingSet = new Set(
    (existingSignals || []).map((s: { prospect_id: string; signal_type: string }) => `${s.prospect_id}:${s.signal_type}`)
  );

  // Build note map
  const notesByProspect = new Map<string, string[]>();
  for (const n of notes || []) {
    const note = n as { prospect_id: string; content: string };
    const arr = notesByProspect.get(note.prospect_id) || [];
    arr.push(note.content);
    notesByProspect.set(note.prospect_id, arr);
  }

  // Detect signals heuristically
  const newSignals: {
    workspace_id: string;
    prospect_id: string;
    signal_type: string;
    title: string;
    description: string;
    signal_score: number;
    signal_source: string;
  }[] = [];

  for (const p of prospects) {
    const prospect = p as { id: string; first_name: string | null; last_name: string | null; company: string | null; nb_properties: number | null; custom_fields: Record<string, unknown>; source: string; lead_score: number | null };
    const prospectNotes = notesByProspect.get(prospect.id) || [];
    const allText = prospectNotes.join(" ").toLowerCase();
    const cf = prospect.custom_fields || {};

    // Signal: Expansion/Growth
    if (
      (prospect.nb_properties && prospect.nb_properties > 20) ||
      allText.includes("grandir") ||
      allText.includes("croissance") ||
      allText.includes("expansion") ||
      allText.includes("nouveaux biens") ||
      allText.includes("augment")
    ) {
      if (!existingSet.has(`${prospect.id}:expansion`)) {
        newSignals.push({
          workspace_id: workspaceId,
          prospect_id: prospect.id,
          signal_type: "expansion",
          title: "Croissance detectee",
          description: prospect.nb_properties
            ? `${prospect.nb_properties} biens geres - potentiel d'expansion`
            : "Mots-cles de croissance detectes dans les notes",
          signal_score: 25,
          signal_source: "enrichment",
        });
      }
    }

    // Signal: Pain point detected
    if (
      allText.includes("probleme") ||
      allText.includes("frustre") ||
      allText.includes("pas satisfait") ||
      allText.includes("galere") ||
      allText.includes("complique") ||
      allText.includes("bug") ||
      allText.includes("lent") ||
      allText.includes("cher") ||
      allText.includes("trop cher")
    ) {
      if (!existingSet.has(`${prospect.id}:pain_point_detected`)) {
        newSignals.push({
          workspace_id: workspaceId,
          prospect_id: prospect.id,
          signal_type: "pain_point_detected",
          title: "Point de douleur detecte",
          description: "Mots-cles de frustration detectes dans les notes Pipedrive",
          signal_score: 30,
          signal_source: "enrichment",
        });
      }
    }

    // Signal: Competitor engagement
    if (
      allText.includes("concurrent") ||
      allText.includes("travaille avec") ||
      allText.includes("utilise deja") ||
      allText.includes("superhote") ||
      allText.includes("hostaway") ||
      allText.includes("guesty") ||
      allText.includes("lodgify") ||
      allText.includes("smoobu")
    ) {
      if (!existingSet.has(`${prospect.id}:competitor_engagement`)) {
        newSignals.push({
          workspace_id: workspaceId,
          prospect_id: prospect.id,
          signal_type: "competitor_engagement",
          title: "Utilise un concurrent",
          description: "Mention d'un concurrent ou outil existant dans les notes",
          signal_score: 35,
          signal_source: "enrichment",
        });
      }
    }

    // Signal: Technology change
    if (
      allText.includes("changer") ||
      allText.includes("migration") ||
      allText.includes("remplacer") ||
      allText.includes("passer a") ||
      allText.includes("nouveau logiciel") ||
      allText.includes("cherche un outil")
    ) {
      if (!existingSet.has(`${prospect.id}:technology_change`)) {
        newSignals.push({
          workspace_id: workspaceId,
          prospect_id: prospect.id,
          signal_type: "technology_change",
          title: "Changement de techno en cours",
          description: "Le prospect semble chercher un nouvel outil ou migrer",
          signal_score: 20,
          signal_source: "enrichment",
        });
      }
    }

    // Signal: Hiring
    if (
      allText.includes("recrute") ||
      allText.includes("embauche") ||
      allText.includes("cherche quelqu") ||
      allText.includes("poste") ||
      (cf.objectif_parc && (cf.objectif_parc as string[]).includes("grandir"))
    ) {
      if (!existingSet.has(`${prospect.id}:hiring`)) {
        newSignals.push({
          workspace_id: workspaceId,
          prospect_id: prospect.id,
          signal_type: "hiring",
          title: "Recrutement / Croissance d'equipe",
          description: "Signaux de recrutement ou d'equipe en croissance detectes",
          signal_score: 20,
          signal_source: "enrichment",
        });
      }
    }
  }

  // Insert detected signals
  let created = 0;
  if (newSignals.length > 0) {
    for (let i = 0; i < newSignals.length; i += 50) {
      const batch = newSignals.slice(i, i + 50);
      const { error } = await admin.from("prospect_signals").insert(
        batch.map(s => ({ ...s, created_by: userId }))
      );
      if (!error) created += batch.length;
    }
  }

  return NextResponse.json({
    success: true,
    scanned: prospects.length,
    signals_detected: newSignals.length,
    signals_created: created,
    by_type: newSignals.reduce((acc, s) => {
      acc[s.signal_type] = (acc[s.signal_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  });
}
