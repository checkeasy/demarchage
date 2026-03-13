"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { PhoneCall, CalendarCheck, StickyNote, Mail, MessageSquare, ArrowRightLeft, Mic, Loader2 } from "lucide-react";

import { CALL_OUTCOMES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AudioRecorder = dynamic(
  () => import("@/components/audio/AudioRecorder").then((m) => m.AudioRecorder),
  { ssr: false }
);

const ACTIVITY_TYPES = [
  { value: "call_logged", label: "Appel telephone", icon: PhoneCall, channel: "phone" },
  { value: "meeting_completed", label: "Reunion / Demo", icon: CalendarCheck, channel: "manual" },
  { value: "email_sent", label: "Email envoye", icon: Mail, channel: "email" },
  { value: "reply_received", label: "Reponse recue", icon: MessageSquare, channel: "email" },
  { value: "note_added", label: "Note / Commentaire", icon: StickyNote, channel: "manual" },
  { value: "status_changed", label: "Changement de statut", icon: ArrowRightLeft, channel: "manual" },
];

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName?: string;
  prospectCompany?: string;
  onActivityAdded: () => void;
}

export function AddActivityDialog({ open, onOpenChange, prospectId, prospectName, prospectCompany, onActivityAdded }: AddActivityDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activityType, setActivityType] = useState("call_logged");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [callOutcome, setCallOutcome] = useState("");

  // Audio recording states
  const [showRecorder, setShowRecorder] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState("");
  const [transcription, setTranscription] = useState("");
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState("");

  const handleRecordingComplete = (blob: Blob, durationSeconds: number) => {
    setAudioBlob(blob);
    setAudioDuration(durationSeconds);
    setShowRecorder(false);
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, `recording.${audioBlob.type.includes("mp4") ? "mp4" : "webm"}`);
      formData.append("prospect_id", prospectId);
      if (prospectName || prospectCompany) {
        formData.append("prospect_context", [prospectName, prospectCompany].filter(Boolean).join(" - "));
      }

      setTranscribeProgress("Transcription et resume en cours...");
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur de transcription");
      }

      const data = await res.json();

      setTranscription(data.transcription || "");
      setSummary(data.summary || "");
      setKeyPoints(data.key_points || []);
      setActionItems(data.action_items || []);
      setAudioUrl(data.audio_url || "");

      // Pre-fill body with summary
      const bodyParts: string[] = [];
      if (data.summary) bodyParts.push(data.summary);
      if (data.key_points?.length) {
        bodyParts.push("\nPoints cles :\n" + data.key_points.map((p: string) => `- ${p}`).join("\n"));
      }
      if (data.action_items?.length) {
        bodyParts.push("\nActions a suivre :\n" + data.action_items.map((a: string) => `- ${a}`).join("\n"));
      }
      setBody(bodyParts.join("\n"));

      toast.success("Transcription et resume termines");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de transcription");
    } finally {
      setIsTranscribing(false);
      setTranscribeProgress("");
    }
  };

  const resetAudio = () => {
    setAudioBlob(null);
    setAudioDuration(0);
    setTranscription("");
    setSummary("");
    setKeyPoints([]);
    setActionItems([]);
    setAudioUrl("");
  };

  const handleSubmit = async () => {
    if (!body.trim() && !audioBlob) {
      toast.error("Le contenu est requis");
      return;
    }

    setIsLoading(true);
    try {
      const typeInfo = ACTIVITY_TYPES.find(t => t.value === activityType);

      // Build metadata for recorded calls
      const metadata: Record<string, unknown> = {};
      if (audioUrl) {
        metadata.has_recording = true;
        metadata.audio_url = audioUrl;
        metadata.audio_duration_seconds = audioDuration;
        metadata.audio_mime_type = audioBlob?.type || "audio/webm";
        metadata.transcription = transcription;
        metadata.summary = summary;
        metadata.key_points = keyPoints;
        metadata.action_items = actionItems;
        metadata.recorded_at = new Date().toISOString();
      }

      const res = await fetch(`/api/prospects/${prospectId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: activityType,
          channel: typeInfo?.channel || "manual",
          subject: subject.trim() || typeInfo?.label || "Activite",
          body: body.trim(),
          metadata: {
            ...(Object.keys(metadata).length > 0 ? metadata : {}),
            ...(callOutcome ? { call_outcome: callOutcome } : {}),
          },
          created_at: new Date(date).toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }

      toast.success("Activite ajoutee");
      setSubject("");
      setBody("");
      setDate(new Date().toISOString().slice(0, 16));
      setCallOutcome("");
      resetAudio();
      setShowRecorder(false);
      onOpenChange(false);
      onActivityAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setIsLoading(false);
    }
  };

  const isCallType = activityType === "call_logged" || activityType === "meeting_completed";
  const hasRecording = !!audioBlob;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={showRecorder || hasRecording ? "sm:max-w-lg" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>Ajouter une activite</DialogTitle>
          <DialogDescription>
            Enregistrez un appel, une reunion, une note ou toute interaction avec ce prospect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type d&apos;activite</Label>
            <Select value={activityType} onValueChange={(v) => { setActivityType(v); resetAudio(); setShowRecorder(false); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-3.5" />
                        {type.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sujet (optionnel)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Appel decouverte, Demo produit..."
              disabled={isLoading || isTranscribing}
            />
          </div>

          {/* Call outcome (only for call type) */}
          {activityType === "call_logged" && (
            <div className="space-y-2">
              <Label>Resultat de l&apos;appel</Label>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner le resultat..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CALL_OUTCOMES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className={config.color}>{config.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Audio Recorder for call_logged */}
          {isCallType && !showRecorder && !hasRecording && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowRecorder(true)}
              disabled={isLoading || isTranscribing}
            >
              <Mic className="size-4 text-red-500" />
              Enregistrer l&apos;appel
            </Button>
          )}

          {isCallType && showRecorder && (
            <div className="border rounded-lg p-4 bg-slate-50/50">
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                onCancel={() => setShowRecorder(false)}
              />
            </div>
          )}

          {isCallType && hasRecording && !showRecorder && (
            <div className="border rounded-lg p-3 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="size-4 text-red-500" />
                  <span className="text-sm font-medium">Enregistrement</span>
                  <span className="text-xs text-muted-foreground">
                    ({Math.floor(audioDuration / 60)}:{(audioDuration % 60).toString().padStart(2, "0")})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { resetAudio(); setBody(""); }}
                  disabled={isTranscribing}
                >
                  Supprimer
                </Button>
              </div>

              {!transcription && !isTranscribing && (
                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                >
                  <Mic className="size-3.5" />
                  Transcrire et resumer
                </Button>
              )}

              {isTranscribing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {transcribeProgress}
                </div>
              )}

              {transcription && (
                <div className="text-xs text-muted-foreground bg-white rounded p-2 border max-h-32 overflow-y-auto">
                  <p className="font-medium text-slate-700 mb-1">Transcription :</p>
                  <p className="whitespace-pre-wrap">{transcription}</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Contenu / Notes *</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Decrivez l'interaction, les points cles, les prochaines etapes..."
              rows={5}
              disabled={isLoading || isTranscribing}
            />
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading || isTranscribing}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isTranscribing}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || isTranscribing}>
            {isLoading ? "Enregistrement..." : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
