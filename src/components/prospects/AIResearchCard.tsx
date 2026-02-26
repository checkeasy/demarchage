"use client";

import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useAIGeneration } from "@/hooks/useAIGeneration";
import { createClient } from "@/lib/supabase/client";
import type { Prospect } from "@/lib/types/database";

interface AIResearchCardProps {
  prospect: Prospect;
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

export function AIResearchCard({ prospect }: AIResearchCardProps) {
  const { researchProspect, isLoading } = useAIGeneration();
  const supabase = createClient();

  // Check if we already have cached research
  const cf = (prospect.custom_fields || {}) as Record<string, unknown>;
  const cachedResearch = cf.ai_research as ResearchData | undefined;

  const [research, setResearch] = useState<ResearchData | null>(
    cachedResearch || null
  );

  const handleResearch = async () => {
    const result = await researchProspect({ prospectId: prospect.id });
    if (result) {
      const data = (result.content || result) as ResearchData;
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

      toast.success("Analyse prospect terminee");
    }
  };

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
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Target className="size-4" />
            )}
            {isLoading ? "Analyse en cours..." : "Analyser ce prospect"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            L&apos;IA analysera les donnees du prospect pour generer un score ICP,
            identifier les pain points et recommander un angle d&apos;approche.
          </p>
        </CardContent>
      </Card>
    );
  }

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
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Re-analyser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
