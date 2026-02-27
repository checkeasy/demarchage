"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Calendar, User } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Deal } from "@/lib/types/crm";

interface DealKanbanCardProps {
  deal: Deal;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getDaysInStage(stageEnteredAt: string): number {
  const entered = new Date(stageEnteredAt);
  const now = new Date();
  const diffMs = now.getTime() - entered.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getProspectName(deal: Deal): string {
  if (!deal.prospect) return "";
  const parts = [deal.prospect.first_name, deal.prospect.last_name].filter(
    Boolean
  );
  if (parts.length > 0) return parts.join(" ");
  return deal.prospect.company || deal.prospect.email || "";
}

export function DealKanbanCard({ deal }: DealKanbanCardProps) {
  const router = useRouter();

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: deal.id,
      data: { deal },
    });

  const style = useMemo(() => {
    if (!transform) return undefined;
    return {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    };
  }, [transform]);

  const daysInStage = getDaysInStage(deal.stage_entered_at);
  const prospectName = getProspectName(deal);

  const daysColor =
    daysInStage > 14
      ? "text-red-600 bg-red-50"
      : daysInStage > 7
        ? "text-orange-600 bg-orange-50"
        : "text-muted-foreground bg-muted";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50 z-50" : ""}
    >
      <Card
        className="cursor-grab active:cursor-grabbing py-3 gap-2 hover:shadow-md transition-shadow"
        onClick={(e) => {
          // Don't navigate when dragging
          if (isDragging) return;
          // Don't navigate when clicking the drag handle
          const target = e.target as HTMLElement;
          if (target.closest("[data-drag-handle]")) return;
          router.push(`/deals/${deal.id}`);
        }}
      >
        <CardContent className="px-3 py-0 space-y-2">
          {/* Drag handle + title row */}
          <div className="flex items-start gap-1.5">
            <button
              data-drag-handle
              className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
            <p className="text-sm font-medium leading-tight line-clamp-2 flex-1">
              {deal.title}
            </p>
          </div>

          {/* Value */}
          {deal.value !== null && deal.value > 0 && (
            <p className="text-sm font-semibold text-slate-900">
              {formatCurrency(deal.value)}
            </p>
          )}

          {/* Prospect */}
          {prospectName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="size-3 shrink-0" />
              <span className="truncate">{prospectName}</span>
            </div>
          )}

          {/* Days in stage */}
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className={`text-[10px] ${daysColor}`}>
              <Calendar className="size-2.5" />
              {daysInStage}j dans cette etape
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
