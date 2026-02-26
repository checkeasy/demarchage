"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Loader2,
  Search,
  Mail,
  Linkedin,
  Copy,
  Check,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";

interface GenerationPanelProps {
  workspaceId: string;
}

interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  job_title: string | null;
}

interface Campaign {
  id: string;
  name: string;
}

interface GenerationResult {
  content: Record<string, unknown>;
  metadata: {
    agentType: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    personalizationScore: number;
    generationDurationMs: number;
  };
}

export function GenerationPanel({ workspaceId }: GenerationPanelProps) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedProspectId, setSelectedProspectId] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [channel, setChannel] = useState<"email" | "linkedin">("email");
  const [stepNumber, setStepNumber] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingProspects, setIsLoadingProspects] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);

  const supabase = createClient();

  // Load prospects
  const loadProspects = useCallback(
    async (query?: string) => {
      setIsLoadingProspects(true);
      try {
        let q = supabase
          .from("prospects")
          .select("id, first_name, last_name, email, company, job_title")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (query && query.trim()) {
          q = q.or(
            `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`
          );
        }

        const { data } = await q;
        setProspects(data || []);
      } catch {
        // Silent fail
      } finally {
        setIsLoadingProspects(false);
      }
    },
    [supabase, workspaceId]
  );

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    setIsLoadingCampaigns(true);
    try {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      setCampaigns(data || []);
    } catch {
      // Silent fail
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    loadProspects();
    loadCampaigns();
  }, [loadProspects, loadCampaigns]);

  // Search prospects with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProspects(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, loadProspects]);

  async function handleGenerate() {
    if (!selectedProspectId) {
      toast.error("Veuillez selectionner un prospect");
      return;
    }
    if (!selectedCampaignId) {
      toast.error("Veuillez selectionner une campagne");
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/agents/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: selectedProspectId,
          campaignId: selectedCampaignId,
          channel,
          stepNumber,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        toast.success("Message genere avec succes");
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la generation");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsGenerating(false);
    }
  }

  function getFormattedContent(): string {
    if (!result?.content) return "";

    if (channel === "email") {
      const subject = (result.content.subject as string) || "";
      const body =
        (result.content.body_text as string) ||
        (result.content.body_html as string) ||
        "";
      return `Objet: ${subject}\n\n${body}`;
    } else {
      return (result.content.message as string) || "";
    }
  }

  async function handleCopy() {
    const text = getFormattedContent();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copie dans le presse-papiers");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  }

  const selectedProspect = prospects.find((p) => p.id === selectedProspectId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configuration panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4" />
            Generation rapide
          </CardTitle>
          <CardDescription>
            Generez un message de prospection pour un prospect specifique
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Prospect search */}
          <div className="space-y-2">
            <Label>Prospect</Label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un prospect..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {isLoadingProspects ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Chargement...
                </div>
              ) : (
                <Select
                  value={selectedProspectId}
                  onValueChange={setSelectedProspectId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selectionner un prospect" />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="max-h-[200px]">
                      {prospects.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Aucun prospect trouve
                        </div>
                      ) : (
                        prospects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <span className="font-medium">
                                {p.first_name || ""} {p.last_name || ""}
                              </span>
                              {p.company && (
                                <span className="text-xs text-muted-foreground">
                                  @ {p.company}
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Selected prospect preview */}
            {selectedProspect && (
              <div className="p-2 bg-slate-50 rounded-md text-xs space-y-0.5">
                <p className="font-medium">
                  {selectedProspect.first_name} {selectedProspect.last_name}
                </p>
                {selectedProspect.job_title && (
                  <p className="text-muted-foreground">
                    {selectedProspect.job_title}
                  </p>
                )}
                {selectedProspect.company && (
                  <p className="text-muted-foreground">
                    {selectedProspect.company}
                  </p>
                )}
                <p className="text-muted-foreground">
                  {selectedProspect.email}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Campaign selector */}
          <div className="space-y-2">
            <Label>Campagne</Label>
            {isLoadingCampaigns ? (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Chargement...
              </div>
            ) : (
              <Select
                value={selectedCampaignId}
                onValueChange={setSelectedCampaignId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selectionner une campagne" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Aucune campagne disponible
                    </div>
                  ) : (
                    campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label>Canal</Label>
            <div className="flex items-center gap-2">
              <Button
                variant={channel === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => setChannel("email")}
                className="flex-1"
              >
                <Mail className="size-4" />
                Email
              </Button>
              <Button
                variant={channel === "linkedin" ? "default" : "outline"}
                size="sm"
                onClick={() => setChannel("linkedin")}
                className="flex-1"
              >
                <Linkedin className="size-4" />
                LinkedIn
              </Button>
            </div>
          </div>

          {/* Step number */}
          <div className="space-y-2">
            <Label>Etape de la sequence</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={stepNumber}
              onChange={(e) => setStepNumber(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              1 = premier contact, 2+ = relance
            </p>
          </div>

          <Separator />

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={
              isGenerating || !selectedProspectId || !selectedCampaignId
            }
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isGenerating ? "Generation en cours..." : "Generer le message"}
          </Button>
        </CardContent>
      </Card>

      {/* Result panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {channel === "email" ? (
              <Mail className="size-4" />
            ) : (
              <Linkedin className="size-4" />
            )}
            Resultat
          </CardTitle>
          {result?.metadata && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">
                {result.metadata.model.includes("haiku")
                  ? "Haiku"
                  : "Sonnet"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Score: {Math.round(result.metadata.personalizationScore)}%
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {result.metadata.inputTokens + result.metadata.outputTokens}{" "}
                tokens
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                ${result.metadata.costUsd.toFixed(4)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {result.metadata.generationDurationMs}ms
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isGenerating ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="size-8 animate-spin text-blue-500 mb-3" />
              <p className="text-sm text-muted-foreground">
                Les agents travaillent...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Recherche, strategie et redaction en cours
              </p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {channel === "email" && typeof result.content.subject === "string" ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Objet
                  </Label>
                  <div className="p-2 bg-slate-50 rounded-md text-sm font-medium">
                    {String(result.content.subject)}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {channel === "email" ? "Corps du message" : "Message"}
                </Label>
                <ScrollArea className="max-h-[300px]">
                  <div className="p-3 bg-slate-50 rounded-md text-sm whitespace-pre-wrap font-mono leading-relaxed">
                    {channel === "email"
                      ? String(result.content.body_text || result.content.body_html || "")
                      : String(result.content.message || "")}
                  </div>
                </ScrollArea>
              </div>

              {Array.isArray(result.content.personalization_hooks) &&
              (result.content.personalization_hooks as string[]).length > 0 ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Hooks de personnalisation
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {(result.content.personalization_hooks as string[]).map(
                      (hook, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {hook}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              ) : null}

              {typeof result.content.tone === "string" ? (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Ton:</Label>
                  <Badge variant="outline" className="text-[10px]">
                    {result.content.tone}
                  </Badge>
                </div>
              ) : null}

              <Separator />

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-1"
                >
                  {copied ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Copie !" : "Copier"}
                </Button>
                <Button size="sm" className="flex-1">
                  <Send className="size-4" />
                  Utiliser
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <Sparkles className="size-10 text-slate-300 mb-3" />
              <p className="text-sm text-muted-foreground">
                Configurez les parametres et cliquez sur &quot;Generer&quot;
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Les agents IA analyseront le prospect et genereront un message
                personnalise
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
