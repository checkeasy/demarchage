"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Loader2,
  Users,
  Target,
  Mail,
  Linkedin,
  ArrowRight,
  Check,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAIGeneration } from "@/hooks/useAIGeneration";
import type { Prospect } from "@/lib/types/database";

interface SmartCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProspects: Prospect[];
}

type WizardStep = "segment" | "strategy" | "generate" | "complete";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function computeSegmentStats(prospects: Prospect[]) {
  const cities: Record<string, number> = {};
  const sources: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  const industries: Record<string, number> = {};
  const employeeCounts: Record<string, number> = {};
  let totalProperties = 0;
  let propsCount = 0;
  let totalLeadScore = 0;
  let scoreCount = 0;

  for (const p of prospects) {
    sources[p.source || "unknown"] = (sources[p.source || "unknown"] || 0) + 1;
    statuses[p.status || "new"] = (statuses[p.status || "new"] || 0) + 1;
    if (p.nb_properties) { totalProperties += p.nb_properties; propsCount++; }
    const loc = p.city || p.location;
    if (loc) { cities[loc] = (cities[loc] || 0) + 1; }
    if (p.industry) { industries[p.industry] = (industries[p.industry] || 0) + 1; }
    if (p.employee_count) { employeeCounts[p.employee_count] = (employeeCounts[p.employee_count] || 0) + 1; }
    if (p.lead_score !== null && p.lead_score !== undefined) { totalLeadScore += p.lead_score; scoreCount++; }
  }

  const topCities = Object.entries(cities).sort(([, a], [, b]) => b - a).slice(0, 5).map(([city]) => city);
  const topIndustries = Object.entries(industries).sort(([, a], [, b]) => b - a).slice(0, 5).map(([ind]) => ind);

  return {
    totalProspects: prospects.length,
    avgProperties: propsCount > 0 ? Math.round(totalProperties / propsCount) : 0,
    avgLeadScore: scoreCount > 0 ? Math.round(totalLeadScore / scoreCount) : null,
    topCities,
    topIndustries,
    industries,
    employeeCounts,
    sources,
    statuses,
  };
}

export function SmartCampaignDialog({
  open,
  onOpenChange,
  selectedProspects,
}: SmartCampaignDialogProps) {
  const [step, setStep] = useState<WizardStep>("segment");
  const [campaignName, setCampaignName] = useState("");
  const [strategy, setStrategy] = useState<AnyRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { getStrategy, generateOutreach, isLoading } = useAIGeneration();

  const segmentStats = computeSegmentStats(selectedProspects);

  const handleGetStrategy = async () => {
    const result = await getStrategy({
      segmentStats,
      prospectIds: selectedProspects.map((p) => p.id),
    });
    if (result) {
      setStrategy(result);
      setStep("strategy");
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error("Veuillez donner un nom a la campagne");
      return;
    }

    setIsCreating(true);
    try {
      // Step 1: Create the campaign
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          description: `Campagne IA generee pour ${selectedProspects.length} prospects`,
        }),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(createData.error || "Erreur creation campagne");
      }

      const campaignId = createData.campaign?.id || createData.id;

      // Step 2: Generate sequence steps with AI
      const steps = [];
      const sequence = [
        { channel: "email" as const, stepNum: 1 },
        { channel: "email" as const, stepNum: 2 },
        { channel: "email" as const, stepNum: 3 },
      ];

      for (const seq of sequence) {
        const result = await generateOutreach({
          prospectId: selectedProspects[0]?.id,
          campaignId,
          channel: seq.channel,
          stepNumber: seq.stepNum,
        });
        if (result?.content) {
          const content = result.content as AnyRecord;
          steps.push({
            step_type: seq.channel === "email" ? "email" : "linkedin_message",
            step_order: steps.length + 1,
            subject: content.subject || null,
            body_html: content.body_html || null,
            body_text: content.body_text || null,
            delay_days: seq.stepNum > 1 ? 3 : 0,
          });
          // Add delay between steps
          if (seq.stepNum < 3) {
            steps.push({
              step_type: "delay",
              step_order: steps.length + 1,
              delay_days: seq.stepNum === 1 ? 3 : 5,
              delay_hours: 0,
            });
          }
        }
      }

      // Step 3: Save steps
      if (steps.length > 0) {
        await fetch(`/api/campaigns/${campaignId}/steps`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ steps }),
        });
      }

      // Step 4: Enroll prospects
      await fetch(`/api/campaigns/${campaignId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectIds: selectedProspects.map((p) => p.id),
        }),
      });

      setStep("complete");
      toast.success(`Campagne "${campaignName}" creee avec ${selectedProspects.length} prospects`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setStep("segment");
    setStrategy(null);
    setCampaignName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-600" />
            Creer une campagne IA
          </DialogTitle>
          <DialogDescription>
            L&apos;IA va analyser vos prospects et creer une campagne optimisee.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {["Segment", "Strategie", "Generation", "Termine"].map((label, i) => {
            const steps: WizardStep[] = ["segment", "strategy", "generate", "complete"];
            const isActive = steps.indexOf(step) >= i;
            return (
              <div key={label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3" />}
                <span className={isActive ? "text-purple-700 font-medium" : ""}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Segment Overview */}
        {step === "segment" && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-blue-600" />
                <span className="font-medium text-sm">
                  {segmentStats.totalProspects} prospects selectionnes
                </span>
              </div>

              {segmentStats.avgProperties > 0 && (
                <div className="text-sm text-muted-foreground">
                  Moyenne : <strong>{segmentStats.avgProperties}</strong> logements
                </div>
              )}

              {segmentStats.topCities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {segmentStats.topCities.map((city) => (
                    <Badge key={city} variant="secondary" className="text-xs">
                      {city}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(segmentStats.sources).map(([src, count]) => (
                  <Badge key={src} variant="outline" className="text-xs">
                    {src}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nom de la campagne</Label>
              <Input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Conciergeries Sud France - Mars 2026"
              />
            </div>

            <DialogFooter>
              <Button
                onClick={handleGetStrategy}
                disabled={isLoading || !campaignName.trim()}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Target className="size-4" />
                )}
                {isLoading ? "Analyse du segment..." : "Obtenir la strategie IA"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Strategy Review */}
        {step === "strategy" && strategy && (
          <div className="space-y-4">
            <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-4 space-y-3">
              <p className="text-sm font-medium text-purple-800">
                Strategie recommandee par l&apos;IA
              </p>

              {strategy.recommended_sequence && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Sequence suggeree</p>
                  <div className="space-y-1">
                    {(strategy.recommended_sequence.steps as AnyRecord[])?.map(
                      (s: AnyRecord, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {s.type === "email" && <Mail className="size-3.5 text-blue-500" />}
                          {s.type === "linkedin_connect" && (
                            <Linkedin className="size-3.5 text-sky-500" />
                          )}
                          {s.type === "delay" && (
                            <span className="text-xs text-muted-foreground">
                              ⏳ {s.days}j
                            </span>
                          )}
                          {s.type !== "delay" && <span>{s.label}</span>}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("segment")}>
                Retour
              </Button>
              <Button
                onClick={() => {
                  setStep("generate");
                  handleCreateCampaign();
                }}
                className="gap-2"
              >
                <ArrowRight className="size-4" />
                Generer la campagne
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Generating */}
        {step === "generate" && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="size-8 text-purple-600 animate-spin mx-auto" />
            <div>
              <p className="font-medium">Generation en cours...</p>
              <p className="text-sm text-muted-foreground">
                L&apos;IA cree votre sequence d&apos;emails personnalisee
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && (
          <div className="py-8 text-center space-y-4">
            <div className="size-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="size-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Campagne creee avec succes !</p>
              <p className="text-sm text-muted-foreground">
                {selectedProspects.length} prospects inscrits dans &quot;{campaignName}&quot;
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Fermer
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
