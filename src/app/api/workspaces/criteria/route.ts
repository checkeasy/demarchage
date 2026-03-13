import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CustomQualificationCriteria } from "@/lib/types/database";

// GET: Return custom qualification criteria for the active workspace
export async function GET() {
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

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "Aucun workspace actif" }, { status: 400 });
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("settings")
    .eq("id", profile.current_workspace_id)
    .single();

  if (error || !workspace) {
    return NextResponse.json({ error: "Workspace introuvable" }, { status: 404 });
  }

  const settings = workspace.settings as Record<string, unknown> | null;
  const criteria = (settings?.custom_qualification_criteria as CustomQualificationCriteria[]) || [];

  return NextResponse.json({ criteria });
}

// POST: Add a new custom qualification criteria
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

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "Aucun workspace actif" }, { status: 400 });
  }

  const body = await request.json();
  const { key, label, options } = body as {
    key: string;
    label: string;
    options: { value: string; label: string }[];
  };

  if (!key || !label || !options || options.length === 0) {
    return NextResponse.json(
      { error: "key, label et options sont requis" },
      { status: 400 }
    );
  }

  // Get current settings
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("settings")
    .eq("id", profile.current_workspace_id)
    .single();

  const currentSettings = (workspace?.settings as Record<string, unknown>) || {};
  const existingCriteria = (currentSettings.custom_qualification_criteria as CustomQualificationCriteria[]) || [];

  // Check for duplicate key
  if (existingCriteria.some((c) => c.key === key)) {
    return NextResponse.json(
      { error: "Un critere avec cette cle existe deja" },
      { status: 409 }
    );
  }

  const updatedCriteria = [...existingCriteria, { key, label, options }];

  const { error } = await supabase
    .from("workspaces")
    .update({
      settings: {
        ...currentSettings,
        custom_qualification_criteria: updatedCriteria,
      },
    })
    .eq("id", profile.current_workspace_id);

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la sauvegarde", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ criteria: updatedCriteria });
}

// DELETE: Remove a custom qualification criteria by key
export async function DELETE(request: NextRequest) {
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

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "Aucun workspace actif" }, { status: 400 });
  }

  const body = await request.json();
  const { key } = body as { key: string };

  if (!key) {
    return NextResponse.json({ error: "key est requis" }, { status: 400 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("settings")
    .eq("id", profile.current_workspace_id)
    .single();

  const currentSettings = (workspace?.settings as Record<string, unknown>) || {};
  const existingCriteria = (currentSettings.custom_qualification_criteria as CustomQualificationCriteria[]) || [];

  const updatedCriteria = existingCriteria.filter((c) => c.key !== key);

  const { error } = await supabase
    .from("workspaces")
    .update({
      settings: {
        ...currentSettings,
        custom_qualification_criteria: updatedCriteria,
      },
    })
    .eq("id", profile.current_workspace_id);

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la suppression", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ criteria: updatedCriteria });
}
