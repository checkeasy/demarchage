import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SentEmailsClient } from "@/components/emails/SentEmailsClient";

export default async function EmailsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;

  if (!workspaceId) {
    redirect("/onboarding");
  }

  // Fetch sent emails with prospect and campaign info
  // emails_sent -> campaign_prospects -> prospects + campaigns
  const { data: emails } = await supabase
    .from("emails_sent")
    .select(`
      *,
      campaign_prospects!inner (
        prospect_id,
        campaign_id,
        prospects (
          first_name,
          last_name,
          email,
          company
        ),
        campaigns (
          name
        )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  // Flatten the data for the client component
  const flatEmails = (emails ?? []).map((e: Record<string, unknown>) => {
    const cp = e.campaign_prospects as Record<string, unknown> | null;
    const prospect = cp?.prospects as Record<string, unknown> | null;
    const campaign = cp?.campaigns as Record<string, unknown> | null;

    return {
      id: e.id as string,
      from_email: e.from_email as string,
      to_email: e.to_email as string,
      subject: e.subject as string | null,
      body_html: e.body_html as string | null,
      status: e.status as string,
      sent_at: e.sent_at as string | null,
      delivered_at: e.delivered_at as string | null,
      opened_at: e.opened_at as string | null,
      clicked_at: e.clicked_at as string | null,
      replied_at: e.replied_at as string | null,
      bounced_at: e.bounced_at as string | null,
      error_message: e.error_message as string | null,
      created_at: e.created_at as string,
      prospect_name: prospect
        ? `${prospect.first_name || ""} ${prospect.last_name || ""}`.trim()
        : null,
      prospect_company: (prospect?.company as string) || null,
      campaign_id: (cp?.campaign_id as string) || null,
      campaign_name: (campaign?.name as string) || null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Emails envoyes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Historique de tous les emails envoyes depuis vos campagnes
        </p>
      </div>

      <SentEmailsClient emails={flatEmails} />
    </div>
  );
}
