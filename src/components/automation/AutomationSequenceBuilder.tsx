"use client";

import { useState } from "react";
import {
  Eye,
  UserPlus,
  MessageSquare,
  Mail,
  Clock,
  GitBranch,
  Sparkles,
  GripVertical,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export type StepType =
  | "view_profile"
  | "connect"
  | "message"
  | "email"
  | "wait"
  | "condition";

export interface SequenceStep {
  id: string;
  type: StepType;
  delayDays: number;
  label: string;
  message: string;
  conditionType?: string;
  expanded: boolean;
}

const STEP_CONFIG: Record<
  StepType,
  { icon: React.ElementType; label: string; color: string; bgColor: string }
> = {
  view_profile: {
    icon: Eye,
    label: "Voir le profil",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
  connect: {
    icon: UserPlus,
    label: "Demande de connexion",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  message: {
    icon: MessageSquare,
    label: "Envoyer un message",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  email: {
    icon: Mail,
    label: "Envoyer un email",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  wait: {
    icon: Clock,
    label: "Attendre",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  condition: {
    icon: GitBranch,
    label: "Condition",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
};

const DEFAULT_STEPS: SequenceStep[] = [
  {
    id: "step-1",
    type: "view_profile",
    delayDays: 0,
    label: "Voir le profil LinkedIn",
    message: "",
    expanded: false,
  },
  {
    id: "step-2",
    type: "connect",
    delayDays: 1,
    label: "Demande de connexion",
    message:
      "Bonjour {prenom}, j'ai decouvert votre profil et je serais ravi d'echanger avec vous. Cordialement.",
    expanded: false,
  },
  {
    id: "step-3",
    type: "condition",
    delayDays: 3,
    label: "Si connecte",
    message: "",
    conditionType: "connected",
    expanded: false,
  },
  {
    id: "step-4",
    type: "message",
    delayDays: 0,
    label: "Message de presentation",
    message:
      "Merci d'avoir accepte ma demande, {prenom}. Je me permets de vous contacter car CheckEasy pourrait vous aider a simplifier vos processus. Seriez-vous disponible pour un echange rapide ?",
    expanded: false,
  },
  {
    id: "step-5",
    type: "message",
    delayDays: 5,
    label: "Follow-up si pas de reponse",
    message:
      "Bonjour {prenom}, je me permets de relancer mon message precedent. Je serais vraiment interesse par votre retour. Bonne journee !",
    expanded: false,
  },
  {
    id: "step-6",
    type: "email",
    delayDays: 7,
    label: "Email si adresse disponible",
    message:
      "Bonjour {prenom},\n\nJe me permets de vous contacter par email suite a notre echange sur LinkedIn.\n\nCheckEasy aide les entreprises comme {entreprise} a simplifier leurs processus de verification.\n\nSeriez-vous disponible pour un appel de 15 minutes cette semaine ?\n\nCordialement",
    expanded: false,
  },
];

interface AutomationSequenceBuilderProps {
  steps: SequenceStep[];
  onStepsChange: (steps: SequenceStep[]) => void;
  onGenerateAI: (stepId: string) => void;
  isGenerating: string | null;
}

export function AutomationSequenceBuilder({
  steps,
  onStepsChange,
  onGenerateAI,
  isGenerating,
}: AutomationSequenceBuilderProps) {
  function toggleExpand(stepId: string) {
    onStepsChange(
      steps.map((s) =>
        s.id === stepId ? { ...s, expanded: !s.expanded } : s
      )
    );
  }

  function updateStep(stepId: string, updates: Partial<SequenceStep>) {
    onStepsChange(
      steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
    );
  }

  function removeStep(stepId: string) {
    onStepsChange(steps.filter((s) => s.id !== stepId));
  }

  function addStep() {
    const newStep: SequenceStep = {
      id: `step-${Date.now()}`,
      type: "message",
      delayDays: 2,
      label: "Nouvelle etape",
      message: "",
      expanded: true,
    };
    onStepsChange([...steps, newStep]);
  }

  function moveStep(index: number, direction: "up" | "down") {
    const newSteps = [...steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [
      newSteps[targetIndex],
      newSteps[index],
    ];
    onStepsChange(newSteps);
  }

  return (
    <div className="space-y-3">
      {/* Timeline */}
      <div className="relative">
        {steps.map((step, index) => {
          const config = STEP_CONFIG[step.type];
          const Icon = config.icon;
          const hasMessageField =
            step.type === "connect" ||
            step.type === "message" ||
            step.type === "email";

          return (
            <div key={step.id} className="relative flex gap-4">
              {/* Timeline line */}
              {index < steps.length - 1 && (
                <div className="absolute left-[23px] top-12 bottom-0 w-px bg-slate-200" />
              )}

              {/* Timeline dot */}
              <div className="relative z-10 shrink-0">
                <div
                  className={`flex items-center justify-center size-12 rounded-full ${config.bgColor} border-2 border-white shadow-sm`}
                >
                  <Icon className={`size-5 ${config.color}`} />
                </div>
              </div>

              {/* Step content */}
              <Card className="flex-1 mb-3">
                <CardContent className="pt-0">
                  {/* Step header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-900">
                            {step.label}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            Jour {step.delayDays}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {config.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Reorder buttons */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        onClick={() => moveStep(index, "up")}
                        disabled={index === 0}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        onClick={() => moveStep(index, "down")}
                        disabled={index === steps.length - 1}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        onClick={() => toggleExpand(step.id)}
                      >
                        <GripVertical className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => removeStep(step.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Message preview (collapsed) */}
                  {!step.expanded && hasMessageField && step.message && (
                    <p
                      className="text-xs text-muted-foreground mt-2 line-clamp-2 cursor-pointer"
                      onClick={() => toggleExpand(step.id)}
                    >
                      {step.message}
                    </p>
                  )}

                  {/* Expanded form */}
                  {step.expanded && (
                    <div className="mt-4 space-y-3 border-t pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Type d&apos;etape</Label>
                          <Select
                            value={step.type}
                            onValueChange={(value: StepType) =>
                              updateStep(step.id, { type: value })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view_profile">
                                Voir le profil
                              </SelectItem>
                              <SelectItem value="connect">
                                Demande de connexion
                              </SelectItem>
                              <SelectItem value="message">
                                Envoyer un message
                              </SelectItem>
                              <SelectItem value="email">
                                Envoyer un email
                              </SelectItem>
                              <SelectItem value="wait">Attendre</SelectItem>
                              <SelectItem value="condition">
                                Condition
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            Delai (jours depuis le debut)
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={step.delayDays}
                            onChange={(e) =>
                              updateStep(step.id, {
                                delayDays: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Nom de l&apos;etape</Label>
                        <Input
                          value={step.label}
                          onChange={(e) =>
                            updateStep(step.id, { label: e.target.value })
                          }
                          placeholder="Nom de l'etape"
                        />
                      </div>

                      {hasMessageField && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Message</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onGenerateAI(step.id)}
                              disabled={isGenerating === step.id}
                              className="h-7 text-xs"
                            >
                              {isGenerating === step.id ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="size-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                                  Generation...
                                </div>
                              ) : (
                                <>
                                  <Sparkles className="size-3" />
                                  Generer avec IA
                                </>
                              )}
                            </Button>
                          </div>
                          <Textarea
                            value={step.message}
                            onChange={(e) =>
                              updateStep(step.id, { message: e.target.value })
                            }
                            placeholder="Ecrivez votre message ou generez-le avec l'IA..."
                            className="min-h-[100px]"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Variables disponibles : {"{prenom}"}, {"{nom}"},{" "}
                            {"{entreprise}"}, {"{poste}"}, {"{secteur}"}
                          </p>
                        </div>
                      )}

                      {step.type === "condition" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Type de condition</Label>
                          <Select
                            value={step.conditionType || "connected"}
                            onValueChange={(value) =>
                              updateStep(step.id, { conditionType: value })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="connected">
                                Si connecte
                              </SelectItem>
                              <SelectItem value="replied">
                                Si a repondu
                              </SelectItem>
                              <SelectItem value="no_reply">
                                Si pas de reponse
                              </SelectItem>
                              <SelectItem value="email_available">
                                Si email disponible
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Add step button */}
      <Button
        variant="outline"
        onClick={addStep}
        className="w-full border-dashed"
      >
        <Plus className="size-4" />
        Ajouter une etape
      </Button>
    </div>
  );
}

export { DEFAULT_STEPS };
