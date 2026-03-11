import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: List email accounts assigned to a campaign (for rotation)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaign_email_accounts")
    .select(`
      id,
      email_account_id,
      priority,
      is_active,
      emails_sent_today,
      last_used_at,
      email_accounts:email_account_id (
        id,
        email_address,
        display_name,
        provider,
        daily_limit,
        health_score,
        is_active,
        warmup_enabled,
        warmup_current_volume,
        warmup_daily_target
      )
    `)
    .eq("campaign_id", campaignId)
    .order("priority", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data || [] });
}

// POST: Add email accounts to a campaign for rotation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { email_account_ids } = body as { email_account_ids: string[] };

  if (!Array.isArray(email_account_ids) || email_account_ids.length === 0) {
    return NextResponse.json({ error: "email_account_ids requis" }, { status: 400 });
  }

  // Insert with upsert to avoid duplicates
  const rows = email_account_ids.map((accountId, idx) => ({
    campaign_id: campaignId,
    email_account_id: accountId,
    priority: idx + 1,
    is_active: true,
  }));

  const { data, error } = await supabase
    .from("campaign_email_accounts")
    .upsert(rows, { onConflict: "campaign_id,email_account_id" })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, accounts: data });
}

// DELETE: Remove an email account from campaign rotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const supabase = await createClient();
  const { email_account_id } = await request.json();

  if (!email_account_id) {
    return NextResponse.json({ error: "email_account_id requis" }, { status: 400 });
  }

  const { error } = await supabase
    .from("campaign_email_accounts")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("email_account_id", email_account_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
