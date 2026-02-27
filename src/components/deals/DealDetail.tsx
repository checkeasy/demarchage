"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trophy,
  XCircle,
  Calendar,
  User,
  Building2,
  Save,
  Percent,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkDealDialog } from "@/components/deals/MarkDealDialog";
import { NoteList } from "@/components/notes/NoteList";
import { AddActivityDialog } from "@/components/activities/AddActivityDialog";
import type { Deal, PipelineStageConfig } from "@/lib/types/crm";

interface DealDetailProps {
  deal: Deal;
  stages: PipelineStageConfig[];
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getProspectName(deal: Deal): string {
  if (!deal.prospect) return "";
  const parts = [deal.prospect.first_name, deal.prospect.last_name].filter(
    Boolean
  );
  return parts.join(" ") || deal.prospect.email || "";
}

export function DealDetail({ deal, stages }: DealDetailProps) {
  const router = useRouter();

  // Editable state
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(deal.value?.toString() || "");
  const [stageId, setStageId] = useState(deal.stage_id);
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    deal.expected_close_date || ""
  );
  const [probability, setProbability] = useState(deal.probability || 0);

  const [saving, setSaving] = useState(false);
  const [markWonOpen, setMarkWonOpen] = useState(false);
  const [markLostOpen, setMarkLostOpen] = useState(false);
  const [addActivityOpen, setAddActivityOpen] = useState(false);

  const hasChanges =
    title !== deal.title ||
    value !== (deal.value?.toString() || "") ||
    stageId !== deal.stage_id ||
    expectedCloseDate !== (deal.expected_close_date || "") ||
    probability !== (deal.probability || 0);

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    setSaving(true);

    try {
      const body: Record<string, unknown> = {};

      if (title !== deal.title) body.title = title.trim();
      if (value !== (deal.value?.toString() || ""))
        body.value = value ? parseFloat(value) : 0;
      if (stageId !== deal.stage_id) body.stage_id = stageId;
      if (expectedCloseDate !== (deal.expected_close_date || ""))
        body.expected_close_date = expectedCloseDate || null;
      if (probability !== (deal.probability || 0))
        body.probability = probability;

      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      toast.success("Deal mis a jour");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const currentStage = stages.find((s) => s.id === stageId);
  const prospectName = getProspectName(deal);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/deals">
              <ArrowLeft className="size-4" />
              Retour
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{deal.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              {currentStage && (
                <Badge
                  variant="secondary"
                  className="gap-1.5"
                  style={{
                    backgroundColor: currentStage.color + "20",
                    color: currentStage.color,
                    borderColor: currentStage.color + "40",
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: currentStage.color }}
                  />
                  {currentStage.name}
                </Badge>
              )}
              <Badge
                variant={
                  deal.status === "won"
                    ? "default"
                    : deal.status === "lost"
                      ? "destructive"
                      : "secondary"
                }
                className={
                  deal.status === "won" ? "bg-green-600" : ""
                }
              >
                {deal.status === "won"
                  ? "Gagne"
                  : deal.status === "lost"
                    ? "Perdu"
                    : "En cours"}
              </Badge>
            </div>
          </div>
        </div>

        {deal.status === "open" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-green-200 text-green-700 hover:bg-green-50"
              onClick={() => setMarkWonOpen(true)}
            >
              <Trophy className="size-4" />
              Marquer gagne
            </Button>
            <Button
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => setMarkLostOpen(true)}
            >
              <XCircle className="size-4" />
              Marquer perdu
            </Button>
          </div>
        )}
      </div>

      {/* Won/Lost banners */}
      {deal.status === "won" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <Trophy className="size-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Deal gagne le {formatDate(deal.won_at)}
            </p>
            <p className="text-xs text-green-700">
              Valeur: {formatCurrency(deal.value)}
            </p>
          </div>
        </div>
      )}

      {deal.status === "lost" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="size-5 text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Deal perdu le {formatDate(deal.lost_at)}
            </p>
            {deal.loss_reason && (
              <p className="text-xs text-red-700 mt-1">
                Raison: {deal.loss_reason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Deal info (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations du deal</CardTitle>
              <CardDescription>
                Modifiez les details de ce deal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="detail-title">Titre</Label>
                <Input
                  id="detail-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={deal.status !== "open"}
                />
              </div>

              {/* Value */}
              <div className="space-y-2">
                <Label htmlFor="detail-value">Valeur (EUR)</Label>
                <Input
                  id="detail-value"
                  type="number"
                  min={0}
                  step={0.01}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={deal.status !== "open"}
                />
              </div>

              {/* Stage */}
              <div className="space-y-2">
                <Label>Etape du pipeline</Label>
                <Select
                  value={stageId}
                  onValueChange={setStageId}
                  disabled={deal.status !== "open"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Expected close date */}
              <div className="space-y-2">
                <Label htmlFor="detail-close-date">
                  Date de cloture prevue
                </Label>
                <Input
                  id="detail-close-date"
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  disabled={deal.status !== "open"}
                />
              </div>

              {/* Probability */}
              <div className="space-y-2">
                <Label>Probabilite: {probability}%</Label>
                <Slider
                  value={[probability]}
                  onValueChange={([val]) => setProbability(val)}
                  min={0}
                  max={100}
                  step={5}
                  disabled={deal.status !== "open"}
                />
              </div>

              {/* Save button */}
              {deal.status === "open" && hasChanges && (
                <div className="pt-2">
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="size-4" />
                    {saving ? "Sauvegarde..." : "Sauvegarder"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prospect info card */}
          {deal.prospect && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="size-4" />
                  Prospect associe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nom</p>
                    <p className="font-medium">{prospectName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{deal.prospect.email}</p>
                  </div>
                  {deal.prospect.company && (
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Building2 className="size-3" />
                        Entreprise
                      </p>
                      <p className="font-medium">{deal.prospect.company}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/prospects/${deal.prospect.id}`}>
                      Voir la fiche prospect
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deal metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Informations supplementaires</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="size-3" />
                    Date de creation
                  </p>
                  <p className="font-medium">{formatDate(deal.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="size-3" />
                    Derniere modification
                  </p>
                  <p className="font-medium">{formatDate(deal.updated_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Percent className="size-3" />
                    Probabilite
                  </p>
                  <p className="font-medium">{deal.probability}%</p>
                </div>
                {deal.owner && (
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <User className="size-3" />
                      Responsable
                    </p>
                    <p className="font-medium">
                      {deal.owner.full_name || "Non assigne"}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Activities & Notes placeholders (1/3) */}
        <div className="space-y-6">
          {/* Activities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Activites</CardTitle>
                <CardDescription>
                  Taches et interactions liees a ce deal
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setAddActivityOpen(true)}>
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Les activites liees a ce deal apparaitront dans la page{" "}
                <Link href="/activities" className="text-blue-600 hover:underline">Activites</Link>.
              </p>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>
                Notes et commentaires sur ce deal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NoteList dealId={deal.id} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Activity Dialog */}
      <AddActivityDialog
        open={addActivityOpen}
        onOpenChange={setAddActivityOpen}
        deals={[{ id: deal.id, title: deal.title }]}
        prospects={deal.prospect ? [{ id: deal.prospect.id, first_name: deal.prospect.first_name, last_name: deal.prospect.last_name, email: deal.prospect.email }] : []}
        defaultDealId={deal.id}
        defaultProspectId={deal.prospect_id || undefined}
      />

      {/* Mark Deal Dialogs */}
      <MarkDealDialog
        deal={deal}
        type="won"
        open={markWonOpen}
        onOpenChange={setMarkWonOpen}
      />
      <MarkDealDialog
        deal={deal}
        type="lost"
        open={markLostOpen}
        onOpenChange={setMarkLostOpen}
      />
    </div>
  );
}
