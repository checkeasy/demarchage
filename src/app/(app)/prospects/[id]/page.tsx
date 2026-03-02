import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProspectDetail } from "@/components/prospects/ProspectDetail";
import type { TimelineEvent } from "@/components/prospects/ProspectTimeline";

interface ProspectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProspectPage({ params }: ProspectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch prospect by ID
  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !prospect) {
    notFound();
  }

  // Fetch campaign enrollments
  const { data: campaignEnrollments } = await supabase
    .from("campaign_prospects")
    .select("id, campaign_id, status, has_opened, has_clicked, has_replied, enrolled_at, campaigns(id, name, status)")
    .eq("prospect_id", id);

  // Fetch automation enrollments
  const { data: automationEnrollments } = await supabase
    .from("automation_prospects")
    .select("id, sequence_id, status, profile_viewed, connection_sent, connection_accepted, message_sent_count, has_replied, enrolled_at, automation_sequences(id, name, status)")
    .eq("prospect_id", id);

  // Fetch emails sent to this prospect (via campaign_prospects)
  const cpIds = (campaignEnrollments || []).map((e) => e.id);
  let emailEvents: TimelineEvent[] = [];
  if (cpIds.length > 0) {
    const { data: emailsSent } = await supabase
      .from("emails_sent")
      .select("id, subject, status, sent_at, opened_at, clicked_at, replied_at, bounced_at, created_at")
      .in("campaign_prospect_id", cpIds)
      .order("created_at", { ascending: false })
      .limit(50);

    emailEvents = (emailsSent || []).flatMap((email) => {
      const events: TimelineEvent[] = [];
      if (email.sent_at) {
        events.push({
          id: `${email.id}-sent`,
          type: "email_sent",
          channel: "email",
          description: `Email envoye : ${email.subject}`,
          date: email.sent_at,
        });
      }
      if (email.opened_at) {
        events.push({
          id: `${email.id}-opened`,
          type: "email_opened",
          channel: "email",
          description: `Email ouvert : ${email.subject}`,
          date: email.opened_at,
        });
      }
      if (email.clicked_at) {
        events.push({
          id: `${email.id}-clicked`,
          type: "email_clicked",
          channel: "email",
          description: `Lien clique dans : ${email.subject}`,
          date: email.clicked_at,
        });
      }
      if (email.replied_at) {
        events.push({
          id: `${email.id}-replied`,
          type: "email_replied",
          channel: "email",
          description: `Reponse recue pour : ${email.subject}`,
          date: email.replied_at,
        });
      }
      if (email.bounced_at) {
        events.push({
          id: `${email.id}-bounced`,
          type: "email_bounced",
          channel: "email",
          description: `Bounce : ${email.subject}`,
          date: email.bounced_at,
        });
      }
      return events;
    });
  }

  // Fetch LinkedIn automation actions
  const { data: linkedinActions } = await supabase
    .from("automation_actions_log")
    .select("id, action_type, status, message_sent, created_at")
    .eq("prospect_id", id)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(50);

  const linkedinEvents: TimelineEvent[] = (linkedinActions || []).map((action) => {
    const typeMap: Record<string, TimelineEvent["type"]> = {
      view_profile: "linkedin_view",
      connect: "linkedin_connect",
      message: "linkedin_message",
      check_accepted: "linkedin_check",
      email: "linkedin_email",
    };
    const descMap: Record<string, string> = {
      view_profile: "Profil LinkedIn visite",
      connect: "Demande de connexion envoyee",
      message: "Message LinkedIn envoye",
      check_accepted: "Verification de connexion",
      email: "Email envoye (automation)",
    };
    return {
      id: action.id,
      type: typeMap[action.action_type] || "linkedin_view",
      channel: action.action_type === "email" ? "email" as const : "linkedin" as const,
      description: descMap[action.action_type] || action.action_type,
      detail: action.message_sent || undefined,
      date: action.created_at,
    };
  });

  // Fetch CRM activities from prospect_activities table
  const { data: crmActivities } = await supabase
    .from("prospect_activities")
    .select("id, activity_type, channel, subject, body, metadata, created_at")
    .eq("prospect_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  const crmEvents: TimelineEvent[] = (crmActivities || []).map((activity) => {
    return {
      id: `pa-${activity.id}`,
      type: activity.activity_type as TimelineEvent["type"],
      channel: (activity.channel || "manual") as TimelineEvent["channel"],
      description: activity.subject || activity.activity_type,
      detail: activity.body || undefined,
      date: activity.created_at,
    };
  });

  // Merge and sort all events chronologically (newest first)
  // Deduplicate by checking for similar events at the same time
  const allEvents = [...emailEvents, ...linkedinEvents, ...crmEvents].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Build campaign data for the component
  const campaigns = (campaignEnrollments || [])
    .filter((e) => e.campaigns)
    .map((e) => {
      const c = e.campaigns as unknown as { id: string; name: string; status: string };
      return {
        id: c.id,
        name: c.name,
        campaignStatus: c.status,
        enrollmentStatus: e.status,
        hasOpened: e.has_opened,
        hasClicked: e.has_clicked,
        hasReplied: e.has_replied,
        enrolledAt: e.enrolled_at,
      };
    });

  const automations = (automationEnrollments || [])
    .filter((e) => e.automation_sequences)
    .map((e) => {
      const s = e.automation_sequences as unknown as { id: string; name: string; status: string };
      return {
        id: s.id,
        name: s.name,
        sequenceStatus: s.status,
        enrollmentStatus: e.status,
        profileViewed: e.profile_viewed,
        connectionSent: e.connection_sent,
        connectionAccepted: e.connection_accepted,
        messageSentCount: e.message_sent_count,
        hasReplied: e.has_replied,
        enrolledAt: e.enrolled_at,
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/prospects">
            <ArrowLeft className="size-4" />
            Retour aux prospects
          </Link>
        </Button>
      </div>

      <ProspectDetail
        prospect={prospect}
        campaigns={campaigns}
        automations={automations}
        timelineEvents={allEvents}
      />
    </div>
  );
}
