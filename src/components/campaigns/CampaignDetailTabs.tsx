"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SequenceEditor, type StepData } from "./SequenceEditor";
import { STEP_TYPES } from "@/lib/constants";
import {
  Eye,
  Layers,
  Users,
  BarChart3,
  Mail,
  Clock,
  UserPlus,
  MessageSquare,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import type { Campaign, SequenceStep } from "@/lib/types/database";

interface ProspectInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  organization: string | null;
  nb_properties: number | null;
  lead_score: number | null;
  status: string;
}

interface CampaignProspect {
  id: string;
  prospect_id: string;
  status: string;
  current_step_id: string | null;
  next_send_at: string | null;
  enrolled_at: string | null;
  completed_at: string | null;
  // Supabase returns joined data as array or object depending on relation
  prospect: ProspectInfo | ProspectInfo[] | null;
}

interface CampaignDetailTabsProps {
  campaign: Campaign;
  steps: SequenceStep[];
  campaignProspects: CampaignProspect[];
}

const PROSPECT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "bg-green-100 text-green-700" },
  paused: { label: "En pause", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Termine", color: "bg-blue-100 text-blue-700" },
  bounced: { label: "Bounce", color: "bg-red-100 text-red-700" },
  replied: { label: "Repondu", color: "bg-purple-100 text-purple-700" },
  unsubscribed: { label: "Desabonne", color: "bg-slate-100 text-slate-700" },
};

const ITEMS_PER_PAGE = 25;

export function CampaignDetailTabs({
  campaign,
  steps,
  campaignProspects,
}: CampaignDetailTabsProps) {
  // Convert DB sequence steps to StepData for the SequenceEditor
  const editorSteps: StepData[] = (steps as (typeof steps[number] & Record<string, unknown>)[]).map((s) => ({
    id: s.id,
    step_order: s.step_order,
    step_type: s.step_type as StepData["step_type"],
    delay_days: s.delay_days,
    delay_hours: s.delay_hours,
    subject: s.subject,
    body_html: s.body_html,
    body_text: s.body_text,
    linkedin_message: s.linkedin_message,
    whatsapp_message: (s.whatsapp_message as string) ?? null,
    ab_enabled: s.ab_enabled,
  }));

  const progress =
    campaign.total_prospects > 0
      ? Math.round((campaign.total_sent / campaign.total_prospects) * 100)
      : 0;

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">
          <Eye className="size-3.5 mr-1.5" />
          Apercu
        </TabsTrigger>
        <TabsTrigger value="sequence">
          <Layers className="size-3.5 mr-1.5" />
          Sequence
        </TabsTrigger>
        <TabsTrigger value="prospects">
          <Users className="size-3.5 mr-1.5" />
          Prospects
        </TabsTrigger>
        <TabsTrigger value="analytics">
          <BarChart3 className="size-3.5 mr-1.5" />
          Analytique
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="mt-4 space-y-4">
        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Prospects traites
                </span>
                <span className="font-medium">
                  {campaign.total_sent} / {campaign.total_prospects}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progress}% termine</p>
            </div>
          </CardContent>
        </Card>

        {/* Campaign details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Fuseau horaire</span>
                <p className="font-medium">{campaign.timezone}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fenetre d&apos;envoi</span>
                <p className="font-medium">
                  {campaign.sending_window_start} - {campaign.sending_window_end}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Limite journaliere</span>
                <p className="font-medium">
                  {campaign.daily_limit ?? "Non definie"} emails/jour
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Suivi des ouvertures</span>
                <p className="font-medium">
                  {campaign.track_opens ? "Active" : "Desactive"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Arret sur reponse</span>
                <p className="font-medium">
                  {campaign.stop_on_reply ? "Oui" : "Non"}
                </p>
              </div>
              {campaign.launched_at && (
                <div>
                  <span className="text-muted-foreground">Lancee le</span>
                  <p className="font-medium">
                    {new Date(campaign.launched_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sequence overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Sequence ({steps.length} etape{steps.length > 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune etape configuree.
              </p>
            ) : (
              <div className="space-y-2">
                {steps.map((step, idx) => {
                  const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
                    email: Mail,
                    delay: Clock,
                    linkedin_connect: UserPlus,
                    linkedin_message: MessageSquare,
                    condition: Clock,
                  };
                  const Icon = ICONS[step.step_type] ?? Clock;
                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50"
                    >
                      <span className="flex items-center justify-center size-6 rounded-full bg-slate-200 text-xs font-medium">
                        {idx + 1}
                      </span>
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {STEP_TYPES[step.step_type]?.label}
                      </span>
                      {step.step_type === "email" && step.subject && (
                        <span className="text-sm text-muted-foreground truncate">
                          {step.subject}
                        </span>
                      )}
                      {step.step_type === "delay" && (
                        <span className="text-sm text-muted-foreground">
                          {step.delay_days}j {step.delay_hours}h
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Sequence Tab - Read-only view */}
      <TabsContent value="sequence" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sequence de la campagne</CardTitle>
            <CardDescription>
              Vue en lecture seule de la sequence configuree.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SequenceEditor
              steps={editorSteps}
              onChange={() => {}}
              readOnly
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Prospects Tab */}
      <TabsContent value="prospects" className="mt-4">
        <CampaignProspectsTab
          campaignId={campaign.id}
          campaignProspects={campaignProspects}
          steps={steps}
          totalCount={campaign.total_prospects}
        />
      </TabsContent>

      {/* Analytics Tab */}
      <TabsContent value="analytics" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analytique</CardTitle>
            <CardDescription>
              Statistiques detaillees de la campagne.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Les graphiques et statistiques detaillees seront disponibles
              prochainement.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// --- Campaign Prospects Tab ---
function CampaignProspectsTab({
  campaignId,
  campaignProspects,
  steps,
  totalCount,
}: {
  campaignId: string;
  campaignProspects: CampaignProspect[];
  steps: SequenceStep[];
  totalCount: number;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ analyzed: number; total: number } | null>(null);

  // Build step lookup
  const stepMap = useMemo(() => {
    const map: Record<string, { order: number; type: string; subject: string | null }> = {};
    for (const s of steps) {
      map[s.id] = { order: s.step_order, type: s.step_type, subject: s.subject };
    }
    return map;
  }, [steps]);

  function getProspect(cp: CampaignProspect): ProspectInfo | null {
    if (!cp.prospect) return null;
    if (Array.isArray(cp.prospect)) return cp.prospect[0] || null;
    return cp.prospect;
  }

  // Filter prospects
  const filtered = useMemo(() => {
    return campaignProspects.filter((cp) => {
      const p = getProspect(cp);
      if (!p) return false;

      // Status filter
      if (statusFilter !== "all" && cp.status !== statusFilter) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ").toLowerCase();
        const company = (p.organization || p.company || "").toLowerCase();
        if (!name.includes(q) && !p.email.toLowerCase().includes(q) && !company.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [campaignProspects, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cp of campaignProspects) {
      counts[cp.status] = (counts[cp.status] || 0) + 1;
    }
    return counts;
  }, [campaignProspects]);

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getCurrentStep(stepId: string | null) {
    if (!stepId) return null;
    return stepMap[stepId] || null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Prospects inscrits</CardTitle>
            <CardDescription>
              {totalCount} prospect{totalCount > 1 ? "s" : ""} dans cette campagne
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={statusFilter === "all" ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => { setStatusFilter("all"); setPage(1); }}
            >
              Tous ({campaignProspects.length})
            </Badge>
            {Object.entries(statusCounts).map(([status, count]) => {
              const cfg = PROSPECT_STATUS_MAP[status];
              return (
                <Badge
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  className={`cursor-pointer text-xs ${statusFilter !== status && cfg ? cfg.color : ""}`}
                  onClick={() => { setStatusFilter(statusFilter === status ? "all" : status); setPage(1); }}
                >
                  {cfg?.label || status} ({count})
                </Badge>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un prospect..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 h-9"
            />
          </div>
          {campaignProspects.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 shrink-0"
              disabled={aiAnalyzing}
              onClick={async () => {
                setAiAnalyzing(true);
                setAiProgress({ analyzed: 0, total: campaignProspects.length });
                try {
                  const res = await fetch("/api/agents/research/batch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ campaignId, skipAlreadyAnalyzed: true }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Erreur");

                  setAiProgress({ analyzed: data.analyzed, total: data.total });

                  if (data.analyzed > 0) {
                    toast.success(
                      `${data.analyzed} prospect${data.analyzed > 1 ? "s" : ""} analyse${data.analyzed > 1 ? "s" : ""} par l'IA` +
                      (data.skipped > 0 ? ` (${data.skipped} deja analyses)` : "")
                    );
                  } else if (data.skipped > 0) {
                    toast.info(`Tous les prospects ont deja ete analyses (${data.skipped})`);
                  }

                  if (data.errors?.length > 0) {
                    toast.error(`${data.errors.length} erreur${data.errors.length > 1 ? "s" : ""} pendant l'analyse`);
                  }
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Erreur lors de l'analyse");
                } finally {
                  setAiAnalyzing(false);
                }
              }}
            >
              {aiAnalyzing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : aiProgress && aiProgress.analyzed > 0 ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {aiAnalyzing
                ? "Analyse en cours..."
                : aiProgress && aiProgress.analyzed > 0
                  ? `${aiProgress.analyzed} analyses`
                  : "Analyser les prospects (IA)"
              }
            </Button>
          )}
        </div>

        {campaignProspects.length === 0 ? (
          <div className="text-center py-12">
            <Users className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucun prospect inscrit dans cette campagne.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Inscrivez des prospects depuis la page Prospects.
            </p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
                    <TableHead className="hidden sm:table-cell">Entreprise</TableHead>
                    <TableHead className="hidden md:table-cell">Score IA</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Etape actuelle</TableHead>
                    <TableHead className="hidden lg:table-cell">Prochain envoi</TableHead>
                    <TableHead className="hidden lg:table-cell">Inscrit le</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        Aucun prospect ne correspond a votre recherche.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((cp) => {
                      const p = getProspect(cp);
                      if (!p) return null;
                      const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;
                      const company = p.organization || p.company;
                      const statusCfg = PROSPECT_STATUS_MAP[cp.status];
                      const currentStep = getCurrentStep(cp.current_step_id);

                      return (
                        <TableRow key={cp.id}>
                          <TableCell>
                            <div>
                              <Link href={`/prospects/${p.id}`} className="text-sm font-medium hover:underline">
                                {name}
                              </Link>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            {company || "-"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {p.lead_score !== null && p.lead_score !== undefined ? (
                              <Badge
                                variant="secondary"
                                className={`text-xs text-white ${
                                  p.lead_score >= 80 ? "bg-green-500" :
                                  p.lead_score >= 60 ? "bg-amber-500" :
                                  p.lead_score >= 40 ? "bg-orange-500" : "bg-red-500"
                                }`}
                              >
                                {p.lead_score}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-xs ${statusCfg?.color || ""}`}>
                              {statusCfg?.label || cp.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {currentStep ? (
                              <span className="flex items-center gap-1.5">
                                <span className="flex items-center justify-center size-5 rounded-full bg-slate-200 text-[10px] font-medium">
                                  {currentStep.order}
                                </span>
                                <span className="text-muted-foreground">
                                  {(STEP_TYPES as Record<string, { label: string }>)[currentStep.type]?.label || currentStep.type}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {cp.status === "completed" ? (
                              <span className="text-green-600">Termine</span>
                            ) : (
                              formatDate(cp.next_send_at)
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {formatDate(cp.enrolled_at)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="size-8 p-0" asChild>
                              <Link href={`/prospects/${p.id}`}>
                                <ExternalLink className="size-3.5" />
                                <span className="sr-only">Voir</span>
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {filtered.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
