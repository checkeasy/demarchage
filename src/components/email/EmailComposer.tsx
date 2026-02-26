"use client";

import { useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trackAction } from "@/lib/linkedin/safety-tracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

interface EmailRecipient {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
}

interface EmailComposerProps {
  open: boolean;
  onClose: () => void;
  recipient: EmailRecipient;
}

const TEMPLATES = [
  {
    id: "cold-intro",
    name: "Introduction a froid",
    subject: "Question rapide pour {company}",
    body: `Bonjour {firstName},

Je me permets de vous contacter car je travaille avec des entreprises comme {company} sur la digitalisation de leurs processus.

J'ai remarque votre profil ({jobTitle}) et je pense que nous pourrions echanger sur des solutions qui pourraient vous faire gagner du temps au quotidien.

Seriez-vous disponible pour un echange de 15 minutes cette semaine ?

Cordialement`,
  },
  {
    id: "value-prop",
    name: "Proposition de valeur",
    subject: "{firstName}, une solution pour {company}",
    body: `Bonjour {firstName},

En tant que {jobTitle} chez {company}, vous etes certainement confronte(e) a des defis de productivite et d'organisation.

Nous avons developpe une solution qui permet a des entreprises similaires de :
- Reduire le temps administratif de 40%
- Automatiser les taches repetitives
- Centraliser la gestion en un seul outil

Souhaitez-vous que je vous montre comment cela fonctionne en 10 minutes ?

Bien cordialement`,
  },
  {
    id: "follow-up",
    name: "Relance",
    subject: "Suite a mon message, {firstName}",
    body: `Bonjour {firstName},

Je me permets de revenir vers vous suite a mon precedent message.

Je comprends que vous etes tres occupe(e), mais je suis convaincu(e) que 10 minutes de votre temps pourraient vraiment valoir le coup.

Quand seriez-vous disponible pour un bref echange ?

Cordialement`,
  },
  {
    id: "custom",
    name: "Message personnalise",
    subject: "",
    body: "",
  },
];

function replaceVariables(
  text: string,
  recipient: EmailRecipient
): string {
  return text
    .replace(/{firstName}/g, recipient.firstName)
    .replace(/{lastName}/g, recipient.lastName)
    .replace(/{company}/g, recipient.company)
    .replace(/{jobTitle}/g, recipient.jobTitle)
    .replace(/{email}/g, recipient.email);
}

export function EmailComposer({
  open,
  onClose,
  recipient,
}: EmailComposerProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  function handleTemplateChange(templateId: string) {
    setSelectedTemplate(templateId);
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template && templateId !== "custom") {
      setSubject(replaceVariables(template.subject, recipient));
      setBody(replaceVariables(template.body, recipient));
    }
  }

  async function handleGenerateAI() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: {
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            company: recipient.company,
            jobTitle: recipient.jobTitle,
          },
          context: subject || "cold outreach",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.subject) setSubject(data.subject);
        if (data.body) setBody(data.body);
        toast.success("Email genere par IA");
      } else {
        toast.error("Erreur lors de la generation IA");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Sujet et corps du message requis");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient.email,
          subject,
          body: body.replace(/\n/g, "<br>"),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        trackAction('message');
        toast.success(`Email envoye a ${recipient.email}`);
        onClose();
        setSubject("");
        setBody("");
        setSelectedTemplate("");
      } else {
        toast.error(data.error || "Erreur lors de l'envoi");
      }
    } catch {
      toast.error("Erreur reseau lors de l'envoi");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Envoyer un email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Recipient */}
          <div>
            <Label className="text-xs text-muted-foreground">Destinataire</Label>
            <div className="text-sm font-medium mt-0.5">
              {recipient.firstName} {recipient.lastName} &lt;{recipient.email}&gt;
            </div>
            <div className="text-xs text-muted-foreground">
              {recipient.jobTitle} - {recipient.company}
            </div>
          </div>

          {/* Template selector */}
          <div>
            <Label>Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choisir un template..." />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div>
            <Label>Sujet</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet de l'email..."
              className="mt-1"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Message</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="text-xs h-7"
              >
                {isGenerating ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Generer avec IA
              </Button>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Corps du message..."
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}>
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
