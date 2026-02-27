"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DealKanbanCard } from "@/components/deals/DealKanbanCard";
import type { Deal, PipelineStageConfig } from "@/lib/types/crm";

interface DealKanbanColumnProps {
  stage: PipelineStageConfig;
  deals: Deal[];
  onAddDeal: (stageId: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function DealKanbanColumn({
  stage,
  deals,
  onAddDeal,
}: DealKanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  const totalValue = useMemo(
    () => deals.reduce((sum, d) => sum + (d.value || 0), 0),
    [deals]
  );

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[300px] shrink-0 rounded-lg bg-muted/40 border transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-transparent"
      }`}
    >
      {/* Column header */}
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="text-sm font-semibold truncate">{stage.name}</h3>
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
              {deals.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={() => onAddDeal(stage.id)}
          >
            <Plus className="size-4" />
            <span className="sr-only">Ajouter un deal</span>
          </Button>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-muted-foreground font-medium">
            {formatCurrency(totalValue)}
          </p>
        )}
      </div>

      {/* Column body - scrollable list of cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[100px]">
        {deals.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic">
            Aucun deal
          </div>
        ) : (
          deals.map((deal) => <DealKanbanCard key={deal.id} deal={deal} />)
        )}
      </div>
    </div>
  );
}
