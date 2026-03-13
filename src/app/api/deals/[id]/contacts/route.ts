import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/deals/[id]/contacts — List contacts for a deal
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

  const { data: contacts, error } = await supabase
    .from("deal_contacts")
    .select(
      `
      *,
      prospect:prospects(id, first_name, last_name, email, company)
    `
    )
    .eq("deal_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors du chargement", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ contacts: contacts || [] });
}

// POST /api/deals/[id]/contacts — Add a contact to a deal
export async function POST(
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

  const { prospect_id, role } = await request.json();

  if (!prospect_id) {
    return NextResponse.json(
      { error: "prospect_id est requis" },
      { status: 400 }
    );
  }

  const { data: contact, error } = await supabase
    .from("deal_contacts")
    .insert({
      deal_id: id,
      prospect_id,
      role: role || "contact",
    })
    .select(
      `
      *,
      prospect:prospects(id, first_name, last_name, email, company)
    `
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ce contact est deja lie a ce deal" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de l'ajout", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ contact });
}

// DELETE /api/deals/[id]/contacts — Remove a contact from a deal
export async function DELETE(
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

  const { prospect_id } = await request.json();

  if (!prospect_id) {
    return NextResponse.json(
      { error: "prospect_id est requis" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("deal_contacts")
    .delete()
    .eq("deal_id", id)
    .eq("prospect_id", prospect_id);

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de la suppression", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
