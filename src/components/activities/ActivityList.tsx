"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityItem } from "@/components/activities/ActivityItem";
import { AddActivityDialog } from "@/components/activities/AddActivityDialog";
import type { Activity } from "@/lib/types/crm";

interface DealOption {
  id: string;
  title: string;
}

interface ProspectOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface ActivityListProps {
  activities: Activity[];
  deals: DealOption[];
  prospects: ProspectOption[];
}

interface SectionConfig {
  key: string;
  label: string;
  headerClass: string;
  badgeClass: string;
  defaultCollapsed?: boolean;
}

const SECTIONS: SectionConfig[] = [
  {
    key: "overdue",
    label: "En retard",
    headerClass: "text-red-700",
    badgeClass: "bg-red-100 text-red-700",
  },
  {
    key: "today",
    label: "Aujourd'hui",
    headerClass: "text-blue-700",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  {
    key: "week",
    label: "Cette semaine",
    headerClass: "text-slate-900",
    badgeClass: "bg-slate-100 text-slate-700",
  },
  {
    key: "later",
    label: "Plus tard",
    headerClass: "text-slate-500",
    badgeClass: "bg-slate-100 text-slate-500",
  },
  {
    key: "done",
    label: "Terminees aujourd'hui",
    headerClass: "text-green-700",
    badgeClass: "bg-green-100 text-green-700",
    defaultCollapsed: true,
  },
];

export function ActivityList({
  activities: initialActivities,
  deals,
  prospects,
}: ActivityListProps) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(
      SECTIONS.filter((s) => s.defaultCollapsed).map((s) => s.key)
    )
  );

  function toggleSection(key: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // Group activities into sections
  const grouped = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // End of this week (Sunday)
    const endOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday + 1);

    const groups: Record<string, Activity[]> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
      done: [],
    };

    for (const a of activities) {
      // Done activities for today
      if (a.is_done) {
        if (a.done_at) {
          const doneDate = new Date(a.done_at);
          if (doneDate >= today) {
            groups.done.push(a);
          }
        }
        continue;
      }

      // Active activities grouped by due date
      if (!a.due_date) {
        groups.later.push(a);
        continue;
      }

      const dueDate = new Date(a.due_date);

      if (dueDate < today) {
        groups.overdue.push(a);
      } else if (dueDate >= today && dueDate < tomorrow) {
        groups.today.push(a);
      } else if (dueDate >= tomorrow && dueDate < endOfWeek) {
        groups.week.push(a);
      } else {
        groups.later.push(a);
      }
    }

    return groups;
  }, [activities]);

  const handleToggleDone = useCallback(
    (id: string, isDone: boolean) => {
      setActivities((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                is_done: isDone,
                done_at: isDone ? new Date().toISOString() : null,
              }
            : a
        )
      );
      // Refresh server data after a short delay to avoid jarring UI
      setTimeout(() => router.refresh(), 500);
    },
    [router]
  );

  const totalPending =
    grouped.overdue.length +
    grouped.today.length +
    grouped.week.length +
    grouped.later.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Activites</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalPending} activite{totalPending !== 1 ? "s" : ""} en cours
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nouvelle activite
        </Button>
      </div>

      {/* Empty state */}
      {totalPending === 0 && grouped.done.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Aucune activite</p>
          <p className="text-sm mt-1">
            Creez votre premiere activite pour commencer a suivre vos taches.
          </p>
        </div>
      )}

      {/* Sections */}
      {SECTIONS.map((section) => {
        const items = grouped[section.key] || [];
        if (items.length === 0) return null;

        const isCollapsed = collapsedSections.has(section.key);

        return (
          <div
            key={section.key}
            className="border rounded-lg bg-white overflow-hidden"
          >
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="size-4 text-slate-400" />
              ) : (
                <ChevronDown className="size-4 text-slate-400" />
              )}
              <span className={`text-sm font-semibold ${section.headerClass}`}>
                {section.label}
              </span>
              <Badge
                variant="secondary"
                className={`text-xs ${section.badgeClass}`}
              >
                {items.length}
              </Badge>
            </button>

            {/* Section items */}
            {!isCollapsed && (
              <div>
                {items.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    onToggleDone={handleToggleDone}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Activity Dialog */}
      <AddActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deals={deals}
        prospects={prospects}
      />
    </div>
  );
}
