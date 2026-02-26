"use client";

import {
  Brain,
  Mail,
  Linkedin,
  MessageSquare,
  Search,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import type { AgentConfig, AgentType } from "@/lib/agents/types";
import { AGENT_DISPLAY } from "@/lib/agents/types";

interface AgentCardProps {
  config: AgentConfig;
  onConfigure: () => void;
}

const AGENT_ICONS: Record<AgentType, React.ElementType> = {
  ceo: Brain,
  email_writer: Mail,
  linkedin_writer: Linkedin,
  response_handler: MessageSquare,
  prospect_researcher: Search,
};

const AGENT_COLORS: Record<AgentType, { bg: string; text: string }> = {
  ceo: { bg: "bg-purple-50", text: "text-purple-600" },
  email_writer: { bg: "bg-blue-50", text: "text-blue-600" },
  linkedin_writer: { bg: "bg-sky-50", text: "text-sky-600" },
  response_handler: { bg: "bg-green-50", text: "text-green-600" },
  prospect_researcher: { bg: "bg-amber-50", text: "text-amber-600" },
};

export function AgentCard({ config, onConfigure }: AgentCardProps) {
  const agentType = config.agent_type as AgentType;
  const Icon = AGENT_ICONS[agentType] || Brain;
  const colors = AGENT_COLORS[agentType] || {
    bg: "bg-slate-50",
    text: "text-slate-600",
  };
  const display = AGENT_DISPLAY[agentType] || {
    name: config.agent_type,
    description: "",
  };

  const modelLabel = config.model.includes("haiku")
    ? "Haiku"
    : config.model.includes("sonnet")
      ? "Sonnet"
      : config.model;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center size-10 rounded-lg ${colors.bg}`}
            >
              <Icon className={`size-5 ${colors.text}`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm">
                {config.name || display.name}
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2 mt-0.5">
                {config.description || display.description}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Model and Temperature */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">
              {modelLabel}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Temp: {config.temperature}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Max: {config.max_tokens} tokens
            </Badge>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`size-2 rounded-full ${
                  config.is_active ? "bg-green-500" : "bg-slate-300"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {config.is_active ? "Actif" : "Inactif"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onConfigure}>
              <Settings2 className="size-3.5" />
              Configurer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
