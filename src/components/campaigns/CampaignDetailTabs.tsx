"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";
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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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
  email_validity_score: number | null;
}

interface CampaignProspect {
  id: string;
  prospect_id: string;
  status: string;
  status_reason: string | null;
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
  error: { label: "Email invalide", color: "bg-red-100 text-red-700" },
};

const ITEMS_PER_PAGE = 25;

export function CampaignDetailTabs({
  campaign,
  steps,
  campaignProspects,
}: CampaignDetailTabsProps) {
  const router = useRouter();
  const supabase = createClient();

  // Convert DB sequence steps to StepData for the SequenceEditor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialEditorSteps: StepData[] = (steps as any[]).map((s) => ({
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
    ab_variants: s.ab_variants || undefined,
    use_ai_generation: s.use_ai_generation ?? false,
    ai_prompt_context: s.ai_prompt_context ?? null,
  }));

  const [editableSteps, setEditableSteps] = useState<StepData[]>(initialEditorSteps);
  const [savingSequence, setSavingSequence] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef<StepData[] | null>(null);

  // Auto-save to DB when steps change (debounced 2s, no concurrent saves)
  const saveToDb = useCallback(async (stepsToSave: StepData[]) => {
    // If already saving, queue this save for after
    if (savingRef.current) {
      pendingSaveRef.current = stepsToSave;
      return;
    }

    savingRef.current = true;
    setSavingSequence(true);
    try {
      // Use server-side API to handle FK cleanup + reassignment
      const res = await fetch(`/api/campaigns/${campaign.id}/steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: stepsToSave.map((s) => ({
            step_order: s.step_order,
            step_type: s.step_type,
            delay_days: s.delay_days,
            delay_hours: s.delay_hours,
            subject: s.subject,
            body_html: s.body_html,
            body_text: s.body_text,
            linkedin_message: s.linkedin_message,
            whatsapp_message: s.whatsapp_message,
            ab_enabled: s.ab_enabled,
            ab_variants: s.ab_variants,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");

      toast.success("Sequence sauvegardee");
    } catch (error) {
      console.error("Error saving sequence:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      savingRef.current = false;
      setSavingSequence(false);

      // If a save was queued while we were saving, run it now
      if (pendingSaveRef.current) {
        const queued = pendingSaveRef.current;
        pendingSaveRef.current = null;
        saveToDb(queued);
      }
    }
  }, [campaign.id, supabase]);

  const handleStepsChange = useCallback((newSteps: StepData[]) => {
    setEditableSteps(newSteps);
    // Debounce auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveToDb(newSteps);
    }, 2000);
  }, [saveToDb]);

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
              Sequence ({editableSteps.length} etape{editableSteps.length > 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editableSteps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune etape configuree.
              </p>
            ) : (
              <div className="space-y-2">
                {editableSteps.map((step, idx) => {
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

      {/* Sequence Tab - Editable */}
      <TabsContent value="sequence" className="mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Sequence de la campagne</CardTitle>
                <CardDescription>
                  Cliquez sur une etape pour la modifier. Glissez pour reordonner.
                </CardDescription>
              </div>
              {savingSequence && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Sauvegarde...
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <SequenceEditor
              steps={editableSteps}
              onChange={handleStepsChange}
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
        <CampaignAnalyticsTab campaignId={campaign.id} />
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

  type SortColumn = "prospect" | "company" | "email_score" | "lead_score" | "status" | "step" | "next_send" | "enrolled";
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
    setPage(1);
  };

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
        if (!name.includes(q) && !(p.email || "").toLowerCase().includes(q) && !company.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [campaignProspects, search, statusFilter]);

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const pa = getProspect(a);
      const pb = getProspect(b);
      if (!pa || !pb) return 0;

      switch (sortColumn) {
        case "prospect": {
          const na = [pa.first_name, pa.last_name].filter(Boolean).join(" ").toLowerCase();
          const nb = [pb.first_name, pb.last_name].filter(Boolean).join(" ").toLowerCase();
          return na.localeCompare(nb) * dir;
        }
        case "company": {
          const ca = (pa.organization || pa.company || "").toLowerCase();
          const cb = (pb.organization || pb.company || "").toLowerCase();
          return ca.localeCompare(cb) * dir;
        }
        case "email_score":
          return ((pa.email_validity_score ?? -1) - (pb.email_validity_score ?? -1)) * dir;
        case "lead_score":
          return ((pa.lead_score ?? -1) - (pb.lead_score ?? -1)) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "step": {
          const sa = a.current_step_id ? stepMap[a.current_step_id]?.order ?? 0 : 0;
          const sb = b.current_step_id ? stepMap[b.current_step_id]?.order ?? 0 : 0;
          return (sa - sb) * dir;
        }
        case "next_send":
          return ((a.next_send_at || "").localeCompare(b.next_send_at || "")) * dir;
        case "enrolled":
          return ((a.enrolled_at || "").localeCompare(b.enrolled_at || "")) * dir;
        default:
          return 0;
      }
    });
  }, [filtered, sortColumn, sortDir, stepMap]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
            <div className="relative border rounded-lg">
              <p className="text-xs text-muted-foreground px-4 py-1 sm:hidden">
                Glissez pour voir plus de colonnes
              </p>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {([
                      { key: "prospect", label: "Prospect", className: "" },
                      { key: "company", label: "Entreprise", className: "hidden sm:table-cell" },
                      { key: "email_score", label: "Fiabilite email", className: "hidden md:table-cell" },
                      { key: "lead_score", label: "Score IA", className: "hidden md:table-cell" },
                      { key: "status", label: "Statut", className: "" },
                      { key: "step", label: "Etape actuelle", className: "hidden md:table-cell" },
                      { key: "next_send", label: "Prochain envoi", className: "hidden lg:table-cell" },
                      { key: "enrolled", label: "Inscrit le", className: "hidden lg:table-cell" },
                    ] as { key: SortColumn; label: string; className: string }[]).map((col) => {
                      const SortIcon = sortColumn === col.key
                        ? (sortDir === "asc" ? ArrowUp : ArrowDown)
                        : ArrowUpDown;
                      return (
                        <TableHead
                          key={col.key}
                          className={`${col.className} cursor-pointer select-none hover:bg-muted/50`}
                          onClick={() => toggleSort(col.key)}
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            <SortIcon className={`size-3 ${sortColumn === col.key ? "text-foreground" : "text-muted-foreground/50"}`} />
                          </span>
                        </TableHead>
                      );
                    })}
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
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
                            {p.email_validity_score !== null && p.email_validity_score !== undefined ? (
                              <Badge
                                variant="secondary"
                                className={`text-xs text-white ${
                                  p.email_validity_score >= 70 ? "bg-green-500" :
                                  p.email_validity_score >= 40 ? "bg-yellow-500" :
                                  p.email_validity_score > 0 ? "bg-orange-500" : "bg-red-500"
                                }`}
                              >
                                {p.email_validity_score}%
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Non verifie</span>
                            )}
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
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="secondary" className={`text-xs ${statusCfg?.color || ""}`}>
                                {statusCfg?.label || cp.status}
                              </Badge>
                              {cp.status_reason && (
                                <span className="text-[10px] text-red-500 leading-tight">
                                  {cp.status_reason}
                                </span>
                              )}
                            </div>
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
                            <Button variant="ghost" size="sm" className="size-8 p-0" asChild aria-label="Ouvrir">
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
            </div>

            {/* Pagination */}
            {sorted.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, sorted.length)} sur {sorted.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Precedent"
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
                    aria-label="Suivant"
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

// --- Campaign Analytics Tab ---
interface StepAnalytics {
  id: string;
  step_order: number;
  step_type: string;
  subject: string | null;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_bounced: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

interface DailyMetric {
  date: string;
  sends: number;
  opens: number;
  replies: number;
}

function CampaignAnalyticsTab({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(true);
  const [analyticsSteps, setAnalyticsSteps] = useState<StepAnalytics[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const [stepsRes, dailyRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}/analytics`),
          fetch(`/api/campaigns/${campaignId}/analytics/daily`),
        ]);
        const stepsData = await stepsRes.json();
        const dailyData = await dailyRes.json();
        if (!stepsRes.ok) throw new Error(stepsData.error || "Erreur");
        setAnalyticsSteps(stepsData.steps || []);
        if (dailyRes.ok) {
          setDailyMetrics(dailyData.daily || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [campaignId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-red-500">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (analyticsSteps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analytique</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune etape de type email dans cette campagne.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Totals
  const totals = analyticsSteps.reduce(
    (acc, s) => ({
      sent: acc.sent + s.total_sent,
      opened: acc.opened + s.total_opened,
      clicked: acc.clicked + s.total_clicked,
      replied: acc.replied + s.total_replied,
      bounced: acc.bounced + s.total_bounced,
    }),
    { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Envoyes", value: totals.sent, color: "text-blue-600" },
          { label: "Ouverts", value: totals.opened, pct: totals.sent > 0 ? Math.round((totals.opened / totals.sent) * 100) : 0, color: "text-green-600" },
          { label: "Cliques", value: totals.clicked, pct: totals.sent > 0 ? Math.round((totals.clicked / totals.sent) * 100) : 0, color: "text-purple-600" },
          { label: "Reponses", value: totals.replied, pct: totals.sent > 0 ? Math.round((totals.replied / totals.sent) * 100) : 0, color: "text-amber-600" },
          { label: "Bounces", value: totals.bounced, pct: totals.sent > 0 ? Math.round((totals.bounced / totals.sent) * 100) : 0, color: "text-red-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              {stat.pct !== undefined && (
                <p className="text-xs text-muted-foreground">{stat.pct}%</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily metrics chart */}
      {dailyMetrics.length > 0 && dailyMetrics.some((d) => d.sends > 0 || d.opens > 0 || d.replies > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activite quotidienne (30 derniers jours)</CardTitle>
            <CardDescription>
              Envois, ouvertures et reponses par jour.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailyMetrics.map((d) => ({
                ...d,
                label: new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Bar dataKey="sends" name="Envois" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Line dataKey="opens" name="Ouvertures" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line dataKey="replies" name="Reponses" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-step table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Performance par etape</CardTitle>
          </div>
          <CardDescription>
            Statistiques detaillees pour chaque etape de la sequence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Sujet</TableHead>
                  <TableHead className="text-right">Envoyes</TableHead>
                  <TableHead className="text-right">Ouverture</TableHead>
                  <TableHead className="text-right">Clic</TableHead>
                  <TableHead className="text-right">Reponse</TableHead>
                  <TableHead className="text-right">Bounce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyticsSteps.filter((s) => s.step_type === "email").map((step) => (
                  <TableRow key={step.id}>
                    <TableCell>
                      <span className="flex items-center justify-center size-6 rounded-full bg-slate-200 text-xs font-medium">
                        {step.step_order}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {step.subject || "Sans sujet"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {step.total_sent}
                    </TableCell>
                    <TableCell className="text-right">
                      <RateCell value={step.open_rate} count={step.total_opened} color="bg-green-500" />
                    </TableCell>
                    <TableCell className="text-right">
                      <RateCell value={step.click_rate} count={step.total_clicked} color="bg-purple-500" />
                    </TableCell>
                    <TableCell className="text-right">
                      <RateCell value={step.reply_rate} count={step.total_replied} color="bg-amber-500" />
                    </TableCell>
                    <TableCell className="text-right">
                      <RateCell value={step.bounce_rate} count={step.total_bounced} color="bg-red-500" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RateCell({ value, count, color }: { value: number; count: number; color: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-sm font-medium">{value}%</span>
      <div className="w-16 h-1.5 rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{count}</span>
    </div>
  );
}
