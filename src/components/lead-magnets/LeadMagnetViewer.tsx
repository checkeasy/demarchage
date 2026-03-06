"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Check, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface LeadMagnet {
  id: string;
  segment_key: string;
  title: string;
  content_markdown: string;
  lead_magnet_type: string;
  created_at: string;
}

interface LeadMagnetViewerProps {
  leadMagnet: LeadMagnet;
  open: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  checklist: { label: "Checklist", color: "bg-blue-100 text-blue-700" },
  mini_guide: { label: "Mini-guide", color: "bg-green-100 text-green-700" },
  template: { label: "Template", color: "bg-purple-100 text-purple-700" },
  audit_framework: { label: "Audit", color: "bg-amber-100 text-amber-700" },
};

export function LeadMagnetViewer({ leadMagnet, open, onClose, onDelete }: LeadMagnetViewerProps) {
  const [copied, setCopied] = useState(false);

  const typeConf = TYPE_LABELS[leadMagnet.lead_magnet_type] || {
    label: leadMagnet.lead_magnet_type,
    color: "bg-slate-100 text-slate-700",
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(leadMagnet.content_markdown);
    setCopied(true);
    toast.success("Contenu copie dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([leadMagnet.content_markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${leadMagnet.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Fichier telecharge");
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/ai/lead-magnet?id=${leadMagnet.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erreur de suppression");
      toast.success("Lead magnet supprime");
      onDelete(leadMagnet.id);
      onClose();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <span className="truncate">{leadMagnet.title}</span>
            <Badge className={`shrink-0 text-xs ${typeConf.color}`}>
              {typeConf.label}
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Segment : {leadMagnet.segment_key} &middot;{" "}
            {new Date(leadMagnet.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border rounded-lg bg-slate-50 p-4">
          <div className="prose prose-sm max-w-none">
            {leadMagnet.content_markdown.split("\n").map((line, i) => {
              if (line.startsWith("# ")) {
                return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
              }
              if (line.startsWith("## ")) {
                return <h2 key={i} className="text-lg font-semibold mt-3 mb-1.5">{line.slice(3)}</h2>;
              }
              if (line.startsWith("### ")) {
                return <h3 key={i} className="text-base font-medium mt-2 mb-1">{line.slice(4)}</h3>;
              }
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <div key={i} className="flex gap-2 ml-4">
                    <span className="text-muted-foreground shrink-0">&bull;</span>
                    <span>{line.slice(2)}</span>
                  </div>
                );
              }
              if (line.match(/^\d+\.\s/)) {
                return (
                  <div key={i} className="flex gap-2 ml-4">
                    <span className="text-muted-foreground shrink-0 font-medium">{line.match(/^\d+/)![0]}.</span>
                    <span>{line.replace(/^\d+\.\s/, "")}</span>
                  </div>
                );
              }
              if (line.startsWith("**") && line.endsWith("**")) {
                return <p key={i} className="font-semibold mt-2">{line.slice(2, -2)}</p>;
              }
              if (line.trim() === "") {
                return <div key={i} className="h-2" />;
              }
              return <p key={i} className="text-sm leading-relaxed">{line}</p>;
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
            onClick={handleDelete}
          >
            <Trash2 className="size-3" />
            Supprimer
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleDownload}>
              <Download className="size-3" />
              Telecharger
            </Button>
            <Button size="sm" className="gap-1 text-xs" onClick={handleCopy}>
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copie !" : "Copier"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
