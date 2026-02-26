"use client";

import { useState } from "react";
import {
  Mail,
  MailOpen,
  MousePointerClick,
  MessageSquareReply,
  UserPlus,
  MessageSquare,
  Eye,
  AlertTriangle,
  ChevronDown,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TimelineEvent {
  id: string;
  type: "email_sent" | "email_opened" | "email_clicked" | "email_replied" | "email_bounced"
    | "linkedin_view" | "linkedin_connect" | "linkedin_message" | "linkedin_check" | "linkedin_email";
  channel: "email" | "linkedin";
  description: string;
  detail?: string;
  date: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  email_sent: { icon: Mail, color: "text-blue-600", bgColor: "bg-blue-50" },
  email_opened: { icon: MailOpen, color: "text-green-600", bgColor: "bg-green-50" },
  email_clicked: { icon: MousePointerClick, color: "text-purple-600", bgColor: "bg-purple-50" },
  email_replied: { icon: MessageSquareReply, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  email_bounced: { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50" },
  linkedin_view: { icon: Eye, color: "text-slate-600", bgColor: "bg-slate-100" },
  linkedin_connect: { icon: UserPlus, color: "text-blue-600", bgColor: "bg-blue-50" },
  linkedin_message: { icon: MessageSquare, color: "text-green-600", bgColor: "bg-green-50" },
  linkedin_check: { icon: Linkedin, color: "text-sky-600", bgColor: "bg-sky-50" },
  linkedin_email: { icon: Mail, color: "text-purple-600", bgColor: "bg-purple-50" },
};

interface ProspectTimelineProps {
  events: TimelineEvent[];
}

export function ProspectTimeline({ events }: ProspectTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 10;

  const visibleEvents = showAll ? events : events.slice(0, INITIAL_COUNT);

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Aucune activite enregistree pour ce prospect.
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {visibleEvents.map((event, index) => {
        const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.email_sent;
        const Icon = config.icon;
        const isLast = index === visibleEvents.length - 1;

        return (
          <div key={event.id} className="relative flex gap-3">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />
            )}

            {/* Icon */}
            <div className="relative z-10 shrink-0">
              <div className={`flex items-center justify-center size-8 rounded-full ${config.bgColor}`}>
                <Icon className={`size-3.5 ${config.color}`} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 pb-4 min-w-0">
              <p className="text-sm text-slate-900">{event.description}</p>
              {event.detail && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {event.detail}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(event.date).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <span className="ml-2 inline-flex items-center gap-0.5">
                  {event.channel === "email" ? (
                    <Mail className="size-2.5" />
                  ) : (
                    <Linkedin className="size-2.5" />
                  )}
                  {event.channel === "email" ? "Email" : "LinkedIn"}
                </span>
              </p>
            </div>
          </div>
        );
      })}

      {events.length > INITIAL_COUNT && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(true)}
          className="w-full text-xs"
        >
          <ChevronDown className="size-3 mr-1" />
          Voir {events.length - INITIAL_COUNT} autres activites
        </Button>
      )}
    </div>
  );
}
