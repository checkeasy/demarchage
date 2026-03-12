export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MissionsPageClient } from "./MissionsPageClient";

export default async function MissionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;
  if (!workspaceId) redirect("/onboarding");

  // Fetch missions with campaign stats
  const { data: missions } = await supabase
    .from("outreach_missions")
    .select(`
      *,
      campaign_email:campaigns!outreach_missions_campaign_email_id_fkey(total_sent, total_replied, total_opened),
      campaign_linkedin:campaigns!outreach_missions_campaign_linkedin_id_fkey(total_sent, total_replied),
      campaign_multi:campaigns!outreach_missions_campaign_multichannel_id_fkey(total_sent, total_replied)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  // Compute aggregate stats
  const missionsWithStats = (missions || []).map((m: any) => {
    const emailStats = m.campaign_email || { total_sent: 0, total_replied: 0, total_opened: 0 };
    const linkedinStats = m.campaign_linkedin || { total_sent: 0, total_replied: 0 };
    const multiStats = m.campaign_multi || { total_sent: 0, total_replied: 0 };

    return {
      id: m.id,
      name: m.name,
      description: m.description,
      original_prompt: m.original_prompt,
      search_keywords: m.search_keywords || [],
      target_profile: m.target_profile || {},
      language: m.language,
      status: m.status,
      total_prospects: m.total_prospects,
      total_enrolled: m.total_enrolled,
      total_sent: (emailStats.total_sent || 0) + (linkedinStats.total_sent || 0) + (multiStats.total_sent || 0),
      total_replied: (emailStats.total_replied || 0) + (linkedinStats.total_replied || 0) + (multiStats.total_replied || 0),
      created_at: m.created_at,
      campaign_email_id: m.campaign_email_id || null,
      campaign_linkedin_id: m.campaign_linkedin_id || null,
      campaign_multichannel_id: m.campaign_multichannel_id || null,
    };
  });

  return <MissionsPageClient missions={missionsWithStats} />;
}
