"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Calendar,
  Mail,
  CheckSquare,
  RefreshCw,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIVITY_TYPES, ACTIVITY_PRIORITIES } from "@/lib/constants";

type ActivityType = keyof typeof ACTIVITY_TYPES;

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone,
  Calendar,
  Mail,
  CheckSquare,
  RefreshCw,
  Monitor,
};

interface DealOption {
  id: string;
  title: string;
}

interface ProspectOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: DealOption[];
  prospects: ProspectOption[];
  defaultDealId?: string;
  defaultProspectId?: string;
}

export function AddActivityDialog({
  open,
  onOpenChange,
  deals,
  prospects,
  defaultDealId,
  defaultProspectId,
}: AddActivityDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [activityType, setActivityType] = useState<ActivityType>("call");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dealId, setDealId] = useState(defaultDealId || "");
  const [prospectId, setProspectId] = useState(defaultProspectId || "");

  function resetForm() {
    setActivityType("call");
    setTitle("");
    setDescription("");
    setDueDate("");
    setDurationMinutes("");
    setPriority("normal");
    setDealId(defaultDealId || "");
    setProspectId(defaultProspectId || "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: activityType,
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate || null,
          duration_minutes: durationMinutes
            ? parseInt(durationMinutes, 10)
            : null,
          priority,
          deal_id: dealId || null,
          prospect_id: prospectId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la creation");
        return;
      }

      toast.success("Activite creee");
      resetForm();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle activite</DialogTitle>
          <DialogDescription>
            Planifiez un appel, une reunion, un email ou une tache.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Activity type chips */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {(
                Object.entries(ACTIVITY_TYPES) as [
                  ActivityType,
                  (typeof ACTIVITY_TYPES)[ActivityType]
                ][]
              ).map(([key, config]) => {
                const Icon = ICON_MAP[config.icon];
                const isSelected = activityType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActivityType(key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      isSelected
                        ? `${config.bgColor} ${config.color} border-current font-medium`
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {Icon && <Icon className="size-3.5" />}
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="activity-title">Titre *</Label>
            <Input
              id="activity-title"
              placeholder="Ex: Appeler le prospect..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="activity-description">Description</Label>
            <Textarea
              id="activity-description"
              placeholder="Details supplementaires..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Due date + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="activity-due-date">Echeance</Label>
              <Input
                id="activity-due-date"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-duration">Duree (min)</Label>
              <Input
                id="activity-duration"
                type="number"
                min="0"
                placeholder="30"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priorite</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_PRIORITIES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Deal link */}
          <div className="space-y-2">
            <Label>Deal lie</Label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun deal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun deal</SelectItem>
                {deals.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prospect link */}
          <div className="space-y-2">
            <Label>Prospect lie</Label>
            <Select value={prospectId} onValueChange={setProspectId}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun prospect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun prospect</SelectItem>
                {prospects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {[p.first_name, p.last_name].filter(Boolean).join(" ") ||
                      p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creation..." : "Creer l'activite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
