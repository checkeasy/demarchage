"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, XCircle } from "lucide-react";

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
import type { Deal } from "@/lib/types/crm";

interface MarkDealDialogProps {
  deal: Deal;
  type: "won" | "lost";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkDealDialog({
  deal,
  type,
  open,
  onOpenChange,
}: MarkDealDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lossReason, setLossReason] = useState("");

  async function handleConfirm() {
    if (type === "lost" && !lossReason.trim()) {
      toast.error("Veuillez indiquer la raison de la perte");
      return;
    }

    setLoading(true);

    try {
      const body: Record<string, unknown> = { status: type };
      if (type === "lost") {
        body.loss_reason = lossReason.trim();
      }

      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la mise a jour");
      }

      toast.success(
        type === "won"
          ? "Deal marque comme gagne !"
          : "Deal marque comme perdu"
      );
      setLossReason("");
      onOpenChange(false);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la mise a jour";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "won" ? (
              <>
                <Trophy className="size-5 text-green-600" />
                Marquer comme gagne
              </>
            ) : (
              <>
                <XCircle className="size-5 text-red-600" />
                Marquer comme perdu
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {type === "won"
              ? `Confirmer que le deal "${deal.title}" est gagne ?`
              : `Indiquez la raison pour laquelle le deal "${deal.title}" a ete perdu.`}
          </DialogDescription>
        </DialogHeader>

        {type === "lost" && (
          <div className="space-y-2">
            <Label htmlFor="loss-reason">Raison de la perte *</Label>
            <Textarea
              id="loss-reason"
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              placeholder="Ex: Budget insuffisant, concurrent choisi, timing pas bon..."
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            variant={type === "won" ? "default" : "destructive"}
            className={
              type === "won"
                ? "bg-green-600 hover:bg-green-700"
                : ""
            }
          >
            {loading
              ? "Mise a jour..."
              : type === "won"
                ? "Confirmer gagne"
                : "Confirmer perdu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
