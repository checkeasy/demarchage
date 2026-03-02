"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PhoneCall, CalendarCheck, StickyNote, Mail, MessageSquare, ArrowRightLeft } from "lucide-react";

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
  onActivityAdded: () => void;
}

export function AddActivityDialog({ open, onOpenChange, prospectId, onActivityAdded }: AddActivityDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activityType, setActivityType] = useState("call_logged");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));

  const handleSubmit = async () => {
    if (!body.trim()) {
      toast.error("Le contenu est requis");
      return;
    }

    setIsLoading(true);
    try {
      const typeInfo = ACTIVITY_TYPES.find(t => t.value === activityType);
      const res = await fetch(`/api/prospects/${prospectId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: activityType,
          channel: typeInfo?.channel || "manual",
          subject: subject.trim() || typeInfo?.label || "Activite",
          body: body.trim(),
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
      onOpenChange(false);
      onActivityAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une activite</DialogTitle>
          <DialogDescription>
            Enregistrez un appel, une reunion, une note ou toute interaction avec ce prospect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type d&apos;activite</Label>
            <Select value={activityType} onValueChange={setActivityType}>
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
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Contenu / Notes *</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Decrivez l'interaction, les points cles, les prochaines etapes..."
              rows={5}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Enregistrement..." : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
