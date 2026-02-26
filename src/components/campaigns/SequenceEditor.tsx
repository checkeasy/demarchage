"use client";

import React, { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail,
  Clock,
  UserPlus,
  MessageSquare,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { STEP_TYPES } from "@/lib/constants";
import { StepEditor } from "./StepEditor";
import { cn } from "@/lib/utils";
import type { StepData } from "./types";

export type { StepData };

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  delay: Clock,
  linkedin_connect: UserPlus,
  linkedin_message: MessageSquare,
  condition: Clock,
};

const STEP_COLORS: Record<string, string> = {
  email: "border-l-blue-500 bg-blue-50/50",
  delay: "border-l-amber-500 bg-amber-50/50",
  linkedin_connect: "border-l-sky-500 bg-sky-50/50",
  linkedin_message: "border-l-sky-500 bg-sky-50/50",
  condition: "border-l-purple-500 bg-purple-50/50",
};

const ICON_COLORS: Record<string, string> = {
  email: "text-blue-600 bg-blue-100",
  delay: "text-amber-600 bg-amber-100",
  linkedin_connect: "text-sky-600 bg-sky-100",
  linkedin_message: "text-sky-600 bg-sky-100",
  condition: "text-purple-600 bg-purple-100",
};

const ADD_STEP_OPTIONS: {
  type: StepData["step_type"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "email", label: "Email", icon: Mail },
  { type: "delay", label: "Delai", icon: Clock },
  { type: "linkedin_connect", label: "LinkedIn Connexion", icon: UserPlus },
  { type: "linkedin_message", label: "LinkedIn Message", icon: MessageSquare },
];

let stepIdCounter = 0;
function generateStepId(): string {
  stepIdCounter += 1;
  return `step_${Date.now()}_${stepIdCounter}`;
}

function createDefaultStep(
  type: StepData["step_type"],
  order: number
): StepData {
  return {
    id: generateStepId(),
    step_order: order,
    step_type: type,
    delay_days: type === "delay" ? 1 : 0,
    delay_hours: 0,
    subject: type === "email" ? "" : null,
    body_html: type === "email" ? "" : null,
    body_text: type === "email" ? "" : null,
    linkedin_message:
      type === "linkedin_connect" || type === "linkedin_message" ? "" : null,
    ab_enabled: false,
  };
}

function getStepSummary(step: StepData): string {
  switch (step.step_type) {
    case "email":
      return step.subject || "Email sans objet";
    case "delay": {
      const parts: string[] = [];
      if (step.delay_days > 0)
        parts.push(`${step.delay_days} jour${step.delay_days > 1 ? "s" : ""}`);
      if (step.delay_hours > 0)
        parts.push(
          `${step.delay_hours} heure${step.delay_hours > 1 ? "s" : ""}`
        );
      return parts.length > 0
        ? `Attendre ${parts.join(" et ")}`
        : "Delai non configure";
    }
    case "linkedin_connect":
      return step.linkedin_message
        ? `Connexion: ${step.linkedin_message.slice(0, 50)}...`
        : "Demande de connexion";
    case "linkedin_message":
      return step.linkedin_message
        ? step.linkedin_message.slice(0, 60) + "..."
        : "Message LinkedIn";
    default:
      return "Etape";
  }
}

interface SequenceEditorProps {
  steps: StepData[];
  onChange: (steps: StepData[]) => void;
  readOnly?: boolean;
}

export function SequenceEditor({
  steps,
  onChange,
  readOnly = false,
}: SequenceEditorProps) {
  const [editingStep, setEditingStep] = useState<StepData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addMenuIndex, setAddMenuIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = steps.findIndex((s) => s.id === active.id);
        const newIndex = steps.findIndex((s) => s.id === over.id);
        const newSteps = arrayMove(steps, oldIndex, newIndex).map(
          (s, idx) => ({
            ...s,
            step_order: idx + 1,
          })
        );
        onChange(newSteps);
      }
    },
    [steps, onChange]
  );

  const addStep = useCallback(
    (type: StepData["step_type"], atIndex: number) => {
      const newStep = createDefaultStep(type, atIndex + 1);
      const newSteps = [...steps];
      newSteps.splice(atIndex, 0, newStep);
      const reordered = newSteps.map((s, idx) => ({
        ...s,
        step_order: idx + 1,
      }));
      onChange(reordered);
      setAddMenuIndex(null);
      // Open editor for new step
      setEditingStep(newStep);
      setSheetOpen(true);
    },
    [steps, onChange]
  );

  const removeStep = useCallback(
    (stepId: string) => {
      const newSteps = steps
        .filter((s) => s.id !== stepId)
        .map((s, idx) => ({ ...s, step_order: idx + 1 }));
      onChange(newSteps);
    },
    [steps, onChange]
  );

  const handleStepClick = useCallback((step: StepData) => {
    setEditingStep(step);
    setSheetOpen(true);
  }, []);

  const handleStepSave = useCallback(
    (updatedStep: StepData) => {
      const newSteps = steps.map((s) =>
        s.id === updatedStep.id ? updatedStep : s
      );
      onChange(newSteps);
      setSheetOpen(false);
      setEditingStep(null);
    },
    [steps, onChange]
  );

  return (
    <div className="space-y-1">
      {steps.length === 0 && !readOnly && (
        <div className="text-center py-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            Aucune etape dans la sequence. Ajoutez votre premiere etape.
          </p>
          <AddStepMenu
            onSelect={(type) => addStep(type, 0)}
            open={true}
            onToggle={() => {}}
            alwaysOpen
          />
        </div>
      )}

      {steps.length === 0 && readOnly && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            Aucune etape dans cette sequence.
          </p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={steps.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              {/* Add button before first step */}
              {index === 0 && !readOnly && (
                <AddStepButton
                  open={addMenuIndex === 0}
                  onToggle={() =>
                    setAddMenuIndex(addMenuIndex === 0 ? null : 0)
                  }
                  onSelect={(type) => addStep(type, 0)}
                />
              )}

              <SortableStepCard
                step={step}
                index={index}
                onClick={() => handleStepClick(step)}
                onDelete={() => removeStep(step.id)}
                readOnly={readOnly}
              />

              {/* Add button after each step */}
              {!readOnly && (
                <AddStepButton
                  open={addMenuIndex === index + 1}
                  onToggle={() =>
                    setAddMenuIndex(
                      addMenuIndex === index + 1 ? null : index + 1
                    )
                  }
                  onSelect={(type) => addStep(type, index + 1)}
                />
              )}
            </React.Fragment>
          ))}
        </SortableContext>
      </DndContext>

      {/* Step Editor Sheet */}
      {!readOnly && (
        <StepEditor
          step={editingStep}
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) setEditingStep(null);
          }}
          onSave={handleStepSave}
        />
      )}
    </div>
  );
}

// --- Sortable Step Card ---
function SortableStepCard({
  step,
  index,
  onClick,
  onDelete,
  readOnly,
}: {
  step: StepData;
  index: number;
  onClick: () => void;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = STEP_ICONS[step.step_type] ?? Clock;
  const colorClass = STEP_COLORS[step.step_type] ?? "border-l-gray-400";
  const iconColorClass = ICON_COLORS[step.step_type] ?? "text-gray-600 bg-gray-100";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isDragging && "z-50 opacity-90"
      )}
    >
      {/* Timeline connector line */}
      {index > 0 && (
        <div className="flex justify-center -mt-1 mb-0">
          <div className="w-0.5 h-3 bg-slate-300" />
        </div>
      )}

      <Card
        className={cn(
          "border-l-4 cursor-pointer transition-all hover:shadow-md",
          colorClass,
          isDragging && "shadow-lg ring-2 ring-blue-200"
        )}
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            {/* Drag handle */}
            {!readOnly && (
              <button
                className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="size-4" />
              </button>
            )}

            {/* Step number + icon */}
            <div
              className={cn(
                "flex items-center justify-center size-8 rounded-lg shrink-0",
                iconColorClass
              )}
            >
              <Icon className="size-4" />
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Etape {index + 1}
                </span>
                <span className="text-xs text-muted-foreground">
                  {STEP_TYPES[step.step_type]?.label}
                </span>
              </div>
              <p className="text-sm truncate mt-0.5">{getStepSummary(step)}</p>
            </div>

            {/* Delete button */}
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Add Step Button ---
function AddStepButton({
  open,
  onToggle,
  onSelect,
}: {
  open: boolean;
  onToggle: () => void;
  onSelect: (type: StepData["step_type"]) => void;
}) {
  return (
    <div className="flex flex-col items-center py-1">
      {/* Connector line */}
      <div className="w-0.5 h-2 bg-slate-300" />

      {/* Add button */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 rounded-full border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-blue-400 hover:bg-blue-50"
        onClick={onToggle}
      >
        <Plus className="size-3.5 mr-1" />
        Ajouter
      </Button>

      {/* Menu */}
      {open && <AddStepMenu onSelect={onSelect} open={open} onToggle={onToggle} />}

      {/* Connector line */}
      <div className="w-0.5 h-2 bg-slate-300" />
    </div>
  );
}

// --- Add Step Menu ---
function AddStepMenu({
  onSelect,
  open,
  onToggle,
  alwaysOpen = false,
}: {
  onSelect: (type: StepData["step_type"]) => void;
  open: boolean;
  onToggle: () => void;
  alwaysOpen?: boolean;
}) {
  if (!open && !alwaysOpen) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2 py-2 px-4">
      {ADD_STEP_OPTIONS.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.type}
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onSelect(option.type)}
          >
            <Icon className="size-3.5" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
