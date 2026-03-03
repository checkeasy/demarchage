import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Eye,
  Reply,
  MousePointerClick,
  AlertTriangle,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { CampaignDetailTabs } from "@/components/campaigns/CampaignDetailTabs";
import { CampaignActions } from "@/components/campaigns/CampaignActions";
import type { Campaign, SequenceStep } from "@/lib/types/database";

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({
  params,
}: CampaignDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch campaign
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !campaign) {
    notFound();
  }

  // Fetch sequence steps with their A/B variants
  const { data: stepsData } = await supabase
    .from("sequence_steps")
    .select("*, ab_variants(*)")
    .eq("campaign_id", id)
    .order("step_order", { ascending: true });

  // Fetch campaign prospects with prospect details (admin client bypasses RLS)
  const adminSupabase = createAdminClient();
  const { data: campaignProspects } = await adminSupabase
    .from("campaign_prospects")
    .select(`
      id,
      prospect_id,
      status,
      current_step_id,
      next_send_at,
      enrolled_at,
      completed_at,
      prospect:prospects(id, first_name, last_name, email, company, organization, nb_properties, lead_score, status)
    `)
    .eq("campaign_id", id)
    .order("enrolled_at", { ascending: false })
    .limit(500);

  const typedCampaign = campaign as Campaign;
  const typedSteps = (stepsData ?? []) as SequenceStep[];

  const openRate =
    typedCampaign.total_sent > 0
      ? Math.round(
          (typedCampaign.total_opened / typedCampaign.total_sent) * 100
        )
      : 0;
  const clickRate =
    typedCampaign.total_sent > 0
      ? Math.round(
          (typedCampaign.total_clicked / typedCampaign.total_sent) * 100
        )
      : 0;
  const replyRate =
    typedCampaign.total_sent > 0
      ? Math.round(
          (typedCampaign.total_replied / typedCampaign.total_sent) * 100
        )
      : 0;
  const bounceRate =
    typedCampaign.total_sent > 0
      ? Math.round(
          (typedCampaign.total_bounced / typedCampaign.total_sent) * 100
        )
      : 0;

  const stats = [
    {
      label: "Envoyes",
      value: typedCampaign.total_sent.toString(),
      icon: Mail,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Ouverts",
      value: `${openRate}%`,
      subValue: typedCampaign.total_opened.toString(),
      icon: Eye,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Cliques",
      value: `${clickRate}%`,
      subValue: typedCampaign.total_clicked.toString(),
      icon: MousePointerClick,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Reponses",
      value: `${replyRate}%`,
      subValue: typedCampaign.total_replied.toString(),
      icon: Reply,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      label: "Bounces",
      value: `${bounceRate}%`,
      subValue: typedCampaign.total_bounced.toString(),
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      label: "Prospects",
      value: typedCampaign.total_prospects.toString(),
      icon: Users,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/campaigns">
              <ArrowLeft className="size-4" />
              Retour
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {typedCampaign.name}
              </h2>
              <CampaignStatusBadge status={typedCampaign.status} />
            </div>
            {typedCampaign.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {typedCampaign.description}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <CampaignActions campaignId={id} status={typedCampaign.status} />
      </div>

      {/* Warning: no email account */}
      {!typedCampaign.email_account_id && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <strong>Aucun compte email associe.</strong> Les emails ne seront pas envoyes tant qu&apos;un compte n&apos;est pas configure.{" "}
            <Link href={`/campaigns/${id}/edit`} className="underline font-medium">Modifier la campagne</Link>
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center size-8 rounded-lg ${stat.bgColor}`}
                  >
                    <Icon className={`size-4 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <CampaignDetailTabs campaign={typedCampaign} steps={typedSteps} campaignProspects={campaignProspects ?? []} />
    </div>
  );
}
