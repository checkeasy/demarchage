import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSignalEmail } from "@/lib/outreach/signal-email-generator";

// POST /api/prospects/generate-signal-email — Generate email from signal
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { prospect_id, signal } = body;

  if (!prospect_id || !signal?.signal_type || !signal?.title) {
    return NextResponse.json({ error: "prospect_id and signal required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: prospect } = await admin
    .from("prospects")
    .select("id, first_name, last_name, company, organization, city")
    .eq("id", prospect_id)
    .single();

  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  }

  // Get sender name from profile
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const email = await generateSignalEmail(
    prospect as {
      first_name: string | null;
      last_name: string | null;
      company: string | null;
      organization: string | null;
      city: string | null;
    },
    signal,
    profile?.full_name || undefined
  );

  return NextResponse.json(email);
}
