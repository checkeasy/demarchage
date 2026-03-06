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
  ChevronRight,
  Linkedin,
  Phone,
  PhoneCall,
  CalendarCheck,
  CalendarClock,
  StickyNote,
  ArrowRightLeft,
  Bot,
  Search,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface TimelineEventMetadata {
  has_recording?: boolean;
  audio_url?: string;
  audio_duration_seconds?: number;
  audio_mime_type?: string;
  transcription?: string;
  summary?: string;
  key_points?: string[];
  action_items?: string[];
  recorded_at?: string;
}

export interface TimelineEvent {
  id: string;
  type:
    | "email_sent" | "email_opened" | "email_clicked" | "email_replied" | "email_bounced"
    | "linkedin_view" | "linkedin_connect" | "linkedin_message" | "linkedin_check" | "linkedin_email"
    // CRM activity types
    | "call_logged" | "meeting_scheduled" | "meeting_completed"
    | "note_added" | "status_changed"
    | "reply_received"
    | "linkedin_connect_sent" | "linkedin_connect_accepted" | "linkedin_message_sent" | "linkedin_reply_received" | "linkedin_profile_viewed"
    | "whatsapp_sent" | "whatsapp_delivered" | "whatsapp_read" | "whatsapp_reply_received"
    | "ai_reply_analysis" | "ai_research";
  channel: "email" | "linkedin" | "whatsapp" | "phone" | "manual" | "ai";
  description: string;
  detail?: string;
  date: string;
  metadata?: TimelineEventMetadata;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  // Email
  email_sent: { icon: Mail, color: "text-blue-600", bgColor: "bg-blue-50", label: "Email" },
  email_opened: { icon: MailOpen, color: "text-green-600", bgColor: "bg-green-50", label: "Email ouvert" },
  email_clicked: { icon: MousePointerClick, color: "text-purple-600", bgColor: "bg-purple-50", label: "Clic" },
  email_replied: { icon: MessageSquareReply, color: "text-emerald-600", bgColor: "bg-emerald-50", label: "Reponse" },
  email_bounced: { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50", label: "Bounce" },
  reply_received: { icon: MessageSquareReply, color: "text-emerald-600", bgColor: "bg-emerald-50", label: "Reponse" },
  // LinkedIn
  linkedin_view: { icon: Eye, color: "text-slate-600", bgColor: "bg-slate-100", label: "LinkedIn" },
  linkedin_connect: { icon: UserPlus, color: "text-blue-600", bgColor: "bg-blue-50", label: "LinkedIn" },
  linkedin_message: { icon: MessageSquare, color: "text-green-600", bgColor: "bg-green-50", label: "LinkedIn" },
  linkedin_check: { icon: Linkedin, color: "text-sky-600", bgColor: "bg-sky-50", label: "LinkedIn" },
  linkedin_email: { icon: Mail, color: "text-purple-600", bgColor: "bg-purple-50", label: "LinkedIn" },
  linkedin_connect_sent: { icon: UserPlus, color: "text-blue-600", bgColor: "bg-blue-50", label: "LinkedIn" },
  linkedin_connect_accepted: { icon: UserPlus, color: "text-green-600", bgColor: "bg-green-50", label: "Connexion" },
  linkedin_message_sent: { icon: MessageSquare, color: "text-blue-600", bgColor: "bg-blue-50", label: "LinkedIn" },
  linkedin_reply_received: { icon: MessageSquareReply, color: "text-emerald-600", bgColor: "bg-emerald-50", label: "LinkedIn" },
  linkedin_profile_viewed: { icon: Eye, color: "text-slate-600", bgColor: "bg-slate-100", label: "LinkedIn" },
  // Phone / CRM
  call_logged: { icon: PhoneCall, color: "text-orange-600", bgColor: "bg-orange-50", label: "Appel" },
  meeting_scheduled: { icon: CalendarClock, color: "text-indigo-600", bgColor: "bg-indigo-50", label: "RDV" },
  meeting_completed: { icon: CalendarCheck, color: "text-indigo-600", bgColor: "bg-indigo-50", label: "RDV" },
  meeting_suggested: { icon: CalendarClock, color: "text-orange-600", bgColor: "bg-orange-50", label: "RDV suggere" },
  note_added: { icon: StickyNote, color: "text-amber-600", bgColor: "bg-amber-50", label: "Note" },
  status_changed: { icon: ArrowRightLeft, color: "text-slate-600", bgColor: "bg-slate-100", label: "Statut" },
  // WhatsApp
  whatsapp_sent: { icon: MessageSquare, color: "text-green-600", bgColor: "bg-green-50", label: "WhatsApp" },
  whatsapp_delivered: { icon: MessageSquare, color: "text-green-600", bgColor: "bg-green-50", label: "WhatsApp" },
  whatsapp_read: { icon: MessageSquare, color: "text-green-600", bgColor: "bg-green-50", label: "WhatsApp" },
  whatsapp_reply_received: { icon: MessageSquareReply, color: "text-green-600", bgColor: "bg-green-50", label: "WhatsApp" },
  // AI
  ai_reply_analysis: { icon: Bot, color: "text-violet-600", bgColor: "bg-violet-50", label: "IA" },
  ai_research: { icon: Search, color: "text-violet-600", bgColor: "bg-violet-50", label: "IA" },
};

const CHANNEL_ICONS: Record<string, { icon: React.ElementType; label: string }> = {
  email: { icon: Mail, label: "Email" },
  linkedin: { icon: Linkedin, label: "LinkedIn" },
  phone: { icon: Phone, label: "Telephone" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp" },
  manual: { icon: StickyNote, label: "Manuel" },
  ai: { icon: Bot, label: "IA" },
};

interface ProspectTimelineProps {
  events: TimelineEvent[];
}

export function ProspectTimeline({ events }: ProspectTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const INITIAL_COUNT = 15;

  const visibleEvents = showAll ? events : events.slice(0, INITIAL_COUNT);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.note_added;
        const Icon = config.icon;
        const isLast = index === visibleEvents.length - 1;
        const channelInfo = CHANNEL_ICONS[event.channel] || CHANNEL_ICONS.manual;
        const ChannelIcon = channelInfo.icon;
        const isExpanded = expandedIds.has(event.id);
        const hasLongDetail = event.detail && event.detail.length > 120;

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
              <div className="flex items-start gap-2">
                <p className="text-sm text-slate-900 flex-1">{event.description}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {event.metadata?.has_recording && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                      <Mic className="size-2.5" />
                      {event.metadata.audio_duration_seconds != null && (
                        <span>
                          {Math.floor(event.metadata.audio_duration_seconds / 60)}:{Math.floor(event.metadata.audio_duration_seconds % 60).toString().padStart(2, "0")}
                        </span>
                      )}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                    {config.label}
                  </Badge>
                </div>
              </div>

              {/* Audio player for recordings */}
              {event.metadata?.has_recording && event.metadata.audio_url && (
                <div className="mt-1.5">
                  <audio controls src={event.metadata.audio_url} className="w-full h-8" preload="none" />
                </div>
              )}

              {event.detail && (
                <div
                  className={`mt-1 text-xs text-muted-foreground bg-slate-50 rounded px-2 py-1.5 border border-slate-100 ${
                    !isExpanded && hasLongDetail ? "line-clamp-3 cursor-pointer" : ""
                  }`}
                  onClick={() => hasLongDetail && toggleExpand(event.id)}
                >
                  <span className="whitespace-pre-wrap">{event.detail}</span>
                </div>
              )}
              {hasLongDetail && !isExpanded && (
                <button
                  onClick={() => toggleExpand(event.id)}
                  className="text-[10px] text-primary hover:underline mt-0.5"
                >
                  Voir plus...
                </button>
              )}

              {/* Transcription toggle for recordings */}
              {event.metadata?.has_recording && event.metadata.transcription && (
                <div className="mt-1">
                  <button
                    onClick={() => toggleExpand(`${event.id}-transcript`)}
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                  >
                    {expandedIds.has(`${event.id}-transcript`) ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
                    Voir la transcription
                  </button>
                  {expandedIds.has(`${event.id}-transcript`) && (
                    <div className="mt-1 text-xs text-muted-foreground bg-slate-50 rounded px-2 py-1.5 border border-slate-100 max-h-48 overflow-y-auto">
                      <span className="whitespace-pre-wrap">{event.metadata.transcription}</span>
                    </div>
                  )}
                </div>
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
                  <ChannelIcon className="size-2.5" />
                  {channelInfo.label}
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
