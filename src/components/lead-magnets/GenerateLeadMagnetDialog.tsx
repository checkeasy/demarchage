"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface LeadMagnet {
  id: string;
  segment_key: string;
  title: string;
  content_markdown: string;
  lead_magnet_type: string;
  created_at: string;
}

interface GenerateLeadMagnetDialogProps {
  onGenerated: (lm: LeadMagnet) => void;
}

const TYPE_OPTIONS = [
  { value: "checklist", label: "Checklist actionnable" },
  { value: "mini_guide", label: "Mini-guide pratique" },
  { value: "template", label: "Template pret a l'emploi" },
  { value: "audit_framework", label: "Framework d'audit" },
];

export function GenerateLeadMagnetDialog({ onGenerated }: GenerateLeadMagnetDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [industry, setIndustry] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [type, setType] = useState("checklist");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!segmentName.trim() || !industry.trim()) {
      toast.error("Segment et industrie sont requis");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/lead-magnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment_name: segmentName.trim(),
          industry: industry.trim(),
          pain_points: painPoints
            .split("\n")
            .map((p) => p.trim())
            .filter(Boolean),
          lead_magnet_type: type,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de generation");

      toast.success("Lead magnet genere !");
      onGenerated(data.leadMagnet);
      setOpen(false);
      setSegmentName("");
      setIndustry("");
      setPainPoints("");
      setType("checklist");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Generer un lead magnet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-600" />
            Nouveau lead magnet
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="segment">Segment cible</Label>
            <Input
              id="segment"
              placeholder="ex: Conciergeries Airbnb"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industrie</Label>
            <Input
              id="industry"
              placeholder="ex: Location courte duree"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pain-points">Pain points (un par ligne)</Label>
            <Textarea
              id="pain-points"
              placeholder={"Gestion des avis clients\nOptimisation des tarifs\nCommunication voyageurs"}
              value={painPoints}
              onChange={(e) => setPainPoints(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>Type de contenu</Label>
            <Select value={type} onValueChange={setType} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isLoading ? "Generation en cours..." : "Generer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
