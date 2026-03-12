import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAuthAndWorkspace() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('current_workspace_id').eq('id', user.id).single();
  if (!profile?.current_workspace_id) return { error: NextResponse.json({ error: "No workspace" }, { status: 403 }) };

  return { user, workspaceId: profile.current_workspace_id, adminClient };
}

async function verifyCampaignOwnership(adminClient: ReturnType<typeof createAdminClient>, campaignId: string, workspaceId: string) {
  const { data: campaign, error } = await adminClient
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .single();
  return { campaign, error };
}

// GET: List email accounts assigned to a campaign (for rotation)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  const auth = await getAuthAndWorkspace();
  if ('error' in auth && auth.error) return auth.error;
  const { workspaceId, adminClient } = auth as { workspaceId: string; adminClient: ReturnType<typeof createAdminClient>; user: { id: string } };

  const { campaign } = await verifyCampaignOwnership(adminClient, campaignId, workspaceId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data, error } = await adminClient
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

  const auth = await getAuthAndWorkspace();
  if ('error' in auth && auth.error) return auth.error;
  const { workspaceId, adminClient } = auth as { workspaceId: string; adminClient: ReturnType<typeof createAdminClient>; user: { id: string } };

  const { campaign } = await verifyCampaignOwnership(adminClient, campaignId, workspaceId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const body = await request.json();
  const { email_account_ids } = body as { email_account_ids: string[] };

  if (!Array.isArray(email_account_ids) || email_account_ids.length === 0) {
    return NextResponse.json({ error: "email_account_ids requis" }, { status: 400 });
  }

  // Verify that all email accounts belong to the user's workspace
  const { data: validAccounts } = await adminClient
    .from("email_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", email_account_ids);

  const validIds = new Set((validAccounts || []).map((a) => a.id));
  const invalidIds = email_account_ids.filter((id) => !validIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json({ error: "Some email accounts do not belong to your workspace" }, { status: 403 });
  }

  // Insert with upsert to avoid duplicates
  const rows = email_account_ids.map((accountId, idx) => ({
    campaign_id: campaignId,
    email_account_id: accountId,
    priority: idx + 1,
    is_active: true,
  }));

  const { data, error } = await adminClient
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

  const auth = await getAuthAndWorkspace();
  if ('error' in auth && auth.error) return auth.error;
  const { workspaceId, adminClient } = auth as { workspaceId: string; adminClient: ReturnType<typeof createAdminClient>; user: { id: string } };

  const { campaign } = await verifyCampaignOwnership(adminClient, campaignId, workspaceId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { email_account_id } = await request.json();

  if (!email_account_id) {
    return NextResponse.json({ error: "email_account_id requis" }, { status: 400 });
  }

  const { error } = await adminClient
    .from("campaign_email_accounts")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("email_account_id", email_account_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
