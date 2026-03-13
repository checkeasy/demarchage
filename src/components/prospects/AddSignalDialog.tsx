"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SIGNAL_TYPES, SIGNAL_SOURCES } from "@/lib/constants";
import { Signal, Plus } from "lucide-react";

interface AddSignalDialogProps {
  prospectId: string;
  children?: React.ReactNode;
}

export function AddSignalDialog({ prospectId, children }: AddSignalDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signalType, setSignalType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("manual");
  const [score, setScore] = useState<number>(10);

  // Auto-fill title and score when signal type changes
  function handleTypeChange(type: string) {
    setSignalType(type);
    const config = SIGNAL_TYPES[type];
    if (config) {
      setScore(config.defaultScore);
      if (!title) setTitle(config.label);
    }
  }

  async function handleSubmit() {
    if (!signalType || !title) {
      toast.error("Type et titre requis");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal_type: signalType,
          title,
          description: description || null,
          signal_score: score,
          signal_source: source,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success("Signal ajoute");
      setOpen(false);
      setSignalType("");
      setTitle("");
      setDescription("");
      setScore(10);
      router.refresh();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-1">
            <Signal className="h-3.5 w-3.5" />
            <Plus className="h-3 w-3" />
            Signal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Signal className="h-5 w-5 text-amber-500" />
            Ajouter un signal d&apos;intention
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Type de signal</Label>
            <Select value={signalType} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un type..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SIGNAL_TYPES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className={config.color}>{config.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">(+{config.defaultScore}pts)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Titre</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Recrute un responsable digital"
            />
          </div>

          <div className="grid gap-2">
            <Label>Description (optionnel)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details supplementaires..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SIGNAL_SOURCES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Score (+pts)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={score}
                onChange={(e) => setScore(parseInt(e.target.value) || 10)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading || !signalType || !title}>
            {loading ? "Ajout..." : "Ajouter le signal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
