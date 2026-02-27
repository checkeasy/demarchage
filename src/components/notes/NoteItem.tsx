"use client";

import { useState } from "react";
import { Pin, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Note } from "@/lib/types/crm";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "A l'instant";
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return "Hier";
  if (diffDays < 7)
    return `Il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface NoteItemProps {
  note: Note;
  onUpdate: () => void;
}

export function NoteItem({ note, onUpdate }: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const authorName = note.author?.full_name || "Utilisateur";
  const authorInitial = authorName.charAt(0).toUpperCase();

  async function handleTogglePin() {
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      });

      if (!res.ok) {
        toast.error("Erreur lors de la mise a jour");
        return;
      }

      toast.success(
        note.is_pinned ? "Note desepinglee" : "Note epinglee"
      );
      onUpdate();
    } catch {
      toast.error("Erreur de connexion");
    }
  }

  async function handleSaveEdit() {
    if (!editContent.trim()) {
      toast.error("Le contenu ne peut pas etre vide");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (!res.ok) {
        toast.error("Erreur lors de la mise a jour");
        return;
      }

      toast.success("Note mise a jour");
      setIsEditing(false);
      onUpdate();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Erreur lors de la suppression");
        return;
      }

      toast.success("Note supprimee");
      onUpdate();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div
      className={`border rounded-lg p-4 ${
        note.is_pinned ? "bg-amber-50/50 border-amber-200" : "bg-white"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="flex items-center justify-center size-7 rounded-full bg-slate-200 text-xs font-medium text-slate-600">
            {authorInitial}
          </div>
          <span className="text-sm font-medium text-slate-700">
            {authorName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(note.created_at)}
          </span>
          {note.is_pinned && (
            <Pin className="size-3 text-amber-600 fill-amber-600" />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={handleTogglePin}
            title={note.is_pinned ? "Desepingler" : "Epingler"}
          >
            <Pin
              className={`size-3.5 ${
                note.is_pinned
                  ? "text-amber-600 fill-amber-600"
                  : "text-slate-400"
              }`}
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={() => {
              setEditContent(note.content);
              setIsEditing(!isEditing);
            }}
            title="Modifier"
          >
            <Pencil className="size-3.5 text-slate-400" />
          </Button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleDelete}
                disabled={loading}
              >
                Confirmer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                onClick={() => setConfirmDelete(false)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={() => setConfirmDelete(true)}
              title="Supprimer"
            >
              <Trash2 className="size-3.5 text-slate-400 hover:text-red-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              <X className="size-3.5" />
              Annuler
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={loading}>
              <Check className="size-3.5" />
              Sauvegarder
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {note.content}
        </p>
      )}
    </div>
  );
}
