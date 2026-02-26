import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Eye,
  MousePointerClick,
  Reply,
  AlertTriangle,
  Plus,
  Users,
  Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
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

  // Fetch aggregate stats from campaigns in this workspace
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("total_sent, total_opened, total_clicked, total_replied, total_bounced, total_prospects, status")
    .eq("workspace_id", workspaceId || "");

  const totals = (campaigns || []).reduce(
    (acc, c) => ({
      sent: acc.sent + (c.total_sent || 0),
      opened: acc.opened + (c.total_opened || 0),
      clicked: acc.clicked + (c.total_clicked || 0),
      replied: acc.replied + (c.total_replied || 0),
      bounced: acc.bounced + (c.total_bounced || 0),
      prospects: acc.prospects + (c.total_prospects || 0),
    }),
    { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, prospects: 0 }
  );

  const rate = (num: number, den: number) =>
    den > 0 ? `${Math.round((num / den) * 100)}%` : "0%";

  const activeCampaigns = (campaigns || []).filter(
    (c) => c.status === "active"
  ).length;
  const hasCampaigns = (campaigns || []).length > 0;

  const stats = [
    {
      label: "Emails envoyes",
      value: totals.sent.toString(),
      icon: Mail,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Taux d'ouverture",
      value: rate(totals.opened, totals.sent),
      icon: Eye,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Taux de clic",
      value: rate(totals.clicked, totals.sent),
      icon: MousePointerClick,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Taux de reponse",
      value: rate(totals.replied, totals.sent),
      icon: Reply,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      label: "Taux de bounce",
      value: rate(totals.bounced, totals.sent),
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Tableau de bord</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d&apos;ensemble de vos campagnes de prospection
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-lg ${stat.bgColor}`}
                  >
                    <Icon className={`size-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50">
                <Send className="size-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(campaigns || []).length}</p>
                <p className="text-xs text-muted-foreground">Campagnes totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50">
                <Send className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
                <p className="text-xs text-muted-foreground">Campagnes actives</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-50">
                <Users className="size-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.prospects}</p>
                <p className="text-xs text-muted-foreground">Prospects en campagne</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {!hasCampaigns && (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-2">
              <Mail className="size-8 text-slate-400" />
            </div>
            <CardTitle>Aucune campagne</CardTitle>
            <CardDescription>
              Creez votre premiere campagne pour commencer a prospecter et suivre
              vos resultats ici.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button asChild>
              <Link href="/campaigns/new">
                <Plus className="size-4" />
                Creer une campagne
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
