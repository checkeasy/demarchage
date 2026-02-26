"use client";

import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Eye, Code } from "lucide-react";

const VARIABLES = [
  { key: "{firstName}", label: "Prenom" },
  { key: "{lastName}", label: "Nom" },
  { key: "{company}", label: "Entreprise" },
  { key: "{jobTitle}", label: "Poste" },
  { key: "{email}", label: "Email" },
];

const SAMPLE_DATA: Record<string, string> = {
  "{firstName}": "Jean",
  "{lastName}": "Dupont",
  "{company}": "Acme SARL",
  "{jobTitle}": "Directeur Commercial",
  "{email}": "jean.dupont@acme.fr",
};

interface EmailComposerProps {
  subject: string;
  body: string;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  showSignatureToggle?: boolean;
  signatureEnabled?: boolean;
  onSignatureToggle?: (enabled: boolean) => void;
}

export function EmailComposer({
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  showSignatureToggle = true,
  signatureEnabled = true,
  onSignatureToggle,
}: EmailComposerProps) {
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = useCallback(
    (variable: string) => {
      if (activeField === "subject" && subjectRef.current) {
        const el = subjectRef.current;
        const start = el.selectionStart ?? subject.length;
        const end = el.selectionEnd ?? subject.length;
        const newValue =
          subject.substring(0, start) + variable + subject.substring(end);
        onSubjectChange(newValue);
        // Restore cursor position after variable
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + variable.length;
          el.setSelectionRange(pos, pos);
        });
      } else if (activeField === "body" && bodyRef.current) {
        const el = bodyRef.current;
        const start = el.selectionStart ?? body.length;
        const end = el.selectionEnd ?? body.length;
        const newValue =
          body.substring(0, start) + variable + body.substring(end);
        onBodyChange(newValue);
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + variable.length;
          el.setSelectionRange(pos, pos);
        });
      }
    },
    [activeField, subject, body, onSubjectChange, onBodyChange]
  );

  const renderPreview = (text: string) => {
    let result = text;
    for (const [key, value] of Object.entries(SAMPLE_DATA)) {
      result = result.replaceAll(key, `<strong class="text-blue-600">${value}</strong>`);
    }
    return result;
  };

  return (
    <div className="space-y-4">
      {/* Variable insertion toolbar */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Inserer une variable
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((v) => (
            <Button
              key={v.key}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-mono"
              onClick={() => insertVariable(v.key)}
            >
              {v.key}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="edit" className="flex-1">
            <Code className="size-3.5 mr-1.5" />
            Editeur
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-1">
            <Eye className="size-3.5 mr-1.5" />
            Apercu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-3 mt-3">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Objet</Label>
            <Input
              id="email-subject"
              ref={subjectRef}
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              onFocus={() => setActiveField("subject")}
              placeholder="Objet de l'email..."
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Corps du message</Label>
            <Textarea
              id="email-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              onFocus={() => setActiveField("body")}
              placeholder="Redigez votre email ici..."
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          {/* Signature toggle */}
          {showSignatureToggle && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={signatureEnabled}
                onChange={(e) => onSignatureToggle?.(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-muted-foreground">
                Inclure la signature
              </span>
            </label>
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-3">
          <div className="rounded-lg border bg-white p-4 space-y-3">
            {/* Subject preview */}
            <div className="border-b pb-3">
              <p className="text-xs text-muted-foreground mb-1">Objet :</p>
              <p
                className="text-sm font-medium"
                dangerouslySetInnerHTML={{
                  __html: renderPreview(subject) || "<em class='text-muted-foreground'>Aucun objet</em>",
                }}
              />
            </div>

            {/* Body preview */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Message :</p>
              <div
                className="text-sm whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html:
                    renderPreview(body) ||
                    "<em class='text-muted-foreground'>Aucun contenu</em>",
                }}
              />
            </div>

            {signatureEnabled && (
              <div className="border-t pt-3 text-xs text-muted-foreground italic">
                -- Signature --
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
