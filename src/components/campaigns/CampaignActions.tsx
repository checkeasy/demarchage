"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Pause, Edit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CampaignActionsProps {
  campaignId: string;
  status: string;
}

export function CampaignActions({ campaignId, status }: CampaignActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    </div>
  );
}
