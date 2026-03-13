"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddCriteriaInlineProps {
  onCreated: () => void;
}

export function AddCriteriaInline({ onCreated }: AddCriteriaInlineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setLabel("");
    setOptionsText("");
    setIsOpen(false);
  }

  async function handleSave() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      toast.error("Le nom du critere est requis");
      return;
    }

    const options = optionsText
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    if (options.length === 0) {
      toast.error("Ajoutez au moins une option (separees par des virgules)");
      return;
    }

    const key = trimmedLabel
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    setIsSaving(true);
    try {
      const res = await fetch("/api/workspaces/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          label: trimmedLabel,
          options: options.map((o) => ({
            value: o
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_|_$/g, ""),
            label: o,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la creation");
        return;
      }

      toast.success(`Critere "${trimmedLabel}" cree`);
      reset();
      onCreated();
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="size-3.5" />
        Ajouter un critere
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Nouveau critere</p>
        <button type="button" onClick={reset} className="text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs">Nom du critere</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Type de clientele"
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Options (separees par des virgules)</Label>
          <Input
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder="Ex: Particuliers, Professionnels, Mixte"
            className="h-8 text-sm mt-1"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={reset} disabled={isSaving}>
          Annuler
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
