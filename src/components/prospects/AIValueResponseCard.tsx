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
  Lightbulb,
  Loader2,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAIGeneration } from "@/hooks/useAIGeneration";
import type { Prospect } from "@/lib/types/database";

interface AIValueResponseCardProps {
  prospect: Prospect;
  lastReplyText: string;
  replyAnalysis?: {
    sentiment?: string;
    intent?: string;
  };
}

interface ValueResponseData {
  value_insight?: string;
  full_response?: string;
  subject?: string;
}

export function AIValueResponseCard({
  prospect,
  lastReplyText,
  replyAnalysis,
}: AIValueResponseCardProps) {
  const { generateValueResponse, isLoading } = useAIGeneration();
  const [response, setResponse] = useState<ValueResponseData | null>(null);
  const [copied, setCopied] = useState(false);

  // Show for positive/interested replies, or if no analysis yet (let user decide)
  const sentiment = replyAnalysis?.sentiment;
  const intent = replyAnalysis?.intent;
  const isNegative =
    sentiment === "negative" ||
    intent === "not_interested" ||
    intent === "unsubscribe";

  // Hide only if analysis is explicitly negative; show otherwise
  if (isNegative || !lastReplyText) return null;

  const handleGenerate = async () => {
    const result = await generateValueResponse({
      prospectId: prospect.id,
      replyText: lastReplyText,
      replyAnalysis: replyAnalysis || {},
    });
    if (result) {
      const data = (result.content || result) as ValueResponseData;
      setResponse(data);
      toast.success("Reponse de valeur generee");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copie dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!response) {
    return (
      <Card className="border-emerald-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="size-4 text-emerald-600" />
            Reponse de valeur
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
              Nouveau
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Generez une reponse qui apporte de la valeur (mini-audit, conseil personnalise)
            au lieu d&apos;un simple pitch commercial.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isLoading ? "Generation en cours..." : "Generer une reponse de valeur"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="size-4 text-emerald-600" />
          Reponse de valeur
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Value insight */}
        {response.value_insight && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider mb-1">
              Insight cle
            </p>
            <p className="text-sm text-emerald-900">{response.value_insight}</p>
          </div>
        )}

        {/* Subject */}
        {response.subject && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Objet
            </p>
            <p className="text-sm font-medium">{response.subject}</p>
          </div>
        )}

        {/* Full response */}
        {response.full_response && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
            <p className="text-sm whitespace-pre-wrap">{response.full_response}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={() => handleCopy(
              response.subject
                ? `Objet: ${response.subject}\n\n${response.full_response}`
                : response.full_response || ""
            )}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copie !" : "Copier"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-emerald-600"
            onClick={() => setResponse(null)}
          >
            Regenerer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
