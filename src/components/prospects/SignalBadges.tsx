"use client";

import { Badge } from "@/components/ui/badge";
import { SIGNAL_TYPES } from "@/lib/constants";
import {
  Briefcase, TrendingUp, UserPlus, Swords, Heart, Globe, Zap,
  Linkedin, Calendar, Handshake, AlertTriangle, Rocket, Signal,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase, TrendingUp, UserPlus, Swords, Heart, Globe, Zap,
  Linkedin, Calendar, Handshake, AlertTriangle, Rocket,
};

interface ProspectSignal {
  id: string;
  signal_type: string;
  title: string;
  description: string | null;
  signal_score: number;
  detected_at: string;
  is_active: boolean;
  expires_at: string | null;
}

interface SignalBadgesProps {
  signals: ProspectSignal[];
  compact?: boolean;
  maxShow?: number;
}

export function SignalBadges({ signals, compact = false, maxShow = 5 }: SignalBadgesProps) {
  const now = new Date();
  const activeSignals = signals.filter(
    s => s.is_active && (!s.expires_at || new Date(s.expires_at) > now)
  );

  if (activeSignals.length === 0) return null;

  const shown = activeSignals.slice(0, maxShow);
  const remaining = activeSignals.length - shown.length;

  if (compact) {
    const totalScore = activeSignals.reduce((sum, s) => sum + s.signal_score, 0);
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 text-xs cursor-help">
              <Signal className="h-3 w-3" />
              {activeSignals.length} signal{activeSignals.length > 1 ? "s" : ""} ({totalScore}pts)
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              {activeSignals.map(s => {
                const config = SIGNAL_TYPES[s.signal_type];
                return (
                  <div key={s.id} className="flex items-center gap-1.5 text-xs">
                    <span className={config?.color || "text-gray-500"}>
                      {config?.label || s.signal_type}
                    </span>
                    <span className="text-muted-foreground">+{s.signal_score}pts</span>
                  </div>
                );
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map(s => {
        const config = SIGNAL_TYPES[s.signal_type];
        const IconComp = ICON_MAP[config?.icon || ""] || Signal;
        return (
          <TooltipProvider key={s.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`gap-1 text-xs cursor-help border-amber-200 bg-amber-50 ${config?.color || "text-gray-600"}`}>
                  <IconComp className="h-3 w-3" />
                  {config?.label || s.signal_type}
                  <span className="text-muted-foreground ml-0.5">+{s.signal_score}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium">{s.title}</p>
                {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(s.detected_at).toLocaleDateString("fr-FR")}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
      {remaining > 0 && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          +{remaining}
        </Badge>
      )}
    </div>
  );
}

// Compact signal score indicator for cards/lists
export function SignalScoreIndicator({ signals }: { signals: ProspectSignal[] }) {
  const now = new Date();
  const active = signals.filter(
    s => s.is_active && (!s.expires_at || new Date(s.expires_at) > now)
  );
  if (active.length === 0) return null;

  const total = active.reduce((sum, s) => sum + s.signal_score, 0);
  const intensity = total >= 80 ? "bg-red-500" : total >= 40 ? "bg-orange-500" : "bg-amber-500";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-xs font-medium ${intensity}`}>
            <Signal className="h-3 w-3" />
            {total}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{active.length} signal{active.length > 1 ? "s" : ""} actif{active.length > 1 ? "s" : ""} - Score total: {total}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
