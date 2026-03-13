"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Calendar, User, Mail } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CONTACT_TYPES } from "@/lib/constants";
import type { Deal } from "@/lib/types/crm";

interface DealKanbanCardProps {
  deal: Deal;
  isDragOverlay?: boolean;
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

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
  return `Il y a ${Math.floor(diffDays / 365)} an(s)`;
}

function getLastContactColor(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) return "text-green-600";
  if (diffDays <= 7) return "text-muted-foreground";
  if (diffDays <= 14) return "text-orange-600";
  return "text-red-600";
}

// Stage-specific thresholds for "days in stage" coloring (warning, danger)
const STAGE_THRESHOLDS: Record<string, { warn: number; danger: number }> = {
  discovery:    { warn: 3,  danger: 7  },
  qualification:{ warn: 5,  danger: 10 },
  proposal:     { warn: 7,  danger: 14 },
  negotiation:  { warn: 14, danger: 30 },
  closing:      { warn: 7,  danger: 14 },
};

const DEFAULT_THRESHOLD = { warn: 7, danger: 14 };

function getStageThresholds(stageSlug?: string): { warn: number; danger: number } {
  if (!stageSlug) return DEFAULT_THRESHOLD;
  return STAGE_THRESHOLDS[stageSlug] || DEFAULT_THRESHOLD;
}

function getProspectName(deal: Deal): string {
  if (!deal.prospect) return "";
  const parts = [deal.prospect.first_name, deal.prospect.last_name].filter(
    Boolean
  );
  if (parts.length > 0) return parts.join(" ");
  return deal.prospect.company || deal.prospect.email || "";
}

export function DealKanbanCard({ deal, isDragOverlay }: DealKanbanCardProps) {
  const router = useRouter();

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: deal.id,
      data: { deal },
    });

  const style = useMemo(() => {
    if (!transform) return undefined;
    return {
      transform: CSS.Translate.toString(transform),
    };
  }, [transform]);

  const daysInStage = getDaysInStage(deal.stage_entered_at);
  const prospectName = getProspectName(deal);

  const thresholds = getStageThresholds(deal.stage?.slug);
  const daysColor =
    daysInStage > thresholds.danger
      ? "text-red-600 bg-red-50"
      : daysInStage > thresholds.warn
        ? "text-orange-600 bg-orange-50"
        : "text-muted-foreground bg-muted";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`touch-none ${
        isDragging ? "opacity-30 z-50" : ""
      } ${isDragOverlay ? "shadow-xl" : ""}`}
    >
      <Card
        className={`py-3 gap-2 transition-all ${
          isDragOverlay
            ? "shadow-xl ring-2 ring-primary/20 cursor-grabbing"
            : "cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5"
        }`}
        onClick={(e) => {
          if (isDragging || isDragOverlay) return;
          const target = e.target as HTMLElement;
          if (target.closest("[data-drag-handle]")) return;
          if (deal.prospect_id) {
            router.push(`/prospects/${deal.prospect_id}`);
          } else {
            router.push(`/deals/${deal.id}`);
          }
        }}
      >
        <CardContent className="px-3 py-0 space-y-2">
          {/* Drag handle + title row */}
          <div className="flex items-start gap-1.5">
            <button
              data-drag-handle
              className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
              aria-label="Deplacer"
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

          {/* Contact type badge */}
          {deal.prospect?.contact_type && deal.prospect.contact_type !== "prospect" && (() => {
            const ct = deal.prospect!.contact_type as keyof typeof CONTACT_TYPES;
            const config = CONTACT_TYPES[ct];
            if (!config) return null;
            return (
              <Badge variant="secondary" className={`text-[10px] w-fit ${config.textColor} ${config.bgLight}`}>
                {config.label}
              </Badge>
            );
          })()}

          {/* Email count indicator */}
          {(deal.email_count ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-blue-600">
              <Mail className="size-2.5" />
              <span>{deal.email_count} email{(deal.email_count ?? 0) > 1 ? "s" : ""}</span>
            </div>
          )}

          {/* Last contact + Days in stage */}
          <div className="flex items-center justify-between gap-1 flex-wrap">
            {deal.prospect?.last_contacted_at ? (
              <span className={`text-[10px] flex items-center gap-0.5 ${getLastContactColor(deal.prospect.last_contacted_at)}`}>
                <Mail className="size-2.5" />
                {formatRelativeDate(deal.prospect.last_contacted_at)}
              </span>
            ) : (
              <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                <Mail className="size-2.5" />
                Jamais contacte
              </span>
            )}
            <Badge variant="secondary" className={`text-[10px] ${daysColor}`}>
              <Calendar className="size-2.5" />
              {daysInStage}j
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
