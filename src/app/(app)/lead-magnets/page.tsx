"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenerateLeadMagnetDialog } from "@/components/lead-magnets/GenerateLeadMagnetDialog";
import { LeadMagnetViewer } from "@/components/lead-magnets/LeadMagnetViewer";

interface LeadMagnet {
  id: string;
  segment_key: string;
  title: string;
  content_markdown: string;
  lead_magnet_type: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  checklist: { label: "Checklist", color: "bg-blue-100 text-blue-700" },
  mini_guide: { label: "Mini-guide", color: "bg-green-100 text-green-700" },
  template: { label: "Template", color: "bg-purple-100 text-purple-700" },
  audit_framework: { label: "Audit", color: "bg-amber-100 text-amber-700" },
};

export default function LeadMagnetsPage() {
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<LeadMagnet | null>(null);

  const fetchLeadMagnets = async () => {
    try {
      const res = await fetch("/api/ai/lead-magnet");
      const data = await res.json();
      if (data.leadMagnets) {
        setLeadMagnets(data.leadMagnets);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadMagnets();
  }, []);

  const handleGenerated = (lm: LeadMagnet) => {
    setLeadMagnets((prev) => [lm, ...prev]);
  };

  const handleDelete = (id: string) => {
    setLeadMagnets((prev) => prev.filter((lm) => lm.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Lead Magnets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generez du contenu de valeur pour vos segments ICP
          </p>
        </div>
        <GenerateLeadMagnetDialog onGenerated={handleGenerated} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : leadMagnets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-slate-900 mb-1">
              Aucun lead magnet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Generez votre premier lead magnet en cliquant sur le bouton ci-dessus.
              Choisissez un segment, une industrie et un type de contenu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leadMagnets.map((lm) => {
            const typeConf = TYPE_LABELS[lm.lead_magnet_type] || {
              label: lm.lead_magnet_type,
              color: "bg-slate-100 text-slate-700",
            };
            return (
              <Card
                key={lm.id}
                className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                onClick={() => setSelected(lm)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm line-clamp-2">
                      {lm.title}
                    </CardTitle>
                    <Badge className={`shrink-0 text-[10px] ${typeConf.color}`}>
                      {typeConf.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                    {lm.content_markdown
                      .replace(/^#+\s.*/gm, "")
                      .replace(/\n+/g, " ")
                      .trim()
                      .slice(0, 200)}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Segment : {lm.segment_key}</span>
                    <span>
                      {new Date(lm.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Viewer */}
      {selected && (
        <LeadMagnetViewer
          leadMagnet={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
