"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sparkles,
  Loader2,
  Target,
  MessageCircle,
  TrendingUp,
  RefreshCw,
  Volume2,
  Linkedin,
  Mail,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Prospect } from "@/lib/types/database";

interface AIResearchCardProps {
  prospect: Prospect;
}

interface WebEnrichment {
  linkedin_url?: string | null;
  linkedin_confidence?: number;
  email?: string | null;
  email_confidence?: number;
  reasoning?: string;
}

interface ResearchData {
  company_description?: string;
  estimated_properties?: number;
  cities?: string[];
  digital_maturity?: string;
  ota_presence?: Record<string, number>;
  pms_used?: string;
  review_score?: number;
  pain_points?: string[];
  talking_points?: string[];
  recommended_angle?: string;
  recommended_tone?: string;
  icp_score?: number;
  priority?: string;
  contact_channels?: string[];
  web_enrichment?: WebEnrichment;
}

const ANGLE_LABELS: Record<string, string> = {
  qualite: "Qualite & reputation",
  gain_temps: "Gain de temps",
  securite_juridique: "Securite juridique",
  professionnalisation: "Professionnalisation",
  scalabilite: "Scalabilite",
};

const TONE_LABELS: Record<string, string> = {
  formel: "Formel",
  "semi-formel": "Semi-formel",
  decontracte: "Decontracte",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
  skip: "bg-red-100 text-red-800",
};

function ICPScoreGauge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-green-600"
      : score >= 60
      ? "text-amber-600"
      : score >= 40
      ? "text-orange-600"
      : "text-red-600";
  const bg =
    score >= 80
      ? "bg-green-500"
      : score >= 60
      ? "bg-amber-500"
      : score >= 40
      ? "bg-orange-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${bg}`}
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>
      </div>
      <span className={`text-lg font-bold tabular-nums ${color}`}>
        {score}/100
      </span>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 90) {
    return (
      <Badge className="bg-green-100 text-green-700 text-[10px] gap-0.5">
        <CheckCircle2 className="size-2.5" />
        {confidence}%
      </Badge>
    );
  }
  if (confidence >= 75) {
    return (
      <Badge className="bg-amber-100 text-amber-700 text-[10px] gap-0.5">
        <CheckCircle2 className="size-2.5" />
        {confidence}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-0.5 text-muted-foreground">
      <AlertTriangle className="size-2.5" />
      {confidence}%
    </Badge>
  );
}

export function AIResearchCard({ prospect }: AIResearchCardProps) {
  const supabase = createClient();
  const router = useRouter();

  // Check if we already have cached research
  const cf = (prospect.custom_fields || {}) as Record<string, unknown>;
  const cachedResearch = cf.ai_research as ResearchData | undefined;

  const [research, setResearch] = useState<ResearchData | null>(
    cachedResearch || null
  );
  const [deleted, setDeleted] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [appliedLinkedin, setAppliedLinkedin] = useState(false);
  const [appliedEmail, setAppliedEmail] = useState(false);
  const [applyingLinkedin, setApplyingLinkedin] = useState(false);
  const [applyingEmail, setApplyingEmail] = useState(false);

  async function handleApplyEnrichment(field: "linkedin_url" | "email", value: string) {
    const setApplying = field === "linkedin_url" ? setApplyingLinkedin : setApplyingEmail;
    const setApplied = field === "linkedin_url" ? setAppliedLinkedin : setAppliedEmail;
    setApplying(true);
    try {
      const { error } = await supabase
        .from("prospects")
        .update({ [field]: value })
        .eq("id", prospect.id);
      if (error) throw error;
      setApplied(true);
      toast.success(field === "linkedin_url" ? "LinkedIn applique au prospect" : "Email applique au prospect");
      router.refresh();
    } catch {
      toast.error("Erreur lors de la mise a jour");
    } finally {
      setApplying(false);
    }
  }

  const handleResearch = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/agents/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Erreur de recherche");
        return;
      }

      // Handle deletion — ask for confirmation instead of auto-deleting
      if (json.deleted) {
        setDeleteReason(json.delete_reason || "Prospect hors cible");
        setShowDeleteConfirm(true);
        return;
      }

      const data = (json.research?.content || json.research) as ResearchData;
      setResearch(data);

      // Cache in custom_fields
      const updatedFields = {
        ...(prospect.custom_fields as Record<string, unknown>),
        ai_research: data,
        ai_research_at: new Date().toISOString(),
      };

      await supabase
        .from("prospects")
        .update({ custom_fields: updatedFields })
        .eq("id", prospect.id);

      // Check if enrichment found new data
      const enrichment = data.web_enrichment;
      if (enrichment?.linkedin_url || enrichment?.email) {
        const parts: string[] = [];
        if (enrichment.linkedin_url) parts.push("LinkedIn");
        if (enrichment.email) parts.push("email");
        toast.success(`Analyse terminee + ${parts.join(" et ")} trouve(s) !`);
      } else {
        toast.success("Analyse prospect terminee");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const loading = isAnalyzing;

  async function handleConfirmDelete() {
    setDeleted(true);
    setShowDeleteConfirm(false);
    const { error } = await supabase
      .from("prospects")
      .delete()
      .eq("id", prospect.id);
    if (error) {
      toast.error("Erreur lors de la suppression");
      setDeleted(false);
      return;
    }
    toast.success("Prospect supprime");
    router.push("/prospects");
  }

  // Deleted state
  if (deleted) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
            <Trash2 className="size-4" />
            Prospect supprime
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{deleteReason}</p>
          <p className="text-xs text-red-500 mt-2">
            Redirection vers la liste des prospects...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Delete confirmation dialog
  if (showDeleteConfirm) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700">
            <AlertTriangle className="size-4" />
            Prospect potentiellement hors cible
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-amber-800">
            L&apos;IA a determine que ce prospect n&apos;est pas pertinent.
            Voulez-vous le supprimer ?
          </p>
          {deleteReason && (
            <p className="text-xs text-amber-600 italic">{deleteReason}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={handleConfirmDelete}
            >
              <Trash2 className="size-3.5" />
              Supprimer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Garder
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!research) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="size-4 text-purple-600" />
            Analyse IA du Prospect
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={handleResearch}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Target className="size-4" />
            )}
            {loading ? "Analyse en cours..." : "Analyser ce prospect"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            L&apos;IA analysera les donnees du prospect, recherchera son LinkedIn
            et son email sur internet, et supprimera les contacts hors cible.
          </p>
        </CardContent>
      </Card>
    );
  }

  const enrichment = research.web_enrichment;

  return (
    <Card className="border-purple-100">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="size-4 text-purple-600" />
            Analyse IA du Prospect
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleResearch}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Re-analyser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Web Enrichment Results */}
        {enrichment && (enrichment.linkedin_url || enrichment.email || enrichment.reasoning) && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 space-y-2">
            <p className="text-xs font-medium text-blue-800 flex items-center gap-1.5">
              <Search className="size-3" />
              Recherche internet
            </p>
            {enrichment.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="size-3.5 text-blue-600 shrink-0" />
                <a
                  href={enrichment.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-700 hover:underline truncate flex-1"
                >
                  {enrichment.linkedin_url}
                </a>
                <ConfidenceBadge confidence={enrichment.linkedin_confidence || 0} />
                {appliedLinkedin ? (
                  <Badge className="bg-green-100 text-green-700 text-[10px] gap-0.5 shrink-0">
                    <CheckCircle2 className="size-2.5" />
                    Applique
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs min-w-[44px] min-h-[44px] shrink-0"
                    onClick={() => handleApplyEnrichment("linkedin_url", enrichment.linkedin_url!)}
                    disabled={applyingLinkedin}
                  >
                    {applyingLinkedin ? <Loader2 className="size-2.5 animate-spin" /> : "Appliquer"}
                  </Button>
                )}
              </div>
            )}
            {enrichment.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-blue-600 shrink-0" />
                <span className="text-xs text-blue-700 truncate flex-1">
                  {enrichment.email}
                </span>
                <ConfidenceBadge confidence={enrichment.email_confidence || 0} />
                {appliedEmail ? (
                  <Badge className="bg-green-100 text-green-700 text-[10px] gap-0.5 shrink-0">
                    <CheckCircle2 className="size-2.5" />
                    Applique
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs min-w-[44px] min-h-[44px] shrink-0"
                    onClick={() => handleApplyEnrichment("email", enrichment.email!)}
                    disabled={applyingEmail}
                  >
                    {applyingEmail ? <Loader2 className="size-2.5 animate-spin" /> : "Appliquer"}
                  </Button>
                )}
              </div>
            )}
            {!enrichment.linkedin_url && !enrichment.email && enrichment.reasoning && (
              <p className="text-xs text-blue-600">{enrichment.reasoning}</p>
            )}
          </div>
        )}

        {/* ICP Score */}
        {research.icp_score !== undefined && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Score ICP
            </p>
            <ICPScoreGauge score={research.icp_score} />
            {research.priority && (
              <Badge
                variant="secondary"
                className={`mt-1.5 text-xs ${
                  PRIORITY_COLORS[research.priority] || ""
                }`}
              >
                Priorite : {research.priority}
              </Badge>
            )}
          </div>
        )}

        {/* Company description */}
        {research.company_description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Description
            </p>
            <p className="text-sm">{research.company_description}</p>
          </div>
        )}

        {/* Pain Points */}
        {research.pain_points && research.pain_points.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Target className="size-3" />
              Pain Points
            </p>
            <div className="flex flex-wrap gap-1.5">
              {research.pain_points.map((pp, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {pp}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Talking Points */}
        {research.talking_points && research.talking_points.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <MessageCircle className="size-3" />
              Sujets de conversation
            </p>
            <ul className="space-y-1">
              {research.talking_points.map((tp, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                  <span className="text-purple-400 mt-1">-</span>
                  {tp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Angle & Tone */}
        <div className="flex gap-3">
          {research.recommended_angle && (
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingUp className="size-3" />
                Angle
              </p>
              <Badge className="bg-purple-100 text-purple-800 text-xs">
                {ANGLE_LABELS[research.recommended_angle] ||
                  research.recommended_angle}
              </Badge>
            </div>
          )}
          {research.recommended_tone && (
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Volume2 className="size-3" />
                Ton
              </p>
              <Badge variant="outline" className="text-xs">
                {TONE_LABELS[research.recommended_tone] ||
                  research.recommended_tone}
              </Badge>
            </div>
          )}
        </div>

        {/* Cities */}
        {research.cities && research.cities.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Zones
            </p>
            <div className="flex flex-wrap gap-1">
              {research.cities.map((city, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {city}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
