"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Sparkles,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  RefreshCw,
  Zap,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  const [contextOpen, setContextOpen] = useState(false);
  const [companyContext, setCompanyContext] = useState(initialContext);
  const [editingContext, setEditingContext] = useState(initialContext);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);

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

        // Compute basic performance stats from config data
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

  // Load performance when switching to performance tab
  useEffect(() => {
    if (configs.length === 0) return;
    // Pre-load performance data
    loadPerformance();
  }, [configs.length, loadPerformance]);

  return (
    <>
      {/* Company Context Section - Collapsible */}
      <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-purple-50">
                    <Brain className="size-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Contexte Entreprise
                    </CardTitle>
                    <CardDescription>
                      {workspaceName} - Ce que les agents savent de votre
                      business
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {companyContext ? (
                    <Badge variant="secondary" className="text-xs">
                      Configure
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs text-amber-600 border-amber-300"
                    >
                      A configurer
                    </Badge>
                  )}
                  {contextOpen ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <Separator className="mb-4" />
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Decrivez votre entreprise, vos produits/services, votre
                  proposition de valeur, et votre cible ideale. Les agents
                  utiliseront ce contexte pour generer des messages pertinents.
                </p>
                <Textarea
                  value={editingContext}
                  onChange={(e) => setEditingContext(e.target.value)}
                  placeholder="Ex: Nous sommes une agence web specialisee dans la creation de sites e-commerce pour les PME du secteur alimentaire. Notre proposition de valeur est un accompagnement complet de la conception au lancement avec un delai de 4 semaines..."
                  className="min-h-[150px] font-mono text-sm"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {editingContext.length} caracteres
                  </p>
                  <Button
                    onClick={handleSaveContext}
                    disabled={
                      isSavingContext || editingContext === companyContext
                    }
                    size="sm"
                  >
                    {isSavingContext ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Sauvegarder
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Main Tabs */}
      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">
            <Brain className="size-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="generation">
            <Sparkles className="size-4" />
            Generation
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="size-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Agents */}
        <TabsContent value="agents">
          {configs.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <Brain className="size-12 text-slate-300 mb-4" />
                  <h4 className="text-lg font-semibold">
                    Aucun agent configure
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    Initialisez vos 5 agents IA pour commencer a generer des
                    messages de prospection personnalises.
                  </p>
                  <Button
                    onClick={initializeConfigs}
                    className="mt-4"
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {configs.filter((c) => c.is_active).length} agent(s) actif(s)
                  sur {configs.length}
                </p>
                <Button variant="ghost" size="sm" onClick={reloadConfigs}>
                  <RefreshCw className="size-3" />
                  Rafraichir
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* Tab 3: Performance */}
        <TabsContent value="performance">
          <div className="space-y-6">
            {/* Overall stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-0">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center justify-center size-10 rounded-lg bg-blue-50 mb-2">
                      <Sparkles className="size-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold">
                      {performance?.totalGenerations || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Total generations
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-0">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center justify-center size-10 rounded-lg bg-green-50 mb-2">
                      <BarChart3 className="size-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold">
                      {performance?.avgPersonalizationScore
                        ? `${Math.round(performance.avgPersonalizationScore)}%`
                        : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Score personnalisation moyen
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-0">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center justify-center size-10 rounded-lg bg-amber-50 mb-2">
                      <Zap className="size-5 text-amber-600" />
                    </div>
                    <p className="text-2xl font-bold">
                      {performance?.totalCostUsd
                        ? `$${performance.totalCostUsd.toFixed(4)}`
                        : "$0.00"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cout total
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per-agent stats table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Statistiques par agent
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadPerformance}
                    disabled={isLoadingPerformance}
                  >
                    {isLoadingPerformance ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    Rafraichir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingPerformance ? (
                  <div className="flex flex-col items-center py-8">
                    <Loader2 className="size-8 animate-spin text-slate-300 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Chargement...
                    </p>
                  </div>
                ) : !performance ||
                  performance.agentStats.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <BarChart3 className="size-10 text-slate-300 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Aucune donnee de performance disponible
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Les statistiques apparaitront apres les premieres
                      generations
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">
                          Generations
                        </TableHead>
                        <TableHead className="text-right">
                          Score perso.
                        </TableHead>
                        <TableHead className="text-right">
                          Tokens moy.
                        </TableHead>
                        <TableHead className="text-right">Cout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance.agentStats.map((stat) => (
                        <TableRow key={stat.agent_type}>
                          <TableCell className="font-medium">
                            {stat.agent_type.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.total_generations}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.avg_personalization_score > 0
                              ? `${Math.round(stat.avg_personalization_score)}%`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.avg_tokens > 0
                              ? Math.round(stat.avg_tokens)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.total_cost_usd > 0
                              ? `$${stat.total_cost_usd.toFixed(4)}`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Segment performance */}
            {performance &&
              performance.segmentPerformance.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Performance par segment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {performance.segmentPerformance.map((seg) => (
                        <div
                          key={seg.segment}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {seg.segment}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {seg.count} envois
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center">
                              <p className="font-medium">
                                {Math.round(seg.openRate)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Ouverture
                              </p>
                            </div>
                            <Separator
                              orientation="vertical"
                              className="h-8"
                            />
                            <div className="text-center">
                              <p className="font-medium">
                                {Math.round(seg.replyRate)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
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
          </div>
        </TabsContent>
      </Tabs>

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
