"use client";

import { useState, useId, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  rectIntersection,
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
  const searchParams = useSearchParams();
  const dndId = useId();

  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(searchParams.get("action") === "add");
  const [defaultStageId, setDefaultStageId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Sensors: pointer with distance constraint + touch for mobile
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 5,
    },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const dealId = event.active.id as string;
      const deal = deals.find((d) => d.id === dealId);
      if (deal) {
        setActiveDeal(deal);
        setOverColumnId(deal.stage_id);
      }
    },
    [deals]
  );

  // Track which column we're hovering over during drag
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) {
        setOverColumnId(null);
        return;
      }

      // Check if we're over a column (droppable) or a card (draggable)
      const overId = over.id as string;
      // If overId matches a stage, it's a column
      const isColumn = stages.some((s) => s.id === overId);
      if (isColumn) {
        setOverColumnId(overId);
      } else {
        // Over a card - find which column this card belongs to
        const overDeal = deals.find((d) => d.id === overId);
        if (overDeal) {
          setOverColumnId(overDeal.stage_id);
        }
      }
    },
    [stages, deals]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDeal(null);
      setOverColumnId(null);

      if (!over) return;

      const dealId = active.id as string;
      const overId = over.id as string;

      // Determine the target stage: could be a column ID or a card ID
      let newStageId: string;
      const isColumn = stages.some((s) => s.id === overId);
      if (isColumn) {
        newStageId = overId;
      } else {
        // Dropped on a card - find its stage
        const overDeal = deals.find((d) => d.id === overId);
        if (!overDeal) return;
        newStageId = overDeal.stage_id;
      }

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
        setDeals((prev) =>
          prev.map((d) => (d.id === dealId ? data.deal : d))
        );

        const targetStage = stages.find((s) => s.id === newStageId);
        toast.success(
          `Deal deplace vers "${targetStage?.name || "nouvelle etape"}"`
        );
      } catch {
        setDeals(previousDeals);
        toast.error("Erreur lors du deplacement du deal");
      }
    },
    [deals, stages]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDeal(null);
    setOverColumnId(null);
  }, []);

  const handleAddDeal = useCallback((stageId: string) => {
    setDefaultStageId(stageId);
    setAddDialogOpen(true);
  }, []);

  // Sync deals when page data changes
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  // Auto-scroll horizontally when dragging near edges
  useEffect(() => {
    if (!activeDeal || !scrollRef.current) return;

    const scrollEl = scrollRef.current;

    function handlePointerMove(e: PointerEvent) {
      const rect = scrollEl.getBoundingClientRect();
      const edgeZone = 80;
      const speed = 12;

      if (e.clientX < rect.left + edgeZone) {
        scrollEl.scrollLeft -= speed;
      } else if (e.clientX > rect.right - edgeZone) {
        scrollEl.scrollLeft += speed;
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [activeDeal]);

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-4 pb-4 min-h-[calc(100vh-220px)]"
        >
          {stages.map((stage) => (
            <DealKanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onAddDeal={handleAddDeal}
              isOver={overColumnId === stage.id && activeDeal?.stage_id !== stage.id}
            />
          ))}
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}
        >
          {activeDeal ? (
            <div className="rotate-2 scale-105">
              <DealKanbanCard deal={activeDeal} isDragOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddDealDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
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
