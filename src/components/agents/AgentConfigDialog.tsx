"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
    value: "claude-sonnet-4-5-20250415",
    label: "Claude Sonnet 4.5",
    description: "Equilibre qualite/prix",
  },
];

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

  const [model, setModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature);
  const [maxTokens, setMaxTokens] = useState(config.max_tokens);
  const [isActive, setIsActive] = useState(config.is_active);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPrompt, setIsFetchingPrompt] = useState(false);

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
          <DialogTitle>Configurer: {display.name}</DialogTitle>
          <DialogDescription>{display.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Agent actif</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Activer ou desactiver cet agent
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <Separator />

          {/* Model selector */}
          <div className="space-y-2">
            <Label>Modele IA</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir un modele" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2">
                      <span>{m.label}</span>
                      <span className="text-xs text-muted-foreground">
                        - {m.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="text-sm font-mono text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">
              0 = deterministe et precis, 1 = creatif et varie
            </p>
          </div>

          {/* Max tokens */}
          <div className="space-y-2">
            <Label>Tokens maximum</Label>
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

          {/* System prompt */}
          <div className="space-y-2">
            <Label>Prompt systeme</Label>
            {isFetchingPrompt ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Chargement du prompt...
              </div>
            ) : (
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Instructions systeme pour cet agent..."
                className="min-h-[200px] font-mono text-sm"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Chaque modification cree une nouvelle version du prompt
            </p>
          </div>
        </div>

        <DialogFooter>
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
