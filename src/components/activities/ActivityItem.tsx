"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Phone,
  Calendar,
  Mail,
  CheckSquare,
  RefreshCw,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_TYPES, ACTIVITY_PRIORITIES } from "@/lib/constants";
import type { Activity } from "@/lib/types/crm";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone,
  Calendar,
  Mail,
  CheckSquare,
  RefreshCw,
  Monitor,
};

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === -1) return "Hier";
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";

  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

interface ActivityItemProps {
  activity: Activity;
  onToggleDone: (id: string, isDone: boolean) => void;
}

export function ActivityItem({ activity, onToggleDone }: ActivityItemProps) {
  const [loading, setLoading] = useState(false);
  const [optimisticDone, setOptimisticDone] = useState(activity.is_done);

  const typeConfig =
    ACTIVITY_TYPES[activity.activity_type as keyof typeof ACTIVITY_TYPES];
  const priorityConfig =
    ACTIVITY_PRIORITIES[activity.priority as keyof typeof ACTIVITY_PRIORITIES];
  const IconComponent = typeConfig
    ? ICON_MAP[typeConfig.icon]
    : CheckSquare;

  const isHighPriority =
    activity.priority === "high" || activity.priority === "urgent";

  async function handleToggle() {
    const newDone = !optimisticDone;
    setOptimisticDone(newDone);
    setLoading(true);

    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done: newDone }),
      });

      if (!res.ok) {
        setOptimisticDone(!newDone);
        toast.error("Erreur lors de la mise a jour");
        return;
      }

      toast.success(
        newDone ? "Activite terminee" : "Activite reactivee"
      );
      onToggleDone(activity.id, newDone);
    } catch {
      setOptimisticDone(!newDone);
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-slate-50 transition-colors ${
        optimisticDone ? "opacity-60" : ""
      }`}
    >
      {/* Checkbox */}
      <Checkbox
        checked={optimisticDone}
        onCheckedChange={handleToggle}
        disabled={loading}
        aria-label={`Marquer "${activity.title}" comme ${
          optimisticDone ? "non terminee" : "terminee"
        }`}
      />

      {/* Type icon */}
      <div
        className={`flex items-center justify-center size-8 rounded-lg shrink-0 ${
          typeConfig?.bgColor ?? "bg-slate-50"
        }`}
      >
        {IconComponent && (
          <IconComponent
            className={`size-4 ${typeConfig?.color ?? "text-slate-500"}`}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm truncate ${
              isHighPriority ? "font-bold" : "font-medium"
            } ${optimisticDone ? "line-through text-muted-foreground" : ""}`}
          >
            {activity.title}
          </span>

          {/* Priority badge */}
          {isHighPriority && (
            <Badge
              variant="secondary"
              className={`text-xs ${
                activity.priority === "urgent"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : "bg-orange-100 text-orange-700 border-orange-200"
              }`}
            >
              {priorityConfig?.label}
            </Badge>
          )}
        </div>

        {/* Linked entities */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {activity.deal && (
            <Link
              href={`/deals/${activity.deal.id}`}
              className="text-xs text-blue-600 hover:underline truncate max-w-[200px]"
            >
              {activity.deal.title}
            </Link>
          )}
          {activity.deal && activity.prospect && (
            <span className="text-xs text-muted-foreground">-</span>
          )}
          {activity.prospect && (
            <Link
              href={`/prospects/${activity.prospect.id}`}
              className="text-xs text-muted-foreground hover:underline truncate max-w-[200px]"
            >
              {[activity.prospect.first_name, activity.prospect.last_name]
                .filter(Boolean)
                .join(" ") || activity.prospect.email}
            </Link>
          )}
        </div>
      </div>

      {/* Due date */}
      {activity.due_date && (
        <span
          className={`text-xs shrink-0 ${
            !optimisticDone &&
            new Date(activity.due_date) < new Date() &&
            new Date(activity.due_date).toDateString() !==
              new Date().toDateString()
              ? "text-red-600 font-medium"
              : "text-muted-foreground"
          }`}
        >
          {formatRelativeDate(activity.due_date)}
        </span>
      )}
    </div>
  );
}
