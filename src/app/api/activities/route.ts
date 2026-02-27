import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/activities — List activities with filters and due date grouping
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

  const { searchParams } = new URL(request.url);
  const isDone = searchParams.get("is_done");
  const activityType = searchParams.get("activity_type");
  const assignedTo = searchParams.get("assigned_to");
  const dealId = searchParams.get("deal_id");
  const prospectId = searchParams.get("prospect_id");
  const due = searchParams.get("due"); // overdue | today | week | all

  let query = supabase
    .from("activities")
    .select(
      `
      *,
      deal:deals(id, title),
      prospect:prospects(id, first_name, last_name, email),
      assignee:profiles!activities_assigned_to_fkey(id, full_name)
    `
    )
    .eq("workspace_id", workspaceId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (isDone !== null) {
    query = query.eq("is_done", isDone === "true");
  }
  if (activityType) query = query.eq("activity_type", activityType);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (dealId) query = query.eq("deal_id", dealId);
  if (prospectId) query = query.eq("prospect_id", prospectId);

  // Due date filtering
  if (due && due !== "all") {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    if (due === "overdue") {
      query = query.lt("due_date", todayStart).eq("is_done", false);
    } else if (due === "today") {
      query = query.gte("due_date", todayStart).lt("due_date", todayEnd);
    } else if (due === "week") {
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();
      query = query.gte("due_date", todayStart).lt("due_date", weekEnd);
    }
  }

  const { data: activities, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors du chargement", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ activities: activities || [] });
}

// POST /api/activities — Create a new activity
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

  const {
    activity_type,
    title,
    description,
    due_date,
    deal_id,
    prospect_id,
    assigned_to,
  } = await request.json();

  if (!activity_type) {
    return NextResponse.json(
      { error: "Le type d'activite est requis" },
      { status: 400 }
    );
  }

  const { data: activity, error } = await supabase
    .from("activities")
    .insert({
      workspace_id: workspaceId,
      activity_type,
      title: title || null,
      description: description || null,
      due_date: due_date || null,
      deal_id: deal_id || null,
      prospect_id: prospect_id || null,
      assigned_to: assigned_to || user.id,
      created_by: user.id,
      is_done: false,
    })
    .select(
      `
      *,
      deal:deals(id, title),
      prospect:prospects(id, first_name, last_name, email),
      assignee:profiles!activities_assigned_to_fkey(id, full_name)
    `
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la creation", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ activity });
}
