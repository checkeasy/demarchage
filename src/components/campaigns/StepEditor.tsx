"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { EmailComposer } from "./EmailComposer";
import { STEP_TYPES } from "@/lib/constants";
import { Mail, Clock, UserPlus, MessageSquare, Phone, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { StepData } from "./types";

// Hook for template generation (no prospect needed)
function useTemplateGeneration() {
  const [isLoading, setIsLoading] = useState(false);

  const generate = async (params: {
    channel: "email" | "linkedin" | "whatsapp";
    stepNumber: number;
    linkedinMessageType?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de generation");
      return data.result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { generate, isLoading };
}

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  delay: Clock,
  linkedin_connect: UserPlus,
  linkedin_message: MessageSquare,
  condition: Clock,
  whatsapp: Phone,
};

const VARIABLE_BUTTONS = [
  { key: "{firstName}", label: "Prenom" },
  { key: "{lastName}", label: "Nom" },
  { key: "{company}", label: "Entreprise" },
  { key: "{jobTitle}", label: "Poste" },
];

interface StepEditorProps {
  step: StepData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (step: StepData) => void;
}

export function StepEditor({
  step,
  open,
  onOpenChange,
  onSave,
}: StepEditorProps) {
  if (!step) return null;

  const Icon = STEP_ICONS[step.step_type] ?? Clock;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Icon className="size-5 text-blue-600" />
            <div>
              <SheetTitle>
                {STEP_TYPES[step.step_type]?.label ?? "Etape"}
              </SheetTitle>
              <SheetDescription>
                Configurez cette etape de la sequence
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <StepEditorContent key={step.id} step={step} onSave={onSave} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StepEditorContent({
  step,
  onSave,
}: {
  step: StepData;
  onSave: (step: StepData) => void;
}) {
  if (step.step_type === "email") {
    return <EmailStepEditor step={step} onSave={onSave} />;
  }

  if (step.step_type === "delay") {
    return <DelayStepEditor step={step} onSave={onSave} />;
  }

  if (step.step_type === "linkedin_connect") {
    return <LinkedInConnectEditor step={step} onSave={onSave} />;
  }

  if (step.step_type === "linkedin_message") {
    return <LinkedInMessageEditor step={step} onSave={onSave} />;
  }

  if (step.step_type === "whatsapp") {
    return <WhatsAppMessageEditor step={step} onSave={onSave} />;
  }

  return (
    <p className="text-sm text-muted-foreground">
      Type d&apos;etape non supporte.
    </p>
  );
}

// --- EMAIL STEP ---
function EmailStepEditor({
  step,
  onSave,
}: {
  step: StepData;
  onSave: (step: StepData) => void;
}) {
  const [subject, setSubject] = useState(step.subject ?? "");
  const [body, setBody] = useState(step.body_html ?? "");
  const [abEnabled, setAbEnabled] = useState(step.ab_enabled ?? false);
  const { generate, isLoading: aiLoading } = useTemplateGeneration();

  // Sync state when step changes (key prop forces remount, but just in case)
  useEffect(() => {
    setSubject(step.subject ?? "");
    setBody(step.body_html ?? "");
    setAbEnabled(step.ab_enabled ?? false);
  }, [step.id, step.subject, step.body_html, step.ab_enabled]);

  const handleAIGenerate = async () => {
    const result = await generate({
      channel: "email",
      stepNumber: step.step_order,
    });
    if (result?.content) {
      const content = result.content as { subject?: string; body_html?: string; body_text?: string };
      if (content.subject) setSubject(content.subject);
      if (content.body_html) setBody(content.body_html);
      else if (content.body_text) setBody(content.body_text);
      toast.success("Email genere par l'IA");
    }
  };

  const handleSave = () => {
    onSave({
      ...step,
      subject,
      body_html: body,
      body_text: body.replace(/<[^>]*>/g, ""),
      ab_enabled: abEnabled,
    });
  };

  return (
    <div className="space-y-5">
      {/* AI Generation Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
        onClick={handleAIGenerate}
        disabled={aiLoading}
      >
        {aiLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {aiLoading ? "Generation en cours..." : "Generer avec l'IA"}
      </Button>

      <EmailComposer
        subject={subject}
        body={body}
        onSubjectChange={setSubject}
        onBodyChange={setBody}
      />

      {/* A/B test toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Test A/B</p>
          <p className="text-xs text-muted-foreground">
            Tester differentes versions de cet email
          </p>
        </div>
        <Switch checked={abEnabled} onCheckedChange={setAbEnabled} />
      </div>

      <SheetFooter className="p-0">
        <Button onClick={handleSave} className="w-full">
          Enregistrer
        </Button>
      </SheetFooter>
    </div>
  );
}

// --- DELAY STEP ---
function DelayStepEditor({
  step,
  onSave,
}: {
  step: StepData;
  onSave: (step: StepData) => void;
}) {
  const [days, setDays] = useState(step.delay_days ?? 1);
  const [hours, setHours] = useState(step.delay_hours ?? 0);

  useEffect(() => {
    setDays(step.delay_days ?? 1);
    setHours(step.delay_hours ?? 0);
  }, [step.id, step.delay_days, step.delay_hours]);

  const handleSave = () => {
    onSave({ ...step, delay_days: days, delay_hours: hours });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="delay-days">Jours</Label>
          <Input
            id="delay-days"
            type="number"
            min={0}
            max={90}
            value={days}
            onChange={(e) =>
              setDays(Math.max(0, parseInt(e.target.value) || 0))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="delay-hours">Heures</Label>
          <Input
            id="delay-hours"
            type="number"
            min={0}
            max={23}
            value={hours}
            onChange={(e) =>
              setHours(
                Math.max(0, Math.min(23, parseInt(e.target.value) || 0))
              )
            }
          />
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Resume : </span>
        Attendre{" "}
        {days > 0 && (
          <>
            <strong>{days}</strong> jour{days > 1 ? "s" : ""}
          </>
        )}
        {days > 0 && hours > 0 && " et "}
        {hours > 0 && (
          <>
            <strong>{hours}</strong> heure{hours > 1 ? "s" : ""}
          </>
        )}
        {days === 0 && hours === 0 && (
          <span className="italic">aucun delai configure</span>
        )}
      </div>

      <SheetFooter className="p-0">
        <Button onClick={handleSave} className="w-full">
          Enregistrer
        </Button>
      </SheetFooter>
    </div>
  );
}

// --- LINKEDIN CONNECT ---
function LinkedInConnectEditor({
  step,
  onSave,
}: {
  step: StepData;
  onSave: (step: StepData) => void;
}) {
  const [message, setMessage] = useState(step.linkedin_message ?? "");
  const maxChars = 300;
  const { generate, isLoading: aiLoading } = useTemplateGeneration();

  useEffect(() => {
    setMessage(step.linkedin_message ?? "");
  }, [step.id, step.linkedin_message]);

  const handleAIGenerate = async () => {
    const result = await generate({
      channel: "linkedin",
      stepNumber: step.step_order,
      linkedinMessageType: "connection",
    });
    if (result?.content) {
      const content = result.content as { message?: string };
      if (content.message) setMessage(content.message.slice(0, maxChars));
      toast.success("Note de connexion generee par l'IA");
    }
  };

  const handleSave = () => {
    onSave({ ...step, linkedin_message: message });
  };

  return (
    <div className="space-y-5">
      {/* AI Generation Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
        onClick={handleAIGenerate}
        disabled={aiLoading}
      >
        {aiLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {aiLoading ? "Generation en cours..." : "Generer avec l'IA"}
      </Button>

      <div className="space-y-2">
        <Label htmlFor="connect-message">Note de connexion</Label>
        <Textarea
          id="connect-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, maxChars))}
          placeholder="Bonjour {firstName}, j'aimerais vous ajouter a mon reseau..."
          rows={5}
          maxLength={maxChars}
        />
        <div className="flex justify-end">
          <span
            className={`text-xs ${
              message.length >= maxChars
                ? "text-red-500 font-medium"
                : "text-muted-foreground"
            }`}
          >
            {message.length} / {maxChars}
          </span>
        </div>
      </div>

      <SheetFooter className="p-0">
        <Button onClick={handleSave} className="w-full">
          Enregistrer
        </Button>
      </SheetFooter>
    </div>
  );
}

// --- LINKEDIN MESSAGE ---
function LinkedInMessageEditor({
  step,
  onSave,
}: {
  step: StepData;
  onSave: (step: StepData) => void;
}) {
  const [message, setMessage] = useState(step.linkedin_message ?? "");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const { generate, isLoading: aiLoading } = useTemplateGeneration();

  useEffect(() => {
    setMessage(step.linkedin_message ?? "");
  }, [step.id, step.linkedin_message]);

  const handleAIGenerate = async () => {
    const result = await generate({
      channel: "linkedin",
      stepNumber: step.step_order,
      linkedinMessageType: "followup",
    });
    if (result?.content) {
      const content = result.content as { message?: string };
      if (content.message) setMessage(content.message);
      toast.success("Message LinkedIn genere par l'IA");
    }
  };

  const insertVariable = (variable: string) => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      const start = el.selectionStart ?? message.length;
      const end = el.selectionEnd ?? message.length;
      const newValue =
        message.substring(0, start) + variable + message.substring(end);
      setMessage(newValue);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + variable.length;
        el.setSelectionRange(pos, pos);
      });
    }
  };

  const handleSave = () => {
    onSave({ ...step, linkedin_message: message });
  };

  return (
    <div className="space-y-5">
      {/* AI Generation Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
        onClick={handleAIGenerate}
        disabled={aiLoading}
      >
        {aiLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {aiLoading ? "Generation en cours..." : "Generer avec l'IA"}
      </Button>

      {/* Variable buttons */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Inserer une variable
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLE_BUTTONS.map((v) => (
            <Button
              key={v.key}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-mono"
              onClick={() => insertVariable(v.key)}
            >
              {v.key}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="linkedin-message">Message</Label>
        <Textarea
          id="linkedin-message"
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Bonjour {firstName}, merci d'avoir accepte ma demande..."
          rows={8}
        />
      </div>

      <SheetFooter className="p-0">
        <Button onClick={handleSave} className="w-full">
          Enregistrer
        </Button>
      </SheetFooter>
    </div>
  );
}

// --- WHATSAPP MESSAGE ---
function WhatsAppMessageEditor({
  step,
  onSave,
}: {
  step: StepData;
  onSave: (step: StepData) => void;
}) {
  const [message, setMessage] = useState(step.whatsapp_message ?? "");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const { generate, isLoading: aiLoading } = useTemplateGeneration();

  useEffect(() => {
    setMessage(step.whatsapp_message ?? "");
  }, [step.id, step.whatsapp_message]);

  const handleAIGenerate = async () => {
    const result = await generate({
      channel: "whatsapp",
      stepNumber: step.step_order,
    });
    if (result?.content) {
      const content = result.content as { message?: string };
      if (content.message) setMessage(content.message);
      toast.success("Message WhatsApp genere par l'IA");
    }
  };

  const insertVariable = (variable: string) => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      const start = el.selectionStart ?? message.length;
      const end = el.selectionEnd ?? message.length;
      const newValue =
        message.substring(0, start) + variable + message.substring(end);
      setMessage(newValue);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + variable.length;
        el.setSelectionRange(pos, pos);
      });
    }
  };

  const handleSave = () => {
    onSave({ ...step, whatsapp_message: message });
  };

  return (
    <div className="space-y-5">
      {/* AI Generation Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
        onClick={handleAIGenerate}
        disabled={aiLoading}
      >
        {aiLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {aiLoading ? "Generation en cours..." : "Generer avec l'IA"}
      </Button>

      {/* Variable buttons */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Inserer une variable
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLE_BUTTONS.map((v) => (
            <Button
              key={v.key}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-mono"
              onClick={() => insertVariable(v.key)}
            >
              {v.key}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="whatsapp-message">Message WhatsApp</Label>
        <Textarea
          id="whatsapp-message"
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Bonjour {firstName}, je me permets de vous contacter ici..."
          rows={6}
        />
        <p className="text-xs text-muted-foreground">
          Gardez vos messages courts et personnalises pour un meilleur taux de reponse.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Prerequis</p>
          <p className="text-xs mt-1">
            Le prospect doit avoir un numero de telephone valide et un compte WhatsApp actif.
            Les prospects sans numero seront automatiquement ignores.
          </p>
        </div>
      </div>

      <SheetFooter className="p-0">
        <Button onClick={handleSave} className="w-full">
          Enregistrer
        </Button>
      </SheetFooter>
    </div>
  );
}
