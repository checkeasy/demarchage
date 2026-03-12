"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  Calendar as CalendarIcon,
  Mail,
  CheckSquare,
  RefreshCw,
  Monitor,
  List,
  CalendarDays,
  Clock,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddActivityDialog } from "@/components/activities/AddActivityDialog";
import { ActivityList } from "@/components/activities/ActivityList";
import { ACTIVITY_TYPES, ACTIVITY_PRIORITIES } from "@/lib/constants";
import type { Activity } from "@/lib/types/crm";

// ─── Types ─────────────────────────────────────────────────────────────────

type ViewMode = "day" | "week" | "month" | "list";

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

interface ActivityCalendarProps {
  activities: Activity[];
  deals: DealOption[];
  prospects: ProspectOption[];
}

// ─── Icon Map ───────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone,
  Calendar: CalendarIcon,
  Mail,
  CheckSquare,
  RefreshCw,
  Monitor,
};

// ─── Date Helpers ───────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const startStr = start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const endStr = end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return `${startStr} - ${endStr}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from Monday before first day of month
  const start = getMonday(firstDay);

  // Fill until we have at least all days of the month + complete last week
  const current = new Date(start);
  while (current <= lastDay || current.getDay() !== 1) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
    if (days.length > 42) break; // Max 6 weeks
  }

  return days;
}

function getWeekDays(monday: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h to 20h

const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// ─── Activity Card (compact) ────────────────────────────────────────────────

function ActivityCard({
  activity,
  compact = false,
  onToggleDone,
}: {
  activity: Activity;
  compact?: boolean;
  onToggleDone: (id: string, isDone: boolean) => void;
}) {
  const typeConfig = ACTIVITY_TYPES[activity.activity_type as keyof typeof ACTIVITY_TYPES];
  const IconComponent = typeConfig ? ICON_MAP[typeConfig.icon] : CheckSquare;
  const isOverdue =
    !activity.is_done &&
    activity.due_date &&
    new Date(activity.due_date) < new Date() &&
    !isSameDay(new Date(activity.due_date), new Date());

  async function handleToggle() {
    const newDone = !activity.is_done;
    onToggleDone(activity.id, newDone);

    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done: newDone }),
      });
      if (!res.ok) {
        onToggleDone(activity.id, !newDone);
        toast.error("Erreur lors de la mise a jour");
        return;
      }
      toast.success(newDone ? "Activite terminee" : "Activite reactivee");
    } catch {
      onToggleDone(activity.id, !newDone);
      toast.error("Erreur de connexion");
    }
  }

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`group flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-default truncate ${
                activity.is_done
                  ? "bg-slate-100 text-slate-400 line-through"
                  : isOverdue
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : `${typeConfig?.bgColor || "bg-slate-50"} ${typeConfig?.color || "text-slate-600"} border border-transparent`
              }`}
            >
              <Checkbox
                checked={activity.is_done}
                onCheckedChange={handleToggle}
                className="size-3 shrink-0"
              />
              {IconComponent && <IconComponent className="size-3 shrink-0" />}
              <span className="truncate">{activity.title}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{activity.title}</p>
              {activity.due_date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(activity.due_date).toLocaleString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {activity.prospect && (
                <p className="text-xs">
                  {[activity.prospect.first_name, activity.prospect.last_name].filter(Boolean).join(" ") || activity.prospect.email}
                </p>
              )}
              {activity.deal && (
                <p className="text-xs text-blue-600">{activity.deal.title}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full card for day/week view
  return (
    <div
      className={`flex items-start gap-2 p-2 rounded-lg border text-sm transition-colors ${
        activity.is_done
          ? "bg-slate-50 border-slate-200 opacity-60"
          : isOverdue
          ? "bg-red-50 border-red-200"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      <Checkbox
        checked={activity.is_done}
        onCheckedChange={handleToggle}
        className="mt-0.5 shrink-0"
      />
      <div
        className={`flex items-center justify-center size-6 rounded shrink-0 ${
          typeConfig?.bgColor || "bg-slate-50"
        }`}
      >
        {IconComponent && (
          <IconComponent className={`size-3.5 ${typeConfig?.color || "text-slate-500"}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`font-medium truncate ${
            activity.is_done ? "line-through text-muted-foreground" : ""
          } ${activity.priority === "urgent" ? "text-red-700" : activity.priority === "high" ? "text-orange-700" : ""}`}
        >
          {activity.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {activity.due_date && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="size-3" />
              {new Date(activity.due_date).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {activity.duration_minutes && ` (${activity.duration_minutes}min)`}
            </span>
          )}
          {activity.priority !== "normal" && activity.priority !== "low" && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-1 py-0 ${
                activity.priority === "urgent"
                  ? "bg-red-100 text-red-700"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              {ACTIVITY_PRIORITIES[activity.priority]?.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {activity.prospect && (
            <Link
              href={`/prospects/${activity.prospect.id}`}
              className="text-xs text-muted-foreground hover:underline truncate"
            >
              {[activity.prospect.first_name, activity.prospect.last_name].filter(Boolean).join(" ") || activity.prospect.email}
            </Link>
          )}
          {activity.deal && (
            <Link
              href={`/deals/${activity.deal.id}`}
              className="text-xs text-blue-600 hover:underline truncate"
            >
              {activity.deal.title}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── No-date Activities Sidebar ─────────────────────────────────────────────

function NoDatActivities({
  activities,
  onToggleDone,
}: {
  activities: Activity[];
  onToggleDone: (id: string, isDone: boolean) => void;
}) {
  if (activities.length === 0) return null;

  return (
    <div className="border rounded-lg bg-amber-50/50 p-3 space-y-2">
      <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
        Sans date ({activities.length})
      </h4>
      <div className="space-y-1">
        {activities.slice(0, 10).map((a) => (
          <ActivityCard key={a.id} activity={a} compact onToggleDone={onToggleDone} />
        ))}
        {activities.length > 10 && (
          <p className="text-xs text-muted-foreground text-center">
            +{activities.length - 10} autres
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Month View ─────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  activitiesByDate,
  onToggleDone,
  onDayClick,
}: {
  currentDate: Date;
  activitiesByDate: Map<string, Activity[]>;
  onToggleDone: (id: string, isDone: boolean) => void;
  onDayClick: (date: Date) => void;
}) {
  const days = useMemo(
    () => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );
  const today = new Date();

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Day names header */}
      <div className="grid grid-cols-7 border-b bg-slate-50">
        {DAY_NAMES_SHORT.map((name) => (
          <div
            key={name}
            className="px-2 py-2 text-xs font-semibold text-slate-500 text-center"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const dayActivities = activitiesByDate.get(key) || [];
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = isSameDay(day, today);
          const pendingCount = dayActivities.filter((a) => !a.is_done).length;
          const doneCount = dayActivities.filter((a) => a.is_done).length;
          const hasOverdue = dayActivities.some(
            (a) => !a.is_done && day < today && !isSameDay(day, today)
          );

          return (
            <div
              key={i}
              className={`min-h-[110px] border-b border-r p-1 cursor-pointer transition-colors hover:bg-slate-50 ${
                !isCurrentMonth ? "bg-slate-50/50" : ""
              } ${isToday ? "bg-blue-50/50" : ""}`}
              onClick={() => onDayClick(day)}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    isToday
                      ? "bg-blue-600 text-white"
                      : !isCurrentMonth
                      ? "text-slate-300"
                      : hasOverdue
                      ? "text-red-600"
                      : "text-slate-700"
                  }`}
                >
                  {day.getDate()}
                </span>
                {pendingCount > 0 && (
                  <div className="flex items-center gap-0.5">
                    <span
                      className={`text-[10px] font-medium px-1 rounded ${
                        hasOverdue
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {pendingCount}
                    </span>
                    {doneCount > 0 && (
                      <span className="text-[10px] text-slate-400">
                        +{doneCount}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Activity pills */}
              <div className="space-y-0.5">
                {dayActivities
                  .filter((a) => !a.is_done)
                  .slice(0, 3)
                  .map((a) => (
                    <ActivityCard
                      key={a.id}
                      activity={a}
                      compact
                      onToggleDone={onToggleDone}
                    />
                  ))}
                {dayActivities.filter((a) => !a.is_done).length > 3 && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    +{dayActivities.filter((a) => !a.is_done).length - 3} autres
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ──────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  activitiesByDate,
  onToggleDone,
  onDayClick,
}: {
  currentDate: Date;
  activitiesByDate: Map<string, Activity[]>;
  onToggleDone: (id: string, isDone: boolean) => void;
  onDayClick: (date: Date) => void;
}) {
  const monday = getMonday(currentDate);
  const days = getWeekDays(monday);
  const today = new Date();

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b bg-slate-50">
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={i}
              className={`px-2 py-2 text-center border-r last:border-r-0 cursor-pointer hover:bg-slate-100 ${
                isToday ? "bg-blue-50" : ""
              }`}
              onClick={() => onDayClick(day)}
            >
              <div className="text-xs text-slate-500">{DAY_NAMES_SHORT[i]}</div>
              <div
                className={`text-lg font-semibold mt-0.5 ${
                  isToday ? "text-blue-600" : "text-slate-900"
                }`}
              >
                {day.getDate()}
              </div>
              <div className="text-[10px] text-slate-400">
                {day.toLocaleDateString("fr-FR", { month: "short" })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity columns */}
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((day, i) => {
          const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const dayActivities = activitiesByDate.get(key) || [];
          const isToday = isSameDay(day, today);

          return (
            <div
              key={i}
              className={`border-r last:border-r-0 p-1.5 space-y-1.5 ${
                isToday ? "bg-blue-50/30" : ""
              }`}
            >
              {dayActivities
                .sort((a, b) => {
                  // Done at bottom
                  if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
                  // By time
                  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
                  return 0;
                })
                .map((a) => (
                  <ActivityCard key={a.id} activity={a} onToggleDone={onToggleDone} />
                ))}
              {dayActivities.length === 0 && (
                <div className="flex items-center justify-center h-full text-xs text-slate-300">
                  -
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ───────────────────────────────────────────────────────────────

function DayView({
  currentDate,
  activitiesByDate,
  onToggleDone,
}: {
  currentDate: Date;
  activitiesByDate: Map<string, Activity[]>;
  onToggleDone: (id: string, isDone: boolean) => void;
}) {
  const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
  const dayActivities = activitiesByDate.get(key) || [];

  // Group by hour
  const byHour = useMemo(() => {
    const map = new Map<number, Activity[]>();
    const noTime: Activity[] = [];

    for (const a of dayActivities) {
      if (!a.due_date) {
        noTime.push(a);
        continue;
      }
      const d = new Date(a.due_date);
      const hour = d.getHours();
      const arr = map.get(hour) || [];
      arr.push(a);
      map.set(hour, arr);
    }

    return { map, noTime };
  }, [dayActivities]);

  const isToday = isSameDay(currentDate, new Date());
  const currentHour = new Date().getHours();

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* All-day / no-time activities */}
      {byHour.noTime.length > 0 && (
        <div className="border-b p-3 bg-slate-50">
          <h4 className="text-xs font-semibold text-slate-500 mb-2">Toute la journee</h4>
          <div className="space-y-1.5">
            {byHour.noTime.map((a) => (
              <ActivityCard key={a.id} activity={a} onToggleDone={onToggleDone} />
            ))}
          </div>
        </div>
      )}

      {/* Hourly timeline */}
      <div className="divide-y">
        {HOURS.map((hour) => {
          const hourActivities = byHour.map.get(hour) || [];
          const isCurrentHour = isToday && hour === currentHour;

          return (
            <div
              key={hour}
              className={`flex min-h-[60px] ${isCurrentHour ? "bg-blue-50/50" : ""}`}
            >
              {/* Hour label */}
              <div className="w-16 shrink-0 px-2 py-1.5 text-right border-r">
                <span
                  className={`text-xs font-medium ${
                    isCurrentHour ? "text-blue-600" : "text-slate-400"
                  }`}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>

              {/* Activities for this hour */}
              <div className="flex-1 p-1.5 space-y-1">
                {hourActivities.map((a) => (
                  <ActivityCard key={a.id} activity={a} onToggleDone={onToggleDone} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="border-t p-3 bg-slate-50 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {dayActivities.filter((a) => !a.is_done).length} activite(s) en cours
        </span>
        <span className="text-xs text-green-600">
          {dayActivities.filter((a) => a.is_done).length} terminee(s)
        </span>
      </div>
    </div>
  );
}

// ─── Main Calendar Component ────────────────────────────────────────────────

export function ActivityCalendar({
  activities: initialActivities,
  deals,
  prospects,
}: ActivityCalendarProps) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultDueDate, setDefaultDueDate] = useState<string>("");

  // Group activities by date key
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of activities) {
      if (!a.due_date) continue;
      const d = new Date(a.due_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = map.get(key) || [];
      arr.push(a);
      map.set(key, arr);
    }
    return map;
  }, [activities]);

  // Activities without a date
  const noDateActivities = useMemo(
    () => activities.filter((a) => !a.due_date && !a.is_done),
    [activities]
  );

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let overdue = 0;
    let todayCount = 0;
    let pending = 0;
    let done = 0;

    for (const a of activities) {
      if (a.is_done) {
        done++;
        continue;
      }
      pending++;
      if (a.due_date) {
        const d = new Date(a.due_date);
        const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (dDay < today) overdue++;
        else if (dDay.getTime() === today.getTime()) todayCount++;
      }
    }
    return { overdue, todayCount, pending, done };
  }, [activities]);

  const handleToggleDone = useCallback(
    (id: string, isDone: boolean) => {
      setActivities((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, is_done: isDone, done_at: isDone ? new Date().toISOString() : null }
            : a
        )
      );
      setTimeout(() => router.refresh(), 500);
    },
    [router]
  );

  // Navigation
  function navigate(direction: number) {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "month") {
        d.setMonth(d.getMonth() + direction);
      } else if (viewMode === "week") {
        d.setDate(d.getDate() + 7 * direction);
      } else if (viewMode === "day") {
        d.setDate(d.getDate() + direction);
      }
      return d;
    });
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function handleDayClick(date: Date) {
    setCurrentDate(date);
    setViewMode("day");
  }

  function handleAddOnDate(date?: Date) {
    if (date) {
      const d = new Date(date);
      d.setHours(9, 0, 0, 0);
      setDefaultDueDate(d.toISOString().slice(0, 16));
    } else {
      setDefaultDueDate("");
    }
    setDialogOpen(true);
  }

  // Title based on view mode
  const viewTitle = useMemo(() => {
    if (viewMode === "month") return formatMonthYear(currentDate);
    if (viewMode === "week") return formatWeekRange(getMonday(currentDate));
    if (viewMode === "day") return formatDayHeader(currentDate);
    return "Liste des activites";
  }, [viewMode, currentDate]);

  // If list mode, render the existing ActivityList
  if (viewMode === "list") {
    return (
      <div className="space-y-4">
        {/* Header with view toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Activites</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.pending} en cours
              {stats.overdue > 0 && (
                <span className="text-red-600 font-medium"> ({stats.overdue} en retard)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            <Button onClick={() => handleAddOnDate()}>
              <Plus className="size-4" />
              Nouvelle activite
            </Button>
          </div>
        </div>
        <ActivityList activities={activities} deals={deals} prospects={prospects} />
        <AddActivityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          deals={deals}
          prospects={prospects}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Activites</h2>
          <div className="flex items-center gap-3 mt-1 text-sm">
            {stats.overdue > 0 && (
              <span className="text-red-600 font-medium">
                {stats.overdue} en retard
              </span>
            )}
            {stats.todayCount > 0 && (
              <span className="text-blue-600 font-medium">
                {stats.todayCount} aujourd&apos;hui
              </span>
            )}
            <span className="text-muted-foreground">
              {stats.pending} en cours &middot; {stats.done} terminee(s)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <Button onClick={() => handleAddOnDate(viewMode === "day" ? currentDate : undefined)}>
            <Plus className="size-4" />
            Nouvelle activite
          </Button>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Aujourd&apos;hui
          </Button>
        </div>
        <h3 className="text-base font-semibold text-slate-900 capitalize">
          {viewTitle}
        </h3>
        <div className="w-24" /> {/* Spacer for centering */}
      </div>

      {/* Calendar view + no-date sidebar */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {viewMode === "month" && (
            <MonthView
              currentDate={currentDate}
              activitiesByDate={activitiesByDate}
              onToggleDone={handleToggleDone}
              onDayClick={handleDayClick}
            />
          )}
          {viewMode === "week" && (
            <WeekView
              currentDate={currentDate}
              activitiesByDate={activitiesByDate}
              onToggleDone={handleToggleDone}
              onDayClick={handleDayClick}
            />
          )}
          {viewMode === "day" && (
            <DayView
              currentDate={currentDate}
              activitiesByDate={activitiesByDate}
              onToggleDone={handleToggleDone}
            />
          )}
        </div>

        {/* No-date activities sidebar */}
        {noDateActivities.length > 0 && (
          <div className="w-56 shrink-0 hidden lg:block">
            <NoDatActivities
              activities={noDateActivities}
              onToggleDone={handleToggleDone}
            />
          </div>
        )}
      </div>

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

// ─── View Toggle ────────────────────────────────────────────────────────────

function ViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const views: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "day", icon: <CalendarDays className="size-4" />, label: "Jour" },
    { mode: "week", icon: <LayoutGrid className="size-4" />, label: "Semaine" },
    { mode: "month", icon: <CalendarIcon className="size-4" />, label: "Mois" },
    { mode: "list", icon: <List className="size-4" />, label: "Liste" },
  ];

  return (
    <div className="flex items-center border rounded-lg overflow-hidden bg-white">
      {views.map(({ mode, icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0 ${
            viewMode === mode
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
