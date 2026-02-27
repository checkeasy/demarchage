"use client";

import { useState, useId, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";

import { DealKanbanColumn } from "@/components/deals/DealKanbanColumn";
import { DealKanbanCard } from "@/components/deals/DealKanbanCard";
import { AddDealDialog } from "@/components/deals/AddDealDialog";
import type { Deal, PipelineStageConfig } from "@/lib/types/crm";

interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
}

interface DealKanbanBoardProps {
  stages: PipelineStageConfig[];
  deals: Deal[];
  prospects: Prospect[];
}

export function DealKanbanBoard({
  stages,
  deals: initialDeals,
  prospects,
}: DealKanbanBoardProps) {
  const router = useRouter();
  const dndId = useId();

  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [defaultStageId, setDefaultStageId] = useState<string>("");

  // Group deals by stage_id
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    for (const stage of stages) {
      grouped[stage.id] = [];
    }
    for (const deal of deals) {
      if (grouped[deal.stage_id]) {
        grouped[deal.stage_id].push(deal);
      }
    }
    return grouped;
  }, [deals, stages]);

  // Configure pointer sensor with activation constraint to allow click-through
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const dealId = event.active.id as string;
      const deal = deals.find((d) => d.id === dealId);
      if (deal) setActiveDeal(deal);
    },
    [deals]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDeal(null);

      const { active, over } = event;
      if (!over) return;

      const dealId = active.id as string;
      const newStageId = over.id as string;

      // Find the deal being moved
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) return;

      // Skip if dropped on same stage
      if (deal.stage_id === newStageId) return;

      // Optimistic update
      const previousDeals = [...deals];
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                stage_id: newStageId,
                stage_entered_at: new Date().toISOString(),
              }
            : d
        )
      );

      try {
        const res = await fetch(`/api/deals/${dealId}/move`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage_id: newStageId }),
        });

        if (!res.ok) {
          throw new Error("Erreur lors du deplacement");
        }

        const data = await res.json();
        // Update the deal with server response (may include status changes)
        setDeals((prev) =>
          prev.map((d) => (d.id === dealId ? data.deal : d))
        );

        const targetStage = stages.find((s) => s.id === newStageId);
        toast.success(
          `Deal deplace vers "${targetStage?.name || "nouvelle etape"}"`
        );
      } catch {
        // Rollback on error
        setDeals(previousDeals);
        toast.error("Erreur lors du deplacement du deal");
      }
    },
    [deals, stages]
  );

  const handleAddDeal = useCallback((stageId: string) => {
    setDefaultStageId(stageId);
    setAddDialogOpen(true);
  }, []);

  // Sync deals when page data changes (e.g., after router.refresh())
  // This is needed because we use local state for optimistic updates
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex overflow-x-auto gap-4 pb-4 min-h-[500px]">
          {stages.map((stage) => (
            <DealKanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onAddDeal={handleAddDeal}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? <DealKanbanCard deal={activeDeal} /> : null}
        </DragOverlay>
      </DndContext>

      <AddDealDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            // Refresh to get updated data after adding
            router.refresh();
          }
        }}
        stages={stages}
        prospects={prospects}
        defaultStageId={defaultStageId}
      />
    </>
  );
}
