"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Prospect } from "@/lib/types/database";

interface Signal {
  id: string;
  signal_type: string;
  title: string;
  description: string | null;
  signal_score: number;
}

interface GenerateSignalEmailProps {
  prospect: Prospect;
  signals: Signal[];
}

export function GenerateSignalEmail({ prospect, signals }: GenerateSignalEmailProps) {
  const [generating, setGenerating] = useState(false);
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Pick the highest-scoring signal
  const bestSignal = signals.reduce((best, s) =>
    s.signal_score > (best?.signal_score ?? 0) ? s : best
  , signals[0]);

  const generateEmail = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/prospects/generate-signal-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_id: prospect.id,
          signal: {
            signal_type: bestSignal.signal_type,
            title: bestSignal.title,
            description: bestSignal.description,
          },
        }),
      });

      if (!res.ok) throw new Error("Erreur generation");
      const data = await res.json();
      setEmail({ subject: data.subject, body: data.body });
    } catch {
      toast.error("Erreur lors de la generation de l'email");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!email) return;
    await navigator.clipboard.writeText(`Objet: ${email.subject}\n\n${email.body}`);
    setCopied(true);
    toast.success("Email copie dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!bestSignal) return null;

  return (
    <div className="space-y-2">
      {!email ? (
        <Button
          variant="outline"
          size="sm"
          onClick={generateEmail}
          disabled={generating}
          className="w-full text-xs"
        >
          {generating ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1" />
          )}
          {generating ? "Generation en cours..." : "Generer un email depuis les signaux"}
        </Button>
      ) : (
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Email genere par IA</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-6 px-2">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={generateEmail} disabled={generating} className="h-6 px-2">
                <Sparkles className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Input
            value={email.subject}
            onChange={(e) => setEmail({ ...email, subject: e.target.value })}
            className="text-xs h-7"
            placeholder="Objet"
          />
          <Textarea
            value={email.body}
            onChange={(e) => setEmail({ ...email, body: e.target.value })}
            className="text-xs min-h-[120px] resize-y"
          />
        </div>
      )}
    </div>
  );
}
