"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Target, Plus, Pause, Play, Archive, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreateMissionDialog } from "@/components/missions/CreateMissionDialog";

interface MissionWithStats {
  id: string;
  name: string;
  description: string | null;
  original_prompt: string;
  search_keywords: string[];
  target_profile: Record<string, any>;
  language: string;
  status: string;
  total_prospects: number;
  total_enrolled: number;
  total_sent: number;
  total_replied: number;
  created_at: string;
}

interface MissionsPageClientProps {
  missions: MissionWithStats[];
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge variant="outline" className="gap-1.5 font-medium border-green-200 text-green-700 bg-green-50">
          <span className="size-2 rounded-full bg-green-500" />
          Active
        </Badge>
      );
    case "paused":
      return (
        <Badge variant="outline" className="gap-1.5 font-medium border-yellow-200 text-yellow-700 bg-yellow-50">
          <span className="size-2 rounded-full bg-yellow-500" />
          En pause
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="outline" className="gap-1.5 font-medium border-slate-200 text-slate-500 bg-slate-50">
          <span className="size-2 rounded-full bg-slate-400" />
          Archivee
        </Badge>
      );
    case "draft":
      return (
        <Badge variant="outline" className="gap-1.5 font-medium border-blue-200 text-blue-700 bg-blue-50">
          <span className="size-2 rounded-full bg-blue-400" />
          Brouillon
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1.5 font-medium">
          <span className="size-2 rounded-full bg-slate-400" />
          {status}
        </Badge>
      );
  }
}

function getLanguageBadge(language: string) {
  const upper = (language || "").toUpperCase().slice(0, 2);
  return (
    <Badge variant="secondary" className="text-[11px] font-semibold px-1.5 py-0">
      {upper}
    </Badge>
  );
}

function MissionCard({
  mission,
  onStatusChange,
}: {
  mission: MissionWithStats;
  onStatusChange: (id: string, newStatus: string) => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  const enrolledProgress =
    mission.total_prospects > 0
      ? Math.round((mission.total_enrolled / mission.total_prospects) * 100)
      : 0;

  const createdDate = new Date(mission.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isActive = mission.status === "active";
  const isPaused = mission.status === "paused";
  const isArchived = mission.status === "archived";

  async function handleTogglePause() {
    const newStatus = isActive ? "paused" : "active";
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/missions/${mission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la mise a jour");
      }
      toast.success(newStatus === "paused" ? "Mission mise en pause" : "Mission relancee");
      onStatusChange(mission.id, newStatus);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleArchive() {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/missions/${mission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'archivage");
      }
      toast.success("Mission archivee");
      onStatusChange(mission.id, "archived");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className="flex flex-col transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 truncate text-base leading-tight">
              {mission.name}
            </h3>
            {getLanguageBadge(mission.language)}
          </div>
          <div className="shrink-0">
            {getStatusBadge(mission.status)}
          </div>
        </div>

        {mission.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {mission.description}
          </p>
        )}

        {mission.search_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {mission.search_keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium"
              >
                <Search className="size-2.5 shrink-0" />
                {kw}
              </span>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-0 flex-1">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="space-y-0.5">
            <p className="text-lg font-bold text-slate-900">
              {mission.total_prospects ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground leading-none">prospects</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-lg font-bold text-slate-900">
              {mission.total_enrolled ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground leading-none">inscrits</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-lg font-bold text-slate-900">
              {mission.total_sent}
            </p>
            <p className="text-[11px] text-muted-foreground leading-none">envoyes</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-lg font-bold text-green-600">
              {mission.total_replied}
            </p>
            <p className="text-[11px] text-muted-foreground leading-none">reponses</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progression</span>
            <span>
              {mission.total_enrolled ?? 0} / {mission.total_prospects ?? 0} inscrits
            </span>
          </div>
          <Progress value={enrolledProgress} className="h-2" />
        </div>

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t mt-auto">
          <span className="text-xs text-muted-foreground truncate">
            Creee le {createdDate}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {(isActive || isPaused) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleTogglePause}
                disabled={isUpdating}
              >
                {isActive ? (
                  <>
                    <Pause className="size-3" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="size-3" />
                    Reprendre
                  </>
                )}
              </Button>
            )}
            {!isArchived && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-slate-500 hover:text-slate-700"
                onClick={handleArchive}
                disabled={isUpdating}
              >
                <Archive className="size-3" />
                Archiver
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MissionsPageClient({ missions: initialMissions }: MissionsPageClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [missions, setMissions] = useState<MissionWithStats[]>(initialMissions);

  function handleStatusChange(id: string, newStatus: string) {
    setMissions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
    );
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="size-6 text-blue-600" />
            Missions de Prospection
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerez vos missions de prospection multi-canal pilotees par l'IA
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="size-4" />
          Nouvelle mission
        </Button>
      </div>

      {/* Mission cards or empty state */}
      {missions.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
              <Target className="size-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              Aucune mission pour l'instant
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Decrivez votre cible en langage naturel et l'IA creera automatiquement vos campagnes de prospection.
            </p>
            <div className="mt-4">
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="size-4" />
                Creer ma premiere mission
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      <CreateMissionDialog open={dialogOpen} onOpenChange={handleDialogOpenChange} />
    </div>
  );
}
