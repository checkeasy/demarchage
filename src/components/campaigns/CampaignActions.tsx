"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Pause, Edit, Loader2, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface CampaignActionsProps {
  campaignId: string;
  status: string;
}

export function CampaignActions({ campaignId, status }: CampaignActionsProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function deleteCampaign() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Campagne supprimee");
        router.push("/campaigns");
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setDeleting(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const labels: Record<string, string> = {
          active: "Campagne lancee",
          paused: "Campagne mise en pause",
        };
        toast.success(labels[newStatus] || "Statut mis a jour");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la mise a jour");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 shrink-0">
      {status === "draft" && (
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/campaigns/${campaignId}/edit`}>
              <Edit className="size-4" />
              Modifier
            </Link>
          </Button>
          <Button size="sm" onClick={() => updateStatus("active")} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Lancer
          </Button>
        </>
      )}
      {status === "active" && (
        <Button variant="outline" size="sm" onClick={() => updateStatus("paused")} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
          Pause
        </Button>
      )}
      {status === "paused" && (
        <Button size="sm" onClick={() => updateStatus("active")} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Reprendre
        </Button>
      )}
      {status === "completed" && (
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            setLoading(true);
            try {
              const res = await fetch(`/api/campaigns/${campaignId}/duplicate`, {
                method: "POST",
              });
              if (res.ok) {
                const data = await res.json();
                toast.success("Campagne dupliquee");
                router.push(`/campaigns/${data.id}`);
              } else {
                toast.error("Erreur lors de la duplication");
              }
            } catch {
              toast.error("Erreur reseau");
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
          Dupliquer
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={deleting} aria-label="Supprimer">
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la campagne</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. Tous les emails en attente seront annules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteCampaign}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
