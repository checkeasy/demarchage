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
  Copy,
  MessageSquareReply,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAIGeneration } from "@/hooks/useAIGeneration";
import type { Prospect } from "@/lib/types/database";

interface AISuggestedReplyCardProps {
  prospect: Prospect;
  lastReplyText?: string;
  previousInteractions?: Array<{ role: string; content: string; sent_at?: string }>;
}

interface ReplyAnalysisData {
  sentiment?: string;
  intent?: string;
  objections?: string[];
  objection_category?: string;
  suggested_response?: string;
  next_action?: string;
  recontact_date?: string;
  confidence?: number;
  priority?: string;
}

const SENTIMENT_CONFIG: Record<string, { label: string; color: string }> = {
  positive: { label: "Positif", color: "bg-green-100 text-green-800" },
  negative: { label: "Negatif", color: "bg-red-100 text-red-800" },
  neutral: { label: "Neutre", color: "bg-slate-100 text-slate-700" },
  out_of_office: { label: "Absent", color: "bg-amber-100 text-amber-800" },
  bounce: { label: "Bounce", color: "bg-red-100 text-red-800" },
};

const INTENT_CONFIG: Record<string, { label: string; color: string }> = {
  interested: { label: "Interesse", color: "bg-green-100 text-green-800" },
  not_interested: { label: "Pas interesse", color: "bg-red-100 text-red-800" },
  needs_info: { label: "Besoin d'info", color: "bg-blue-100 text-blue-800" },
  referral: { label: "Redirige", color: "bg-purple-100 text-purple-800" },
  meeting_request: { label: "Demande RDV", color: "bg-green-100 text-green-800" },
  unsubscribe: { label: "Desinscription", color: "bg-red-100 text-red-800" },
};

const ACTION_LABELS: Record<string, string> = {
  continue_sequence: "Continuer la sequence",
  pause: "Mettre en pause",
  escalate_human: "Escalader (humain)",
  book_meeting: "Planifier un RDV",
  stop: "Arreter la sequence",
};

export function AISuggestedReplyCard({
  prospect,
  lastReplyText,
  previousInteractions = [],
}: AISuggestedReplyCardProps) {
  const { analyzeReply, isLoading } = useAIGeneration();
  const [analysis, setAnalysis] = useState<ReplyAnalysisData | null>(null);

  if (!lastReplyText) return null;

  const handleAnalyze = async () => {
    const result = await analyzeReply({
      prospectId: prospect.id,
      replyText: lastReplyText,
      previousInteractions,
    });
    if (result) {
      const data = (result.content || result) as ReplyAnalysisData;
      setAnalysis(data);
      toast.success("Reponse analysee");
    }
  };

  const handleCopy = () => {
    if (analysis?.suggested_response) {
      navigator.clipboard.writeText(analysis.suggested_response);
      toast.success("Reponse copiee dans le presse-papiers");
    }
  };

  if (!analysis) {
    return (
      <Card className="border-amber-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquareReply className="size-4 text-amber-600" />
            Reponse recue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-slate-50 p-3 mb-3">
            <p className="text-sm text-muted-foreground italic line-clamp-3">
              &quot;{lastReplyText}&quot;
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
            onClick={handleAnalyze}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isLoading ? "Analyse en cours..." : "Analyser cette reponse"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sentimentConf = SENTIMENT_CONFIG[analysis.sentiment || ""] || {
    label: analysis.sentiment,
    color: "bg-slate-100 text-slate-700",
  };
  const intentConf = INTENT_CONFIG[analysis.intent || ""] || {
    label: analysis.intent,
    color: "bg-slate-100 text-slate-700",
  };

  return (
    <Card className="border-amber-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquareReply className="size-4 text-amber-600" />
          Analyse de la reponse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Sentiment & Intent */}
        <div className="flex gap-2">
          <Badge className={`text-xs ${sentimentConf.color}`}>
            {sentimentConf.label}
          </Badge>
          <Badge className={`text-xs ${intentConf.color}`}>
            {intentConf.label}
          </Badge>
          {analysis.confidence !== undefined && (
            <Badge variant="outline" className="text-xs">
              {Math.round(analysis.confidence * 100)}% confiance
            </Badge>
          )}
        </div>

        {/* Objections */}
        {analysis.objections && analysis.objections.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <AlertCircle className="size-3" />
              Objections detectees
            </p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.objections.map((obj, i) => (
                <Badge key={i} variant="outline" className="text-xs border-red-200 text-red-700">
                  {obj}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Response */}
        {analysis.suggested_response && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Reponse suggeree
            </p>
            <div className="rounded-lg bg-green-50 border border-green-100 p-3">
              <p className="text-sm">{analysis.suggested_response}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs gap-1 text-green-700 hover:text-green-800"
                onClick={handleCopy}
              >
                <Copy className="size-3" />
                Copier
              </Button>
            </div>
          </div>
        )}

        {/* Next Action */}
        {analysis.next_action && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 p-2.5">
            <ArrowRight className="size-4 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-800">
                Prochaine action
              </p>
              <p className="text-sm text-blue-700">
                {ACTION_LABELS[analysis.next_action] || analysis.next_action}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
