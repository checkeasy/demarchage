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
  Trophy,
  Clock,
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
import { Badge } from "@/components/ui/badge";
import { PipelineValueCard } from "@/components/dashboard/PipelineValueCard";
import { DealsWonLostChart } from "@/components/dashboard/DealsWonLostChart";
import { ActivitySummaryCard } from "@/components/dashboard/ActivitySummaryCard";

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

  // --- Pipeline stats ---
  const { data: openDeals } = await supabase
    .from("deals")
    .select("value")
    .eq("workspace_id", workspaceId || "")
    .eq("status", "open");

  const pipelineValue = (openDeals || []).reduce(
    (sum, d) => sum + (d.value || 0),
    0
  );
  const openDealsCount = (openDeals || []).length;

  // --- Won deals this month ---
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: wonThisMonth } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId || "")
    .eq("status", "won")
    .gte("won_at", monthStart.toISOString());

  // --- Overdue activities ---
  const now = new Date();
  const { count: overdueCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId || "")
    .eq("is_done", false)
    .lt("due_date", now.toISOString());

  // --- Due today activities ---
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { count: dueTodayCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId || "")
    .eq("is_done", false)
    .gte("due_date", todayStart.toISOString())
    .lte("due_date", todayEnd.toISOString());

  // --- Completed this week ---
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);

  const { count: completedThisWeek } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId || "")
    .eq("is_done", true)
    .gte("updated_at", weekStart.toISOString());

  // --- Deals won/lost by month for chart ---
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const { data: wonDeals } = await supabase
    .from("deals")
    .select("won_at")
    .eq("workspace_id", workspaceId || "")
    .eq("status", "won")
    .gte("won_at", sixMonthsAgo.toISOString());

  const { data: lostDeals } = await supabase
    .from("deals")
    .select("lost_at")
    .eq("workspace_id", workspaceId || "")
    .eq("status", "lost")
    .gte("lost_at", sixMonthsAgo.toISOString());

  const monthNames = [
    "Jan", "Fev", "Mar", "Avr", "Mai", "Jun",
    "Jul", "Aou", "Sep", "Oct", "Nov", "Dec",
  ];

  // Build chart data for the last 6 months
  const chartData: { month: string; won: number; lost: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthIndex = d.getMonth();
    const year = d.getFullYear();

    const wonCount = (wonDeals || []).filter((deal) => {
      if (!deal.won_at) return false;
      const dt = new Date(deal.won_at);
      return dt.getMonth() === monthIndex && dt.getFullYear() === year;
    }).length;

    const lostCount = (lostDeals || []).filter((deal) => {
      if (!deal.lost_at) return false;
      const dt = new Date(deal.lost_at);
      return dt.getMonth() === monthIndex && dt.getFullYear() === year;
    }).length;

    chartData.push({
      month: monthNames[monthIndex],
      won: wonCount,
      lost: lostCount,
    });
  }

  // --- Recent deals ---
  const { data: recentDeals } = await supabase
    .from("deals")
    .select(
      "id, title, value, status, created_at, prospects(first_name, last_name), pipeline_stages_config(name, color)"
    )
    .eq("workspace_id", workspaceId || "")
    .order("created_at", { ascending: false })
    .limit(5);

  // --- Campaign stats (existing) ---
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "total_sent, total_opened, total_clicked, total_replied, total_bounced, total_prospects, status"
    )
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

  const emailStats = [
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

  // --- Helper: format currency ---
  const formatEUR = (v: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  // --- Helper: status badge ---
  const statusConfig: Record<string, { label: string; className: string }> = {
    open: { label: "En cours", className: "bg-blue-100 text-blue-700" },
    won: { label: "Gagne", className: "bg-green-100 text-green-700" },
    lost: { label: "Perdu", className: "bg-red-100 text-red-700" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Tableau de bord</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d&apos;ensemble de votre CRM et de vos campagnes
        </p>
      </div>

      {/* Section 1: KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PipelineValueCard value={pipelineValue} dealsCount={openDealsCount} />
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Deals gagnes ce mois
                </p>
                <p className="text-2xl font-bold">{wonThisMonth ?? 0}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-50">
                <Trophy className="size-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Activites en retard
                </p>
                <p className="text-2xl font-bold">{overdueCount ?? 0}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50">
                <Clock className="size-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Taux de reponse
                </p>
                <p className="text-2xl font-bold">
                  {rate(totals.replied, totals.sent)}
                </p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50">
                <Reply className="size-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Chart + Activity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <DealsWonLostChart data={chartData} />
        </div>
        <div className="md:col-span-1">
          <ActivitySummaryCard
            overdue={overdueCount ?? 0}
            dueToday={dueTodayCount ?? 0}
            completedThisWeek={completedThisWeek ?? 0}
          />
        </div>
      </div>

      {/* Section 3: Email Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {emailStats.map((stat) => {
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

      {/* Section 4: Recent Deals + Campaign Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recent Deals Table */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Deals recents</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/deals">Voir tout</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(recentDeals || []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">
                        Titre
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground">
                        Valeur
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground">
                        Etape
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground">
                        Prospect
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(recentDeals || []).map((deal) => {
                      const prospectRaw = deal.prospects as unknown;
                      const prospect = Array.isArray(prospectRaw)
                        ? (prospectRaw[0] as { first_name: string; last_name: string } | undefined) ?? null
                        : (prospectRaw as { first_name: string; last_name: string } | null);
                      const stageRaw = deal.pipeline_stages_config as unknown;
                      const stage = Array.isArray(stageRaw)
                        ? (stageRaw[0] as { name: string; color: string } | undefined) ?? null
                        : (stageRaw as { name: string; color: string } | null);
                      const status = statusConfig[deal.status] || {
                        label: deal.status,
                        className: "bg-slate-100 text-slate-700",
                      };

                      return (
                        <tr key={deal.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5">
                            <Link
                              href={`/deals/${deal.id}`}
                              className="font-medium text-slate-900 hover:text-blue-600"
                            >
                              {deal.title}
                            </Link>
                          </td>
                          <td className="py-2.5 text-slate-700">
                            {formatEUR(deal.value || 0)}
                          </td>
                          <td className="py-2.5">
                            {stage ? (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{
                                  borderColor: stage.color,
                                  color: stage.color,
                                }}
                              >
                                {stage.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-700">
                            {prospect
                              ? `${prospect.first_name || ""} ${prospect.last_name || ""}`.trim() ||
                                "-"
                              : "-"}
                          </td>
                          <td className="py-2.5">
                            <Badge
                              className={`text-xs ${status.className}`}
                              variant="secondary"
                            >
                              {status.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun deal pour le moment
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/deals">
                    <Plus className="size-4 mr-1" />
                    Creer un deal
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign Summary Cards */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50">
                  <Send className="size-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {(campaigns || []).length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Campagnes totales
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    Campagnes actives
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    Prospects en campagne
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Empty State for campaigns */}
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
