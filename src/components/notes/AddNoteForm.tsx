"use client";

import { useState } from "react";
import { Pin, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AddNoteFormProps {
  dealId?: string;
  prospectId?: string;
  onNoteAdded: () => void;
}

export function AddNoteForm({
  dealId,
  prospectId,
  onNoteAdded,
}: AddNoteFormProps) {
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!content.trim()) {
      toast.error("Le contenu de la note est requis");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          deal_id: dealId || null,
          prospect_id: prospectId || null,
          is_pinned: isPinned,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la creation");
        return;
      }

      toast.success("Note ajoutee");
      setContent("");
      setIsPinned(false);
      setFocused(false);
      onNoteAdded();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        placeholder="Ajouter une note..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setFocused(true)}
        rows={focused ? 3 : 1}
        className="text-sm transition-all resize-none"
      />

      {focused && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsPinned(!isPinned)}
            className={isPinned ? "text-amber-600" : "text-slate-400"}
          >
            <Pin
              className={`size-3.5 ${
                isPinned ? "fill-amber-600" : ""
              }`}
            />
            {isPinned ? "Epinglee" : "Epingler"}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setContent("");
                setFocused(false);
                setIsPinned(false);
              }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !content.trim()}
            >
              <Send className="size-3.5" />
              {loading ? "Envoi..." : "Ajouter"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
