"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Save,
  Power,
  Cpu,
  Thermometer,
  Hash,
  FileText,
  Brain,
  Mail,
  Linkedin,
  MessageSquare,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import type { AgentConfig, AgentType } from "@/lib/agents/types";
import { AGENT_DISPLAY } from "@/lib/agents/types";

interface AgentConfigDialogProps {
  config: AgentConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const AVAILABLE_MODELS = [
  {
    value: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    description: "Rapide et economique",
  },
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    description: "Equilibre performance/cout",
  },
  {
    value: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    description: "Le plus performant (couteux)",
  },
];

const AGENT_ICONS: Record<AgentType, React.ElementType> = {
  ceo: Brain,
  email_writer: Mail,
  linkedin_writer: Linkedin,
  response_handler: MessageSquare,
  prospect_researcher: Search,
};

const AGENT_ICON_COLORS: Record<AgentType, { bg: string; text: string }> = {
  ceo: { bg: "bg-purple-100", text: "text-purple-600" },
  email_writer: { bg: "bg-blue-100", text: "text-blue-600" },
  linkedin_writer: { bg: "bg-sky-100", text: "text-sky-600" },
  response_handler: { bg: "bg-emerald-100", text: "text-emerald-600" },
  prospect_researcher: { bg: "bg-amber-100", text: "text-amber-600" },
};

export function AgentConfigDialog({
  config,
  open,
  onOpenChange,
  onSaved,
}: AgentConfigDialogProps) {
  const agentType = config.agent_type as AgentType;
  const display = AGENT_DISPLAY[agentType] || {
    name: config.agent_type,
    description: "",
  };
  const Icon = AGENT_ICONS[agentType] || Brain;
  const iconColors = AGENT_ICON_COLORS[agentType] || {
    bg: "bg-slate-100",
    text: "text-slate-600",
  };

  const [model, setModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature);
  const [maxTokens, setMaxTokens] = useState(config.max_tokens);
  const [isActive, setIsActive] = useState(config.is_active);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPrompt, setIsFetchingPrompt] = useState(false);

  // Temperature label
  function getTemperatureLabel(t: number): string {
    if (t <= 0.2) return "Tres precis";
    if (t <= 0.4) return "Precis";
    if (t <= 0.6) return "Equilibre";
    if (t <= 0.8) return "Creatif";
    return "Tres creatif";
  }

  // Fetch the current system prompt for this agent
  const fetchPrompt = useCallback(async () => {
    setIsFetchingPrompt(true);
    try {
      const res = await fetch(`/api/agents/config/${config.agent_type}`);
      if (res.ok) {
        const data = await res.json();
        if (data.promptVersion?.system_prompt) {
          setSystemPrompt(data.promptVersion.system_prompt);
        }
      }
    } catch {
      // Silent fail - will use empty prompt
    } finally {
      setIsFetchingPrompt(false);
    }
  }, [config.agent_type]);

  useEffect(() => {
    if (open) {
      setModel(config.model);
      setTemperature(config.temperature);
      setMaxTokens(config.max_tokens);
      setIsActive(config.is_active);
      setSystemPrompt("");
      fetchPrompt();
    }
  }, [open, config, fetchPrompt]);

  async function handleSave() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/agents/config/${config.agent_type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          is_active: isActive,
          system_prompt: systemPrompt || undefined,
        }),
      });

      if (res.ok) {
        toast.success(`Agent "${display.name}" mis a jour`);
        onSaved();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la mise a jour");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center size-10 rounded-xl ${iconColors.bg}`}
            >
              <Icon className={`size-5 ${iconColors.text}`} />
            </div>
            <div>
              <DialogTitle className="text-lg">{display.name}</DialogTitle>
              <DialogDescription className="text-sm">
                {display.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section: Status */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-3">
              <Power className="size-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Agent actif</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Activer ou desactiver cet agent dans le pipeline
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-500 border-slate-200"
                }`}
              >
                {isActive ? "Actif" : "Inactif"}
              </Badge>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <Separator />

          {/* Section: Model */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Modele IA</Label>
            </div>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir un modele" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground">
                        - {m.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Section: Temperature */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Thermometer className="size-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Temperature</Label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {getTemperatureLabel(temperature)}
                </span>
                <span className="text-sm font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={([val]) => setTemperature(val)}
                min={0}
                max={1}
                step={0.1}
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Precis</span>
                <span>Equilibre</span>
                <span>Creatif</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section: Max tokens */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="size-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Tokens maximum</Label>
            </div>
            <Input
              type="number"
              min={256}
              max={8192}
              step={256}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
            />
            <p className="text-xs text-muted-foreground">
              Limite la longueur de la reponse generee (256 - 8192)
            </p>
          </div>

          <Separator />

          {/* Section: System prompt */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Prompt systeme</Label>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Versionne
              </Badge>
            </div>
            {isFetchingPrompt ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground rounded-lg bg-slate-50 border border-slate-100">
                <Loader2 className="size-4 animate-spin" />
                Chargement du prompt...
              </div>
            ) : (
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Instructions systeme pour cet agent..."
                className="min-h-[200px] text-sm leading-relaxed"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Chaque modification cree une nouvelle version du prompt
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
