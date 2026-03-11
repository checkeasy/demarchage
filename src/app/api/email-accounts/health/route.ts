import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  // Get user's workspace
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "Pas de workspace" }, { status: 400 });
  }

  // Get all email accounts with their health logs (last 7 days)
  const { data: accounts, error } = await supabase
    .from("email_accounts")
    .select("id, email_address, display_name, provider, health_score, is_active, warmup_enabled, warmup_current_volume, warmup_daily_target, daily_limit, provider_daily_max")
    .eq("workspace_id", profile.current_workspace_id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get health logs for last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const accountIds = (accounts || []).map((a) => a.id);

  let healthLogs: Record<string, unknown>[] = [];
  if (accountIds.length > 0) {
    const { data: logs } = await supabase
      .from("account_health_logs")
      .select("*")
      .in("email_account_id", accountIds)
      .gte("log_date", sevenDaysAgo)
      .order("log_date", { ascending: true });
    healthLogs = logs || [];
  }

  // Group logs by account
  const logsByAccount: Record<string, Record<string, unknown>[]> = {};
  for (const log of healthLogs) {
    const accId = log.email_account_id as string;
    if (!logsByAccount[accId]) logsByAccount[accId] = [];
    logsByAccount[accId].push(log);
  }

  const result = (accounts || []).map((acc) => ({
    ...acc,
    health_logs: logsByAccount[acc.id] || [],
  }));

  return NextResponse.json({ accounts: result });
}
