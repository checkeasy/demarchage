"use client";

import {
  Brain,
  Mail,
  Linkedin,
  MessageSquare,
  Search,
  Settings2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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

const AGENT_THEME: Record<
  AgentType,
  {
    iconBg: string;
    iconText: string;
    accent: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  ceo: {
    iconBg: "bg-purple-100",
    iconText: "text-purple-600",
    accent: "from-purple-500 to-purple-600",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
  },
  email_writer: {
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    accent: "from-blue-500 to-blue-600",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
  },
  linkedin_writer: {
    iconBg: "bg-sky-100",
    iconText: "text-sky-600",
    accent: "from-sky-500 to-sky-600",
    badgeBg: "bg-sky-50",
    badgeText: "text-sky-700",
  },
  response_handler: {
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
    accent: "from-emerald-500 to-emerald-600",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
  },
  prospect_researcher: {
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
    accent: "from-amber-500 to-amber-600",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
  },
};

const DEFAULT_THEME = {
  iconBg: "bg-slate-100",
  iconText: "text-slate-600",
  accent: "from-slate-500 to-slate-600",
  badgeBg: "bg-slate-50",
  badgeText: "text-slate-700",
};

export function AgentCard({ config, onConfigure }: AgentCardProps) {
  const agentType = config.agent_type as AgentType;
  const Icon = AGENT_ICONS[agentType] || Brain;
  const theme = AGENT_THEME[agentType] || DEFAULT_THEME;
  const display = AGENT_DISPLAY[agentType] || {
    name: config.agent_type,
    description: "",
  };

  const modelLabel = config.model.includes("haiku")
    ? "Haiku"
    : config.model.includes("sonnet")
      ? "Sonnet"
      : config.model;

  const modelBadgeClass = config.model.includes("sonnet")
    ? "bg-violet-50 text-violet-700 border-violet-200"
    : "bg-sky-50 text-sky-700 border-sky-200";

  return (
    <Card className="group relative overflow-hidden border border-slate-200/80 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300">
      {/* Gradient accent bar at the top */}
      <div
        className={`h-1.5 w-full bg-gradient-to-r ${theme.accent}`}
      />

      <CardContent className="px-5 pt-5 pb-5">
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div
            className={`flex items-center justify-center size-14 rounded-2xl ${theme.iconBg} mb-4`}
          >
            <Icon className={`size-7 ${theme.iconText}`} />
          </div>

          {/* Name */}
          <h3 className="text-base font-semibold text-slate-900 leading-tight">
            {config.name || display.name}
          </h3>

          {/* Description */}
          <p className="mt-1.5 text-sm text-muted-foreground leading-snug line-clamp-2 min-h-[2.5rem]">
            {config.description || display.description}
          </p>

          {/* Badges */}
          <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
            <Badge
              variant="outline"
              className={`text-xs font-medium ${modelBadgeClass}`}
            >
              {modelLabel}
            </Badge>
            <Badge variant="outline" className="text-xs text-slate-500">
              Temp: {config.temperature}
            </Badge>
          </div>

          {/* Status indicator */}
          <div className="mt-4 w-full">
            {config.is_active ? (
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-1.5 px-3">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">
                  Actif
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 py-1.5 px-3">
                <XCircle className="size-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">
                  Inactif
                </span>
              </div>
            )}
          </div>

          {/* Configure button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onConfigure}
            className="mt-4 w-full transition-colors hover:bg-slate-50"
          >
            <Settings2 className="size-3.5" />
            Configurer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
