"use client";

import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealKanbanBoard } from "@/components/deals/DealKanbanBoard";
import { DealListView } from "@/components/deals/DealListView";
import type { Deal, PipelineStageConfig } from "@/lib/types/crm";

interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
}

interface DealsViewToggleProps {
  stages: PipelineStageConfig[];
  deals: Deal[];
  prospects: Prospect[];
}

export function DealsViewToggle({
  stages,
  deals,
  prospects,
}: DealsViewToggleProps) {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex items-center rounded-lg border p-0.5 gap-0.5">
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2.5 gap-1.5"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="size-3.5" />
            <span className="hidden sm:inline text-xs">Kanban</span>
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2.5 gap-1.5"
            onClick={() => setView("list")}
          >
            <List className="size-3.5" />
            <span className="hidden sm:inline text-xs">Liste</span>
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <DealKanbanBoard stages={stages} deals={deals} prospects={prospects} />
      ) : (
        <DealListView stages={stages} deals={deals} />
      )}
    </div>
  );
}
