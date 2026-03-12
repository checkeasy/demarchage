"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PipelineStageConfig } from "@/lib/types/crm";

interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
}

interface AddDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStageConfig[];
  prospects: Prospect[];
  defaultStageId?: string;
}

export function AddDealDialog({
  open,
  onOpenChange,
  stages,
  prospects,
  defaultStageId,
}: AddDealDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState(defaultStageId || "");
  const [prospectId, setProspectId] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [probability, setProbability] = useState(50);
  const [prospectSearch, setProspectSearch] = useState("");

  useEffect(() => {
    setStageId(defaultStageId || "");
  }, [defaultStageId]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Filter prospects by search
  const filteredProspects = prospects.filter((p) => {
    if (!prospectSearch.trim()) return true;
    const term = prospectSearch.toLowerCase();
    return (
      (p.first_name && p.first_name.toLowerCase().includes(term)) ||
      (p.last_name && p.last_name.toLowerCase().includes(term)) ||
      (p.email && p.email.toLowerCase().includes(term)) ||
      (p.company && p.company.toLowerCase().includes(term))
    );
  });

  function resetForm() {
    setTitle("");
    setValue("");
    setStageId(defaultStageId || "");
    setProspectId("");
    setExpectedCloseDate("");
    setProbability(50);
    setProspectSearch("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    const selectedStage = stageId || stages[0]?.id;
    if (!selectedStage) {
      toast.error("Veuillez selectionner une etape");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          value: value ? parseFloat(value) : 0,
          stage_id: selectedStage,
          prospect_id: prospectId === "none" || !prospectId ? null : prospectId,
          expected_close_date: expectedCloseDate || null,
          probability,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la creation");
      }

      toast.success("Deal cree avec succes");
      resetForm();
      onOpenChange(false);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la creation";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) resetForm();
      onOpenChange(value);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau deal</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau deal a votre pipeline
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="deal-title">Titre *</Label>
            <Input
              id="deal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Contrat maintenance annuel"
              required
            />
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="deal-value">Valeur (EUR)</Label>
            <Input
              id="deal-value"
              type="number"
              min={0}
              step={0.01}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Stage */}
          <div className="space-y-2">
            <Label>Etape du pipeline *</Label>
            <Select
              value={stageId || stages[0]?.id || ""}
              onValueChange={setStageId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selectionner une etape" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prospect */}
          <div className="space-y-2">
            <Label>Prospect</Label>
            <Select value={prospectId} onValueChange={setProspectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Associer un prospect (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <Input
                    placeholder="Rechercher un prospect..."
                    value={prospectSearch}
                    onChange={(e) => setProspectSearch(e.target.value)}
                    className="h-8"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <SelectItem value="none">Aucun prospect</SelectItem>
                {filteredProspects.slice(0, 50).map((prospect) => {
                  const name = [prospect.first_name, prospect.last_name]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <SelectItem key={prospect.id} value={prospect.id}>
                      {name || prospect.email}
                      {prospect.company && (
                        <span className="text-muted-foreground ml-1">
                          ({prospect.company})
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Expected close date */}
          <div className="space-y-2">
            <Label htmlFor="deal-close-date">Date de cloture prevue</Label>
            <Input
              id="deal-close-date"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </div>

          {/* Probability */}
          <div className="space-y-2">
            <Label>Probabilite: {probability}%</Label>
            <Slider
              value={[probability]}
              onValueChange={([val]) => setProbability(val)}
              min={0}
              max={100}
              step={5}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creation...
                </>
              ) : (
                "Creer le deal"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
