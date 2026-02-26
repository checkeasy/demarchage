"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Sparkles,
  BarChart3,
  Save,
  Loader2,
  RefreshCw,
  Zap,
  Building2,
  Pencil,
  Bot,
  TrendingUp,
  DollarSign,
  Activity,
  FileText,
  Check,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { AgentConfig } from "@/lib/agents/types";
import { AgentCard } from "./AgentCard";
import { AgentConfigDialog } from "./AgentConfigDialog";
import { GenerationPanel } from "./GenerationPanel";

interface AgentsPageClientProps {
  configs: AgentConfig[];
  workspaceId: string;
  workspaceName: string;
  companyContext: string;
}

interface AgentStats {
  agent_type: string;
  total_generations: number;
  avg_personalization_score: number;
  total_cost_usd: number;
  avg_tokens: number;
}

interface PerformanceData {
  totalGenerations: number;
  avgPersonalizationScore: number;
  totalCostUsd: number;
  agentStats: AgentStats[];
  segmentPerformance: Array<{
    segment: string;
    openRate: number;
    replyRate: number;
    count: number;
  }>;
}

export function AgentsPageClient({
  configs: initialConfigs,
  workspaceId,
  workspaceName,
  companyContext: initialContext,
}: AgentsPageClientProps) {
  const [configs, setConfigs] = useState<AgentConfig[]>(initialConfigs);
  const [selectedConfig, setSelectedConfig] = useState<AgentConfig | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const [companyContext, setCompanyContext] = useState(initialContext);
  const [editingContext, setEditingContext] = useState(initialContext);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);

  // Prompt editor state
  interface AgentPromptFile {
    agentType: string;
    dirName: string;
    exists: boolean;
    name: string;
    description: string;
    model: string;
    tools: string;
    body: string;
    lineCount: number;
  }
  const [promptFiles, setPromptFiles] = useState<AgentPromptFile[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AgentPromptFile | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Initialize agent configs if none exist
  const initializeConfigs = useCallback(async () => {
    setIsInitializing(true);
    try {
      const res = await fetch("/api/agents/config", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
        toast.success("Agents initialises avec succes");
      } else {
        toast.error("Erreur lors de l'initialisation des agents");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Reload configs
  const reloadConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/config");
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
      }
    } catch {
      // Silent fail
    }
  }, []);

  // Load performance data
  const loadPerformance = useCallback(async () => {
    setIsLoadingPerformance(true);
    try {
      const res = await fetch("/api/agents/config");
      if (res.ok) {
        const data = await res.json();
        const agentConfigs: AgentConfig[] = data.configs || [];

        const totalGenerations = agentConfigs.reduce(
          (sum: number, c: AgentConfig) =>
            sum +
            ((c.settings as Record<string, number>)?.total_generations || 0),
          0
        );
        const totalCost = agentConfigs.reduce(
          (sum: number, c: AgentConfig) =>
            sum +
            ((c.settings as Record<string, number>)?.total_cost_usd || 0),
          0
        );
        const avgScore =
          agentConfigs.length > 0
            ? agentConfigs.reduce(
                (sum: number, c: AgentConfig) =>
                  sum +
                  ((c.settings as Record<string, number>)
                    ?.avg_personalization_score || 0),
                0
              ) / agentConfigs.length
            : 0;

        const agentStats: AgentStats[] = agentConfigs.map(
          (c: AgentConfig) => ({
            agent_type: c.agent_type,
            total_generations:
              (c.settings as Record<string, number>)?.total_generations || 0,
            avg_personalization_score:
              (c.settings as Record<string, number>)
                ?.avg_personalization_score || 0,
            total_cost_usd:
              (c.settings as Record<string, number>)?.total_cost_usd || 0,
            avg_tokens:
              (c.settings as Record<string, number>)?.avg_tokens || 0,
          })
        );

        setPerformance({
          totalGenerations: totalGenerations,
          avgPersonalizationScore: avgScore,
          totalCostUsd: totalCost,
          agentStats,
          segmentPerformance: [],
        });
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoadingPerformance(false);
    }
  }, []);

  // Save company context
  async function handleSaveContext() {
    setIsSavingContext(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase
        .from("workspaces")
        .update({ ai_company_context: editingContext })
        .eq("id", workspaceId);

      if (error) {
        toast.error("Erreur lors de la sauvegarde du contexte");
        return;
      }

      setCompanyContext(editingContext);
      setContextDialogOpen(false);
      toast.success("Contexte entreprise mis a jour");
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsSavingContext(false);
    }
  }

  function handleConfigureAgent(config: AgentConfig) {
    setSelectedConfig(config);
    setDialogOpen(true);
  }

  function handleConfigSaved() {
    reloadConfigs();
    setDialogOpen(false);
    setSelectedConfig(null);
  }

  function openContextDialog() {
    setEditingContext(companyContext);
    setContextDialogOpen(true);
  }

  // Load prompt files
  const loadPromptFiles = useCallback(async () => {
    setIsLoadingPrompts(true);
    try {
      const res = await fetch("/api/agents/prompts");
      if (res.ok) {
        const data = await res.json();
        setPromptFiles(data.agents || []);
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoadingPrompts(false);
    }
  }, []);

  // Save prompt
  async function handleSavePrompt() {
    if (!editingPrompt) return;
    setIsSavingPrompt(true);
    try {
      const res = await fetch("/api/agents/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType: editingPrompt.agentType,
          body: editingBody,
        }),
      });
      if (res.ok) {
        toast.success(`Prompt "${editingPrompt.name}" sauvegarde`);
        setEditingPrompt(null);
        loadPromptFiles();
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsSavingPrompt(false);
    }
  }

  // Load performance when switching to performance tab
  useEffect(() => {
    if (configs.length === 0) return;
    loadPerformance();
  }, [configs.length, loadPerformance]);

  const activeCount = configs.filter((c) => c.is_active).length;

  // Agent type name mapping for the stats table
  const agentTypeNames: Record<string, string> = {
    ceo: "CEO Stratege",
    email_writer: "Redacteur Email",
    linkedin_writer: "Redacteur LinkedIn",
    response_handler: "Analyste Reponses",
    prospect_researcher: "Chercheur Prospects",
  };

  return (
    <>
      {/* Company Context Card */}
      <Card className="border-slate-200/80">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-purple-50">
                <Building2 className="size-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Contexte Entreprise
                  </p>
                  {companyContext ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      Configure
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-amber-600 border-amber-300 bg-amber-50"
                    >
                      A configurer
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                  {companyContext
                    ? companyContext.length > 100
                      ? companyContext.slice(0, 100) + "..."
                      : companyContext
                    : `${workspaceName} - Decrivez votre business pour les agents`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={openContextDialog}
              className="shrink-0"
            >
              <Pencil className="size-3.5" />
              Modifier
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList className="bg-slate-100/80 p-1">
          <TabsTrigger
            value="agents"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 px-4"
          >
            <Bot className="size-4" />
            <span>Agents</span>
            {configs.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 size-5 p-0 flex items-center justify-center text-[10px] rounded-full"
              >
                {configs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="generation"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 px-4"
          >
            <Sparkles className="size-4" />
            <span>Generation</span>
          </TabsTrigger>
          <TabsTrigger
            value="prompts"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 px-4"
            onClick={() => { if (promptFiles.length === 0) loadPromptFiles(); }}
          >
            <FileText className="size-4" />
            <span>Prompts .md</span>
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 px-4"
          >
            <BarChart3 className="size-4" />
            <span>Performance</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Agents */}
        <TabsContent value="agents" className="space-y-6">
          {configs.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200">
              <CardContent className="py-16">
                <div className="flex flex-col items-center text-center max-w-sm mx-auto">
                  <div className="flex items-center justify-center size-16 rounded-2xl bg-slate-100 mb-5">
                    <Brain className="size-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Aucun agent configure
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Initialisez vos 5 agents IA pour commencer a generer des
                    messages de prospection personnalises pour chaque canal.
                  </p>
                  <Button
                    onClick={initializeConfigs}
                    className="mt-6"
                    size="lg"
                    disabled={isInitializing}
                  >
                    {isInitializing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Zap className="size-4" />
                    )}
                    Initialiser les agents
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {/* Agent count + refresh */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-slate-700">{activeCount}</span> agent{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""} sur{" "}
                    <span className="font-medium text-slate-700">{configs.length}</span>
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={reloadConfigs} className="text-muted-foreground hover:text-slate-700">
                  <RefreshCw className="size-3.5" />
                  Rafraichir
                </Button>
              </div>

              {/* Agent grid -- up to 5 columns on xl, 3 on lg, 2 on md */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {configs.map((config) => (
                  <AgentCard
                    key={config.id}
                    config={config}
                    onConfigure={() => handleConfigureAgent(config)}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Generation */}
        <TabsContent value="generation">
          <GenerationPanel workspaceId={workspaceId} />
        </TabsContent>

        {/* Tab 3: Prompts .md */}
        <TabsContent value="prompts" className="space-y-6">
          {editingPrompt ? (
            /* ─── Prompt Editor ─── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingPrompt(null)}
                  >
                    <ChevronRight className="size-4 rotate-180" />
                    Retour
                  </Button>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {editingPrompt.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      .claude/agents/{editingPrompt.dirName}/AGENT.md
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {editingPrompt.model}
                  </Badge>
                  <Button
                    onClick={handleSavePrompt}
                    disabled={isSavingPrompt || editingBody === editingPrompt.body}
                    size="sm"
                  >
                    {isSavingPrompt ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Sauvegarder
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-4">
                <span>{editingBody.split("\n").length} lignes</span>
                <span>{editingBody.length} caracteres</span>
                <span>Outils : {editingPrompt.tools || "aucun"}</span>
              </div>

              <Textarea
                value={editingBody}
                onChange={(e) => setEditingBody(e.target.value)}
                className="min-h-[500px] font-mono text-xs leading-relaxed"
                placeholder="Contenu du prompt..."
              />
            </div>
          ) : (
            /* ─── Prompt List ─── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Fichiers prompts agents
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Editez les instructions de chaque agent IA directement. Les modifications sont appliquees immediatement.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadPromptFiles}
                  disabled={isLoadingPrompts}
                >
                  {isLoadingPrompts ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Rafraichir
                </Button>
              </div>

              {isLoadingPrompts ? (
                <div className="flex flex-col items-center py-16">
                  <Loader2 className="size-8 animate-spin text-slate-300 mb-3" />
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                </div>
              ) : promptFiles.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="py-16 text-center">
                    <FileText className="size-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Aucun fichier prompt trouve. Cliquez sur Rafraichir.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {promptFiles.map((file) => (
                    <Card
                      key={file.agentType}
                      className="border-slate-200/80 hover:border-slate-300 transition-colors cursor-pointer"
                      onClick={() => {
                        setEditingPrompt(file);
                        setEditingBody(file.body);
                      }}
                    >
                      <CardContent className="py-4 px-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center size-10 rounded-xl bg-slate-100">
                              <FileText className="size-5 text-slate-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  {agentTypeNames[file.agentType] || file.name}
                                </p>
                                {file.exists ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                                  >
                                    <Check className="size-2.5 mr-0.5" />
                                    .md
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] text-red-600 border-red-300"
                                  >
                                    Manquant
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px]">
                                  {file.model}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-lg">
                                {file.description || "Pas de description"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {file.lineCount} lignes
                            </span>
                            <ChevronRight className="size-4 text-slate-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Performance */}
        <TabsContent value="performance" className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200/80">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-blue-50">
                    <Sparkles className="size-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {performance?.totalGenerations || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Generations totales
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-emerald-50">
                    <TrendingUp className="size-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {performance?.avgPersonalizationScore
                        ? `${Math.round(performance.avgPersonalizationScore)}%`
                        : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Score personnalisation
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-amber-50">
                    <DollarSign className="size-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {performance?.totalCostUsd
                        ? `$${performance.totalCostUsd.toFixed(4)}`
                        : "$0.00"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cout total IA
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-agent stats table */}
          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-slate-100">
                    <Activity className="size-4 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Statistiques par agent
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Detail des performances individuelles
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadPerformance}
                  disabled={isLoadingPerformance}
                  className="text-muted-foreground hover:text-slate-700"
                >
                  {isLoadingPerformance ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Rafraichir
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPerformance ? (
                <div className="flex flex-col items-center py-12">
                  <Loader2 className="size-8 animate-spin text-slate-300 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Chargement des donnees...
                  </p>
                </div>
              ) : !performance ||
                performance.agentStats.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="flex items-center justify-center size-14 rounded-2xl bg-slate-100 mb-4">
                    <BarChart3 className="size-7 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    Aucune donnee disponible
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
                    Les statistiques de performance apparaitront ici apres vos
                    premieres generations de messages
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200/80 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead className="font-medium text-slate-600">
                          Agent
                        </TableHead>
                        <TableHead className="text-right font-medium text-slate-600">
                          Generations
                        </TableHead>
                        <TableHead className="text-right font-medium text-slate-600">
                          Score perso.
                        </TableHead>
                        <TableHead className="text-right font-medium text-slate-600">
                          Tokens moy.
                        </TableHead>
                        <TableHead className="text-right font-medium text-slate-600">
                          Cout
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance.agentStats.map((stat) => (
                        <TableRow key={stat.agent_type}>
                          <TableCell className="font-medium text-slate-900">
                            {agentTypeNames[stat.agent_type] ||
                              stat.agent_type.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {stat.total_generations}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {stat.avg_personalization_score > 0
                              ? `${Math.round(stat.avg_personalization_score)}%`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {stat.avg_tokens > 0
                              ? Math.round(stat.avg_tokens)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {stat.total_cost_usd > 0
                              ? `$${stat.total_cost_usd.toFixed(4)}`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Segment performance */}
          {performance &&
            performance.segmentPerformance.length > 0 && (
              <Card className="border-slate-200/80">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-9 rounded-lg bg-slate-100">
                      <TrendingUp className="size-4 text-slate-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Performance par segment
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Taux d&apos;ouverture et de reponse par segment
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {performance.segmentPerformance.map((seg) => (
                      <div
                        key={seg.segment}
                        className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl border border-slate-100"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {seg.segment}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {seg.count} envois
                          </p>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="font-semibold text-slate-900 tabular-nums">
                              {Math.round(seg.openRate)}%
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Ouverture
                            </p>
                          </div>
                          <Separator
                            orientation="vertical"
                            className="h-8"
                          />
                          <div className="text-center">
                            <p className="font-semibold text-slate-900 tabular-nums">
                              {Math.round(seg.replyRate)}%
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Reponse
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
        </TabsContent>
      </Tabs>

      {/* Company Context Dialog */}
      <Dialog open={contextDialogOpen} onOpenChange={setContextDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-purple-600" />
              Contexte Entreprise
            </DialogTitle>
            <DialogDescription>
              Decrivez votre entreprise, produits/services, proposition de valeur
              et cible ideale. Les agents utiliseront ce contexte pour generer
              des messages pertinents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Textarea
              value={editingContext}
              onChange={(e) => setEditingContext(e.target.value)}
              placeholder="Ex: Nous sommes une agence web specialisee dans la creation de sites e-commerce pour les PME du secteur alimentaire. Notre proposition de valeur est un accompagnement complet de la conception au lancement avec un delai de 4 semaines..."
              className="min-h-[200px] text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              {editingContext.length} caracteres
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContextDialogOpen(false)}
              disabled={isSavingContext}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveContext}
              disabled={isSavingContext || editingContext === companyContext}
            >
              {isSavingContext ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Config Dialog */}
      {selectedConfig && (
        <AgentConfigDialog
          config={selectedConfig}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={handleConfigSaved}
        />
      )}
    </>
  );
}
