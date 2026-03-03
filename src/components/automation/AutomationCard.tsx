"use client";

import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Square,
  Users,
  UserCheck,
  MessageSquare,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface AutomationSequenceData {
  id: string;
  name: string;
  status: "active" | "paused" | "completed";
  totalProspects: number;
  processedProspects: number;
  stats: {
    connected: number;
    replied: number;
    ignored: number;
    meetings: number;
  };
  createdAt: string;
}

const STATUS_CONFIG = {
  active: {
    label: "Active",
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
  },
  paused: {
    label: "En pause",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dotColor: "bg-yellow-500",
  },
  completed: {
    label: "Terminee",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dotColor: "bg-blue-500",
  },
};

interface AutomationCardProps {
  sequence: AutomationSequenceData;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onStop: (id: string) => void;
}

export function AutomationCard({
  sequence,
  onPause,
  onResume,
  onStop,
}: AutomationCardProps) {
  const router = useRouter();
  const statusConfig = STATUS_CONFIG[sequence.status];
  const progressPercent =
    sequence.totalProspects > 0
      ? Math.round(
          (sequence.processedProspects / sequence.totalProspects) * 100
        )
      : 0;

  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
      onClick={() => router.push(`/automation/${sequence.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{sequence.name}</CardTitle>
          <Badge
            variant="outline"
            className={`gap-1.5 ${statusConfig.color}`}
          >
            <span
              className={`size-1.5 rounded-full ${statusConfig.dotColor}`}
            />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progression</span>
            <span className="font-medium">
              {sequence.processedProspects}/{sequence.totalProspects} prospects
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {progressPercent}%
          </p>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
            <UserCheck className="size-4 text-green-600 mb-1" />
            <span className="text-sm font-semibold">
              {sequence.stats.connected}
            </span>
            <span className="text-[10px] text-muted-foreground">Connectes</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
            <MessageSquare className="size-4 text-blue-600 mb-1" />
            <span className="text-sm font-semibold">
              {sequence.stats.replied}
            </span>
            <span className="text-[10px] text-muted-foreground">Reponses</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
            <Users className="size-4 text-slate-500 mb-1" />
            <span className="text-sm font-semibold">
              {sequence.stats.ignored}
            </span>
            <span className="text-[10px] text-muted-foreground">Ignores</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
            <CalendarCheck className="size-4 text-purple-600 mb-1" />
            <span className="text-sm font-semibold">
              {sequence.stats.meetings}
            </span>
            <span className="text-[10px] text-muted-foreground">Meetings</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {sequence.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onPause(sequence.id); }}
              className="flex-1"
            >
              <Pause className="size-3.5" />
              Pause
            </Button>
          )}
          {sequence.status === "paused" && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onResume(sequence.id); }}
              className="flex-1"
            >
              <Play className="size-3.5" />
              Reprendre
            </Button>
          )}
          {sequence.status !== "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onStop(sequence.id); }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Square className="size-3.5" />
              Arreter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
