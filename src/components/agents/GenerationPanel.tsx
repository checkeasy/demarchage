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
  User,
  Megaphone,
  Hash,
  Wand2,
  Clock,
  Cpu,
  Target,
  DollarSign,
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
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Configuration panel -- 2 of 5 columns */}
      <Card className="lg:col-span-2 border-slate-200/80">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-violet-50">
              <Wand2 className="size-4 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-base">Generation rapide</CardTitle>
              <CardDescription className="text-xs">
                Generez un message personnalise
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Section: Prospect */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="size-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prospect
              </Label>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un prospect..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
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
                  <SelectTrigger className="w-full h-9 text-sm">
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
              <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-100 text-xs space-y-1">
                <p className="font-medium text-slate-900">
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

          {/* Section: Campaign */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="size-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Campagne
              </Label>
            </div>
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
                <SelectTrigger className="w-full h-9 text-sm">
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

          <Separator />

          {/* Section: Options */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Hash className="size-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Options
              </Label>
            </div>

            {/* Channel */}
            <div className="space-y-2">
              <Label className="text-sm">Canal</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant={channel === "email" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChannel("email")}
                  className="flex-1 h-9"
                >
                  <Mail className="size-4" />
                  Email
                </Button>
                <Button
                  variant={channel === "linkedin" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChannel("linkedin")}
                  className="flex-1 h-9"
                >
                  <Linkedin className="size-4" />
                  LinkedIn
                </Button>
              </div>
            </div>

            {/* Step number */}
            <div className="space-y-2">
              <Label className="text-sm">Etape de la sequence</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={stepNumber}
                onChange={(e) => setStepNumber(parseInt(e.target.value) || 1)}
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                1 = premier contact, 2+ = relance
              </p>
            </div>
          </div>

          <Separator />

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={
              isGenerating || !selectedProspectId || !selectedCampaignId
            }
            className="w-full h-10"
            size="lg"
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

      {/* Result panel -- 3 of 5 columns */}
      <Card className="lg:col-span-3 border-slate-200/80">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center size-9 rounded-lg ${
                  channel === "email" ? "bg-blue-50" : "bg-sky-50"
                }`}
              >
                {channel === "email" ? (
                  <Mail className="size-4 text-blue-600" />
                ) : (
                  <Linkedin className="size-4 text-sky-600" />
                )}
              </div>
              <div>
                <CardTitle className="text-base">Resultat</CardTitle>
                <CardDescription className="text-xs">
                  {channel === "email"
                    ? "Email de prospection genere"
                    : "Message LinkedIn genere"}
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Metadata badges */}
          {result?.metadata && (
            <div className="flex items-center gap-2 flex-wrap mt-3">
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  result.metadata.model.includes("sonnet")
                    ? "bg-violet-50 text-violet-700 border-violet-200"
                    : "bg-sky-50 text-sky-700 border-sky-200"
                }`}
              >
                <Cpu className="size-2.5 mr-1" />
                {result.metadata.model.includes("haiku")
                  ? "Haiku"
                  : "Sonnet"}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                <Target className="size-2.5 mr-1" />
                {Math.round(result.metadata.personalizationScore)}%
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {result.metadata.inputTokens + result.metadata.outputTokens}{" "}
                tokens
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                <DollarSign className="size-2.5 mr-1" />
                {result.metadata.costUsd.toFixed(4)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                <Clock className="size-2.5 mr-1" />
                {result.metadata.generationDurationMs}ms
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isGenerating ? (
            <div className="flex flex-col items-center py-16">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-100 size-16" />
                <div className="relative flex items-center justify-center size-16 rounded-full bg-blue-50">
                  <Loader2 className="size-7 animate-spin text-blue-600" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-700 mt-6">
                Les agents travaillent...
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Recherche, strategie et redaction en cours
              </p>
            </div>
          ) : result ? (
            <div className="space-y-5">
              {/* Email subject */}
              {channel === "email" &&
              typeof result.content.subject === "string" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Objet
                  </Label>
                  <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-100 text-sm font-medium text-slate-900">
                    {String(result.content.subject)}
                  </div>
                </div>
              ) : null}

              {/* Message body */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  {channel === "email" ? "Corps du message" : "Message"}
                </Label>
                <ScrollArea className="max-h-[320px]">
                  <div className="p-4 bg-slate-50/80 rounded-lg border border-slate-100 text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
                    {channel === "email"
                      ? String(
                          result.content.body_text ||
                            result.content.body_html ||
                            ""
                        )
                      : String(result.content.message || "")}
                  </div>
                </ScrollArea>
              </div>

              {/* Personalization hooks */}
              {Array.isArray(result.content.personalization_hooks) &&
              (result.content.personalization_hooks as string[]).length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Hooks de personnalisation
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(result.content.personalization_hooks as string[]).map(
                      (hook, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-xs bg-violet-50 text-violet-700"
                        >
                          {hook}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              ) : null}

              {/* Tone */}
              {typeof result.content.tone === "string" ? (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Ton:
                  </Label>
                  <Badge variant="outline" className="text-xs">
                    {result.content.tone}
                  </Badge>
                </div>
              ) : null}

              <Separator />

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-1 h-9"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Copie !" : "Copier"}
                </Button>
                <Button size="sm" className="flex-1 h-9">
                  <Send className="size-4" />
                  Utiliser
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-slate-100 mb-5">
                <Sparkles className="size-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                Pret a generer
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
                Configurez les parametres a gauche et cliquez sur
                &quot;Generer&quot; pour lancer les agents IA
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
