"use client";

import { useState, useEffect, useCallback } from "react";
import { StickyNote } from "lucide-react";

import { AddNoteForm } from "@/components/notes/AddNoteForm";
import { NoteItem } from "@/components/notes/NoteItem";
import type { Note } from "@/lib/types/crm";

interface NoteListProps {
  dealId?: string;
  prospectId?: string;
}

export function NoteList({ dealId, prospectId }: NoteListProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams();
    if (dealId) params.set("deal_id", dealId);
    if (prospectId) params.set("prospect_id", prospectId);

    try {
      const res = await fetch(`/api/notes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch {
      // Silently fail, notes will show empty
    } finally {
      setLoading(false);
    }
  }, [dealId, prospectId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleUpdate = useCallback(() => {
    fetchNotes();
  }, [fetchNotes]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-24 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <AddNoteForm
        dealId={dealId}
        prospectId={prospectId}
        onNoteAdded={handleUpdate}
      />

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <StickyNote className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune note pour le moment</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
