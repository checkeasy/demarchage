"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  CalendarPlus,
  Loader2,
  Copy,
  Check,
  Mail,
  Linkedin,
} from "lucide-react";
import { toast } from "sonner";
import { useAIGeneration } from "@/hooks/useAIGeneration";
import type { Prospect } from "@/lib/types/database";

interface HotProspectBannerProps {
  prospect: Prospect;
  nextAction?: string;
}

interface MeetingMessageData {
  subject?: string;
  message?: string;
  booking_url?: string;
}

export function HotProspectBanner({ prospect, nextAction }: HotProspectBannerProps) {
  const { generateMeetingMessage, isLoading } = useAIGeneration();
  const [message, setMessage] = useState<MeetingMessageData | null>(null);
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<"email" | "linkedin">("email");

  const prospectStatus = prospect.status as string;
  const isHot = prospectStatus === "hot";
  const isWarm = prospectStatus === "warm";
  const shouldBookMeeting = nextAction === "book_meeting";

  if (!isHot && !isWarm && !shouldBookMeeting) return null;

  const handleGenerate = async () => {
    const result = await generateMeetingMessage({
      prospectId: prospect.id,
      channel,
    });
    if (result) {
      const data = (result.content || result) as MeetingMessageData;
      setMessage(data);
      toast.success("Message RDV genere");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copie dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-orange-500" />
          <span className="font-semibold text-sm text-orange-900">
            Prospect chaud {shouldBookMeeting && "— RDV recommande"}
          </span>
        </div>
        <Badge className="bg-orange-100 text-orange-800 text-xs">
          {isHot ? "Hot" : isWarm ? "Warm" : "Action"}
        </Badge>
      </div>

      {!message ? (
        <div className="space-y-2">
          <p className="text-xs text-orange-700">
            Generez un message personnalise pour proposer un rendez-vous.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-orange-200 overflow-hidden">
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                  channel === "email"
                    ? "bg-orange-200 text-orange-900"
                    : "bg-white text-orange-600 hover:bg-orange-50"
                }`}
                onClick={() => setChannel("email")}
              >
                <Mail className="size-3" />
                Email
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                  channel === "linkedin"
                    ? "bg-orange-200 text-orange-900"
                    : "bg-white text-orange-600 hover:bg-orange-50"
                }`}
                onClick={() => setChannel("linkedin")}
              >
                <Linkedin className="size-3" />
                LinkedIn
              </button>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CalendarPlus className="size-3.5" />
              )}
              {isLoading ? "Generation..." : "Generer message RDV"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {message.subject && (
            <div>
              <p className="text-[10px] font-medium text-orange-600 uppercase tracking-wider">Objet</p>
              <p className="text-sm font-medium text-orange-900">{message.subject}</p>
            </div>
          )}
          <div className="rounded bg-white border border-orange-100 p-3">
            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
          </div>
          {message.booking_url && (
            <p className="text-xs text-orange-600">
              Lien de reservation : <span className="font-mono">{message.booking_url}</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
              onClick={() => handleCopy(
                message.subject
                  ? `Objet: ${message.subject}\n\n${message.message}`
                  : message.message || ""
              )}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copie !" : "Copier"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-orange-600"
              onClick={() => setMessage(null)}
            >
              Regenerer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
