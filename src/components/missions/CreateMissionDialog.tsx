"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Target, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface MissionResult {
  id: string;
  name: string;
  description: string | null;
  search_keywords: string[];
  language: string;
}

interface CreateMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateMissionDialog({ open, onOpenChange }: CreateMissionDialogProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MissionResult | null>(null);

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error("Veuillez decrire votre cible avant de continuer");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la creation de la mission");
      }

      setResult(data.mission ?? data);
      toast.success("Mission generee avec succes !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose() {
    onOpenChange(false);
  }

  function handleConfirm() {
    onOpenChange(false);
    router.refresh();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isLoading) {
      // Reset state when closing
      setPrompt("");
      setResult(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Target className="size-5 text-blue-600" />
            Nouvelle mission de prospection
          </DialogTitle>
          <DialogDescription>
            Decrivez votre cible en langage naturel. L'IA va generer une mission complete avec ses campagnes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!result ? (
            <>
              <Textarea
                placeholder="Ex: Channel Managers Airbnb a Barcelone, conciergeries luxe Paris, property managers Costa del Sol..."
                className="min-h-[120px] resize-none text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
              />

              <Button
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generation en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Generer la mission
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {/* Success indicator */}
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="size-5 shrink-0" />
                <span className="text-sm font-medium">Mission creee avec succes</span>
              </div>

              {/* Mission name */}
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nom de la mission
                </p>
                <p className="text-base font-semibold text-slate-900">{result.name}</p>
              </div>

              {/* Description */}
              {result.description && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">{result.description}</p>
                </div>
              )}

              {/* Keywords */}
              {result.search_keywords && result.search_keywords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Mots-cles de recherche
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.search_keywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Language + campaigns created */}
              <div className="flex items-center gap-3">
                {result.language && (
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-muted-foreground">Langue :</p>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {result.language.toUpperCase().slice(0, 2)}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-blue-500 shrink-0" />
                  <p className="text-xs text-muted-foreground">3 campagnes creees</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Fermer
                </Button>
                <Button className="flex-1 gap-2" onClick={handleConfirm}>
                  <Target className="size-4" />
                  C'est parti !
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
