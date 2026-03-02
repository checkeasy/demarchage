"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImportCrmHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName: string;
  onImported: () => void;
}

export function ImportCrmHistoryDialog({
  open,
  onOpenChange,
  prospectId,
  prospectName,
  onImported,
}: ImportCrmHistoryDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ inserted: number; errors: number } | null>(null);

  const handleImport = async () => {
    if (text.trim().length < 10) {
      toast.error("Collez au minimum 10 caracteres d'historique CRM");
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/activities/import-crm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur d'import");
      }

      setResult({ inserted: data.inserted, errors: data.errors });
      toast.success(`${data.inserted} activite(s) importee(s) !`);

      if (data.inserted > 0) {
        onImported();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'import");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setText("");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            Importer l&apos;historique CRM - {prospectName}
          </DialogTitle>
          <DialogDescription>
            Collez l&apos;historique d&apos;activites depuis Pipedrive (ou tout autre CRM).
            L&apos;IA va parser automatiquement les appels, emails, reunions et notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Historique CRM (copier-coller)</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Collez ici l'historique du prospect depuis Pipedrive...

Exemple :
13 mars - Appel decouverte
Notes: Discussion avec le gerant, interesse par notre solution...

15 mars - Email envoye
Objet: Suite a notre appel...

20 mars - Reunion demo
Compte-rendu: Presentation du produit, feedback positif...`}
              rows={15}
              disabled={isLoading}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {text.length > 0 ? `${text.length} caracteres` : "Collez le texte brut depuis votre CRM"}
            </p>
          </div>

          {result && (
            <div className={`rounded-lg p-3 text-sm ${result.errors > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="font-medium">
                {result.inserted} activite(s) importee(s) avec succes
                {result.errors > 0 && ` (${result.errors} erreur(s))`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {result ? "Fermer" : "Annuler"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={isLoading || text.trim().length < 10}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" />
                  Importer
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
