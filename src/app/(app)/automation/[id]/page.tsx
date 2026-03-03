"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  UserCheck,
  MessageSquare,
  CalendarCheck,
  Users,
  Play,
  Pause,
  Square,
  Loader2,
  Save,
  Eye,
  Layers,
  BarChart3,
  Activity,
  Clock,
  Shield,
  UserPlus,
  Mail,
  GitBranch,
  Search,
  ExternalLink,
  Sparkles,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Settings,
  Linkedin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Types ---
interface SequenceStep {
  id: string;
  stepOrder: number;
  actionType: string;
  delayDays: number;
  delayHours: number;
  messageTemplate: string | null;
  subjectTemplate: string | null;
  useAiGeneration: boolean;
  conditionType: string | null;
  isActive: boolean;
}

interface SequenceConfig {
  maxConnectionsDay: number;
  maxMessagesDay: number;
  sendingHoursStart: string;
  sendingHoursEnd: string;
  sendingDays: boolean[];
  delayMin: number;
  delayMax: number;
}

interface SequenceData {
  id: string;
  name: string;
  status: "active" | "paused" | "completed";
  totalProspects: number;
  processedProspects: number;
  stats: {
    connected: number;
    replied: number;
    ignored: number;
    meetings: number;
  };
  config: SequenceConfig;
  steps: SequenceStep[];
  createdAt: string;
  launchedAt: string | null;
  completedAt: string | null;
}

interface ProspectInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  organization: string | null;
  linkedin_url: string | null;
  lead_score: number | null;
}

interface SequenceProspect {
  id: string;
  prospect_id: string;
  status: string;
  current_step_id: string | null;
  next_action_at: string | null;
  created_at: string | null;
  completed_at: string | null;
  prospect: ProspectInfo | ProspectInfo[] | null;
}

interface ActivityLog {
  id: string;
  action_type: string;
  status: string;
  message_sent: string | null;
  error_message: string | null;
  created_at: string;
}

// --- Constants ---
const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  active: {
    label: "Active",
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
  },
  paused: {
    label: "En pause",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dotColor: "bg-yellow-500",
  },
  completed: {
    label: "Terminee",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dotColor: "bg-blue-500",
  },
};

const PROSPECT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "bg-green-100 text-green-700" },
  paused: { label: "En pause", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Termine", color: "bg-blue-100 text-blue-700" },
  replied: { label: "Repondu", color: "bg-purple-100 text-purple-700" },
  connected: { label: "Connecte", color: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Echoue", color: "bg-red-100 text-red-700" },
};

const ACTION_TYPE_CONFIG: Record<string, { icon: typeof Eye; label: string; color: string; bgColor: string }> = {
  view_profile: { icon: Eye, label: "Voir le profil", color: "text-slate-600", bgColor: "bg-slate-100" },
  connect: { icon: UserPlus, label: "Demande de connexion", color: "text-blue-600", bgColor: "bg-blue-50" },
  message: { icon: MessageSquare, label: "Envoyer un message", color: "text-green-600", bgColor: "bg-green-50" },
  email: { icon: Mail, label: "Envoyer un email", color: "text-purple-600", bgColor: "bg-purple-50" },
  wait: { icon: Clock, label: "Attendre", color: "text-amber-600", bgColor: "bg-amber-50" },
  check_accepted: { icon: GitBranch, label: "Condition", color: "text-orange-600", bgColor: "bg-orange-50" },
  condition: { icon: GitBranch, label: "Condition", color: "text-orange-600", bgColor: "bg-orange-50" },
};

const LOG_TYPE_CONFIG: Record<string, { color: string; bgColor: string; icon: typeof Eye }> = {
  view_profile: { color: "text-slate-500", bgColor: "bg-slate-100", icon: Eye },
  connect: { color: "text-blue-600", bgColor: "bg-blue-50", icon: UserPlus },
  message: { color: "text-green-600", bgColor: "bg-green-50", icon: MessageSquare },
  email: { color: "text-purple-600", bgColor: "bg-purple-50", icon: Mail },
  check_accepted: { color: "text-orange-600", bgColor: "bg-orange-50", icon: GitBranch },
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getProspectData(cp: SequenceProspect): ProspectInfo | null {
  if (!cp.prospect) return null;
  return Array.isArray(cp.prospect) ? cp.prospect[0] || null : cp.prospect;
}

// --- Sub-components ---

function StepEditorCard({
  step,
  index,
  totalSteps,
  expanded,
  onToggleExpand,
  onUpdate,
  onMove,
  onRemove,
  onGenerateAI,
  isGenerating,
}: {
  step: SequenceStep;
  index: number;
  totalSteps: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<SequenceStep>) => void;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
  onGenerateAI: () => void;
  isGenerating: boolean;
}) {
  const cfg = ACTION_TYPE_CONFIG[step.actionType] || ACTION_TYPE_CONFIG.view_profile;
  const Icon = cfg.icon;
  const hasMessage = ["connect", "message", "email"].includes(step.actionType);

  return (
    <div className="relative flex gap-4">
      {index < totalSteps - 1 && (
        <div className="absolute left-[23px] top-12 bottom-0 w-px bg-slate-200" />
      )}
      <div className="relative z-10 shrink-0">
        <div className={`flex items-center justify-center size-12 rounded-full ${cfg.bgColor} border-2 border-white shadow-sm`}>
          <Icon className={`size-5 ${cfg.color}`} />
        </div>
      </div>
      <Card className="flex-1 mb-1">
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{cfg.label}</span>
              <Badge variant="secondary" className="text-[10px]">Jour {step.delayDays}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => onMove("up")} disabled={index === 0}>
                <ChevronUp className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => onMove("down")} disabled={index === totalSteps - 1}>
                <ChevronDown className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="size-7 p-0" onClick={onToggleExpand}>
                <GripVertical className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="size-7 p-0 text-red-500 hover:text-red-700" onClick={onRemove}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          {!expanded && hasMessage && step.messageTemplate && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 cursor-pointer" onClick={onToggleExpand}>
              {step.messageTemplate}
            </p>
          )}

          {expanded && (
            <div className="mt-4 space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type d&apos;etape</Label>
                  <Select value={step.actionType} onValueChange={(value) => onUpdate({ actionType: value })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view_profile">Voir le profil</SelectItem>
                      <SelectItem value="connect">Demande de connexion</SelectItem>
                      <SelectItem value="message">Envoyer un message</SelectItem>
                      <SelectItem value="email">Envoyer un email</SelectItem>
                      <SelectItem value="wait">Attendre</SelectItem>
                      <SelectItem value="check_accepted">Condition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delai (jours)</Label>
                  <Input type="number" min={0} value={step.delayDays} onChange={(e) => onUpdate({ delayDays: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              {hasMessage && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Message</Label>
                    <Button variant="outline" size="sm" onClick={onGenerateAI} disabled={isGenerating} className="h-7 text-xs">
                      {isGenerating ? (
                        <div className="flex items-center gap-1.5">
                          <div className="size-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                          Generation...
                        </div>
                      ) : (
                        <><Sparkles className="size-3" />Generer avec IA</>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={step.messageTemplate || ""}
                    onChange={(e) => onUpdate({ messageTemplate: e.target.value })}
                    placeholder="Ecrivez votre message ou generez-le avec l'IA..."
                    className="min-h-[100px]"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Variables : {"{prenom}"}, {"{nom}"}, {"{entreprise}"}, {"{poste}"}, {"{secteur}"}
                  </p>
                </div>
              )}

              {step.actionType === "check_accepted" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Type de condition</Label>
                  <Select value={step.conditionType || "connected"} onValueChange={(value) => onUpdate({ conditionType: value })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="connected">Si connecte</SelectItem>
                      <SelectItem value="replied">Si a repondu</SelectItem>
                      <SelectItem value="no_reply">Si pas de reponse</SelectItem>
                      <SelectItem value="email_available">Si email disponible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main Page ---
export default function AutomationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [sequence, setSequence] = useState<SequenceData | null>(null);
  const [prospects, setProspects] = useState<SequenceProspect[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);

  // Editable state
  const [editName, setEditName] = useState("");
  const [editConfig, setEditConfig] = useState<SequenceConfig>({
    maxConnectionsDay: 25,
    maxMessagesDay: 50,
    sendingHoursStart: "08:00",
    sendingHoursEnd: "18:00",
    sendingDays: [true, true, true, true, true, false, false],
    delayMin: 2,
    delayMax: 8,
  });
  const [editSteps, setEditSteps] = useState<SequenceStep[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // LinkedIn search
  const [isSearchingLinkedIn, setIsSearchingLinkedIn] = useState(false);
  const [linkedinResults, setLinkedinResults] = useState<{ found: number; total: number } | null>(null);

  // Prospect filters
  const [prospectSearch, setProspectSearch] = useState("");
  const [prospectStatusFilter, setProspectStatusFilter] = useState("all");

  const loadSequence = useCallback(async () => {
    try {
      const res = await fetch(`/api/automation/sequences/${id}`);
      if (!res.ok) {
        toast.error("Sequence non trouvee");
        router.push("/automation");
        return;
      }
      const data = await res.json();
      setSequence(data.sequence);
      setProspects(data.prospects || []);
      setActivity(data.activity || []);
      setEditName(data.sequence.name);
      setEditConfig(data.sequence.config);
      setEditSteps(data.sequence.steps);
      setHasChanges(false);
    } catch {
      toast.error("Erreur de chargement");
      router.push("/automation");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadSequence();
  }, [loadSequence]);

  // Track changes
  useEffect(() => {
    if (!sequence) return;
    const nameChanged = editName !== sequence.name;
    const configChanged = JSON.stringify(editConfig) !== JSON.stringify(sequence.config);
    const stepsChanged = JSON.stringify(editSteps) !== JSON.stringify(sequence.steps);
    setHasChanges(nameChanged || configChanged || stepsChanged);
  }, [editName, editConfig, editSteps, sequence]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/automation/sequences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, config: editConfig, steps: editSteps }),
      });
      if (res.ok) {
        toast.success("Modifications sauvegardees");
        loadSequence();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/automation/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const labels: Record<string, string> = { active: "Sequence reprise", paused: "Sequence mise en pause", completed: "Sequence arretee" };
        toast.success(labels[newStatus] || "Statut mis a jour");
        loadSequence();
      } else {
        toast.error("Erreur lors de la mise a jour");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleGenerateAI(stepId: string) {
    setIsGenerating(stepId);
    try {
      const step = editSteps.find((s) => s.id === stepId);
      if (!step) return;
      const res = await fetch("/api/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { firstName: "{prenom}", lastName: "{nom}", company: "{entreprise}", jobTitle: "{poste}" },
          context: step.actionType === "connect" ? "message court de demande de connexion LinkedIn (max 300 caracteres)" : step.actionType === "email" ? "email de prospection froid" : "message de relance LinkedIn",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, messageTemplate: data.body || data.subject || "" } : s));
        toast.success("Message genere par l'IA");
      } else {
        toast.error("Erreur lors de la generation IA");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsGenerating(null);
    }
  }

  async function handleSearchLinkedIn() {
    setIsSearchingLinkedIn(true);
    setLinkedinResults(null);
    try {
      const res = await fetch("/api/prospects/find-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId: id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLinkedinResults({ found: data.found, total: data.total });
        toast.success(`${data.found} profil(s) LinkedIn trouve(s) sur ${data.total} prospect(s)`);
        loadSequence();
      } else {
        toast.error(data.error || "Erreur lors de la recherche LinkedIn");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsSearchingLinkedIn(false);
    }
  }

  // Prospect filtering
  const filteredProspects = useMemo(() => {
    return prospects.filter((cp) => {
      const p = getProspectData(cp);
      if (!p) return false;
      if (prospectStatusFilter !== "all" && cp.status !== prospectStatusFilter) return false;
      if (prospectSearch.trim()) {
        const q = prospectSearch.toLowerCase();
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ").toLowerCase();
        const company = (p.organization || p.company || "").toLowerCase();
        if (!name.includes(q) && !p.email?.toLowerCase().includes(q) && !company.includes(q)) return false;
      }
      return true;
    });
  }, [prospects, prospectSearch, prospectStatusFilter]);

  const prospectStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cp of prospects) {
      counts[cp.status] = (counts[cp.status] || 0) + 1;
    }
    return counts;
  }, [prospects]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="size-10 animate-spin text-slate-300 mb-3" />
        <p className="text-sm text-muted-foreground">Chargement de la sequence...</p>
      </div>
    );
  }

  if (!sequence) return null;

  const statusConfig = STATUS_CONFIG[sequence.status] || STATUS_CONFIG.paused;
  const progressPercent = sequence.totalProspects > 0 ? Math.round((sequence.processedProspects / sequence.totalProspects) * 100) : 0;

  const stats = [
    { label: "Prospects", value: sequence.totalProspects.toString(), icon: Users, color: "text-blue-600", bgColor: "bg-blue-50" },
    { label: "Connectes", value: sequence.stats.connected.toString(), icon: UserCheck, color: "text-green-600", bgColor: "bg-green-50" },
    { label: "Reponses", value: sequence.stats.replied.toString(), icon: MessageSquare, color: "text-purple-600", bgColor: "bg-purple-50" },
    { label: "Ignores", value: sequence.stats.ignored.toString(), icon: Users, color: "text-slate-500", bgColor: "bg-slate-50" },
    { label: "Meetings", value: sequence.stats.meetings.toString(), icon: CalendarCheck, color: "text-pink-600", bgColor: "bg-pink-50" },
    { label: "Taux reponse", value: sequence.totalProspects > 0 ? `${Math.round((sequence.stats.replied / sequence.totalProspects) * 100)}%` : "0%", icon: BarChart3, color: "text-amber-600", bgColor: "bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/automation">
              <ArrowLeft className="size-4" />
              Retour
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">{sequence.name}</h2>
              <Badge variant="outline" className={`gap-1.5 ${statusConfig.color}`}>
                <span className={`size-1.5 rounded-full ${statusConfig.dotColor}`} />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {sequence.steps.length} etape{sequence.steps.length > 1 ? "s" : ""} - Creee le{" "}
              {new Date(sequence.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Sauvegarder
            </Button>
          )}
          {sequence.status === "active" && (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange("paused")} disabled={statusLoading}>
              {statusLoading ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
              Pause
            </Button>
          )}
          {sequence.status === "paused" && (
            <Button size="sm" onClick={() => handleStatusChange("active")} disabled={statusLoading}>
              {statusLoading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Reprendre
            </Button>
          )}
          {sequence.status !== "completed" && (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange("completed")} disabled={statusLoading} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Square className="size-3.5" />
              Arreter
            </Button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center size-8 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`size-4 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview"><Eye className="size-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Apercu</span></TabsTrigger>
          <TabsTrigger value="sequence"><Layers className="size-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Sequence</span></TabsTrigger>
          <TabsTrigger value="config"><Settings className="size-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Parametres</span></TabsTrigger>
          <TabsTrigger value="prospects"><Users className="size-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Prospects</span></TabsTrigger>
          <TabsTrigger value="activity"><Activity className="size-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Activite</span></TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Progression</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prospects traites</span>
                  <span className="font-medium">{sequence.processedProspects} / {sequence.totalProspects}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{progressPercent}% termine</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground">Limite connexions / jour</span>
                  <p className="font-medium">{sequence.config.maxConnectionsDay}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Limite messages / jour</span>
                  <p className="font-medium">{sequence.config.maxMessagesDay}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fenetre d&apos;envoi</span>
                  <p className="font-medium">{sequence.config.sendingHoursStart} - {sequence.config.sendingHoursEnd}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Jours d&apos;envoi</span>
                  <p className="font-medium">{DAY_LABELS.filter((_, i) => sequence.config.sendingDays[i]).join(", ")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Delai entre actions</span>
                  <p className="font-medium">{sequence.config.delayMin}s - {sequence.config.delayMax}s</p>
                </div>
                {sequence.launchedAt && (
                  <div>
                    <span className="text-muted-foreground">Lancee le</span>
                    <p className="font-medium">{new Date(sequence.launchedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sequence ({sequence.steps.length} etape{sequence.steps.length > 1 ? "s" : ""})</CardTitle>
            </CardHeader>
            <CardContent>
              {sequence.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune etape configuree.</p>
              ) : (
                <div className="space-y-2">
                  {sequence.steps.map((step, idx) => {
                    const cfg = ACTION_TYPE_CONFIG[step.actionType] || ACTION_TYPE_CONFIG.view_profile;
                    const Icon = cfg.icon;
                    return (
                      <div key={step.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                        <span className="flex items-center justify-center size-6 rounded-full bg-slate-200 text-xs font-medium">{idx + 1}</span>
                        <div className={`flex items-center justify-center size-7 rounded-full ${cfg.bgColor}`}>
                          <Icon className={`size-3.5 ${cfg.color}`} />
                        </div>
                        <span className="text-sm font-medium">{cfg.label}</span>
                        <Badge variant="secondary" className="text-[10px]">Jour {step.delayDays}</Badge>
                        {step.messageTemplate && (
                          <span className="text-xs text-muted-foreground truncate max-w-[300px]">{step.messageTemplate}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sequence Tab - Editable */}
        <TabsContent value="sequence" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Editer la sequence</CardTitle>
                  <CardDescription>Modifiez les etapes, messages et delais de votre sequence.</CardDescription>
                </div>
                {hasChanges && (
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Sauvegarder
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 mb-4">
                <Label className="text-xs">Nom de la sequence</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom de la sequence" />
              </div>

              <div className="space-y-3">
                {editSteps.map((step, index) => (
                  <StepEditorCard
                    key={step.id}
                    step={step}
                    index={index}
                    totalSteps={editSteps.length}
                    expanded={expandedSteps.has(step.id)}
                    onToggleExpand={() => {
                      setExpandedSteps((prev) => {
                        const next = new Set(prev);
                        if (next.has(step.id)) next.delete(step.id);
                        else next.add(step.id);
                        return next;
                      });
                    }}
                    onUpdate={(updates) => setEditSteps(editSteps.map((s) => s.id === step.id ? { ...s, ...updates } : s))}
                    onMove={(direction) => {
                      const newSteps = [...editSteps];
                      const target = direction === "up" ? index - 1 : index + 1;
                      if (target < 0 || target >= newSteps.length) return;
                      [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
                      setEditSteps(newSteps);
                    }}
                    onRemove={() => setEditSteps(editSteps.filter((s) => s.id !== step.id))}
                    onGenerateAI={() => handleGenerateAI(step.id)}
                    isGenerating={isGenerating === step.id}
                  />
                ))}

                <Button
                  variant="outline"
                  onClick={() => {
                    setEditSteps([...editSteps, {
                      id: `step-${Date.now()}`,
                      stepOrder: editSteps.length + 1,
                      actionType: "message",
                      delayDays: 2,
                      delayHours: 0,
                      messageTemplate: "",
                      subjectTemplate: null,
                      useAiGeneration: false,
                      conditionType: null,
                      isActive: true,
                    }]);
                  }}
                  className="w-full border-dashed"
                >
                  <Plus className="size-4" />
                  Ajouter une etape
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Parametres de la sequence</CardTitle>
                  <CardDescription>Modifiez les limites, horaires et delais de votre automation.</CardDescription>
                </div>
                {hasChanges && (
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Sauvegarder
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2"><Shield className="size-4" />Limites quotidiennes</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max connexions / jour</Label>
                    <Input type="number" min={1} max={100} value={editConfig.maxConnectionsDay} onChange={(e) => setEditConfig((prev) => ({ ...prev, maxConnectionsDay: parseInt(e.target.value) || 25 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max messages / jour</Label>
                    <Input type="number" min={1} max={200} value={editConfig.maxMessagesDay} onChange={(e) => setEditConfig((prev) => ({ ...prev, maxMessagesDay: parseInt(e.target.value) || 50 }))} />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2"><Clock className="size-4" />Heures d&apos;envoi</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Debut</Label>
                    <Input type="time" value={editConfig.sendingHoursStart} onChange={(e) => setEditConfig((prev) => ({ ...prev, sendingHoursStart: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fin</Label>
                    <Input type="time" value={editConfig.sendingHoursEnd} onChange={(e) => setEditConfig((prev) => ({ ...prev, sendingHoursEnd: e.target.value }))} />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Jours d&apos;envoi</h4>
                <div className="flex items-center gap-2">
                  {DAY_LABELS.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => setEditConfig((prev) => {
                        const days = [...prev.sendingDays];
                        days[idx] = !days[idx];
                        return { ...prev, sendingDays: days };
                      })}
                      className={`size-10 rounded-full text-xs font-medium transition-colors ${editConfig.sendingDays[idx] ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2"><Activity className="size-4" />Delai entre actions (secondes)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Minimum</Label>
                    <Input type="number" min={1} max={30} value={editConfig.delayMin} onChange={(e) => setEditConfig((prev) => ({ ...prev, delayMin: parseInt(e.target.value) || 2 }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Maximum</Label>
                    <Input type="number" min={1} max={60} value={editConfig.delayMax} onChange={(e) => setEditConfig((prev) => ({ ...prev, delayMax: parseInt(e.target.value) || 8 }))} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Un delai aleatoire entre {editConfig.delayMin}s et {editConfig.delayMax}s sera applique entre chaque action.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prospects Tab */}
        <TabsContent value="prospects" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div>
                    <CardTitle className="text-base">Prospects inscrits</CardTitle>
                    <CardDescription>{sequence.totalProspects} prospect{sequence.totalProspects > 1 ? "s" : ""} dans cette sequence</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSearchLinkedIn}
                    disabled={isSearchingLinkedIn}
                    className="shrink-0"
                  >
                    {isSearchingLinkedIn ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Linkedin className="size-4" />
                    )}
                    Rechercher les LinkedIn
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={prospectStatusFilter === "all" ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setProspectStatusFilter("all")}>
                    Tous ({prospects.length})
                  </Badge>
                  {Object.entries(prospectStatusCounts).map(([status, count]) => {
                    const cfg = PROSPECT_STATUS_MAP[status];
                    return (
                      <Badge
                        key={status}
                        variant={prospectStatusFilter === status ? "default" : "outline"}
                        className={`cursor-pointer text-xs ${prospectStatusFilter !== status && cfg ? cfg.color : ""}`}
                        onClick={() => setProspectStatusFilter(prospectStatusFilter === status ? "all" : status)}
                      >
                        {cfg?.label || status} ({count})
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Rechercher un prospect..." value={prospectSearch} onChange={(e) => setProspectSearch(e.target.value)} className="pl-10 h-9" />
              </div>

              {prospects.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="size-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucun prospect inscrit dans cette sequence.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prospect</TableHead>
                        <TableHead className="hidden sm:table-cell">Entreprise</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="hidden md:table-cell">Etape actuelle</TableHead>
                        <TableHead className="hidden lg:table-cell">Prochaine action</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProspects.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            Aucun prospect ne correspond a votre recherche.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProspects.slice(0, 50).map((cp) => {
                          const p = getProspectData(cp);
                          if (!p) return null;
                          const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;
                          const company = p.organization || p.company;
                          const statusCfg = PROSPECT_STATUS_MAP[cp.status];
                          const currentStep = cp.current_step_id ? sequence.steps.find((s) => s.id === cp.current_step_id) : null;

                          return (
                            <TableRow key={cp.id}>
                              <TableCell>
                                <div>
                                  <Link href={`/prospects/${p.id}`} className="text-sm font-medium hover:underline">{name}</Link>
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.email}</p>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-sm">{company || "-"}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={`text-xs ${statusCfg?.color || ""}`}>{statusCfg?.label || cp.status}</Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm">
                                {currentStep ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="flex items-center justify-center size-5 rounded-full bg-slate-200 text-[10px] font-medium">{currentStep.stepOrder}</span>
                                    <span className="text-muted-foreground">{ACTION_TYPE_CONFIG[currentStep.actionType]?.label || currentStep.actionType}</span>
                                  </span>
                                ) : <span className="text-muted-foreground">-</span>}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                {cp.status === "completed" ? (
                                  <span className="text-green-600">Termine</span>
                                ) : cp.next_action_at ? (
                                  new Date(cp.next_action_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                                ) : "-"}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="size-8 p-0" asChild>
                                  <Link href={`/prospects/${p.id}`}><ExternalLink className="size-3.5" /></Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log d&apos;activite</CardTitle>
              <CardDescription>Historique des actions executees pour cette sequence.</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Activity className="size-10 text-slate-300 mb-3" />
                  <p className="text-sm text-muted-foreground">Aucune activite pour le moment</p>
                  <p className="text-xs text-muted-foreground mt-1">Les actions de cette sequence apparaitront ici</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[50vh] md:max-h-[500px]">
                  <div className="space-y-1">
                    {activity.map((log) => {
                      const logCfg = LOG_TYPE_CONFIG[log.action_type] || LOG_TYPE_CONFIG.view_profile;
                      const LogIcon = logCfg.icon;
                      return (
                        <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className={`flex items-center justify-center size-8 rounded-full ${logCfg.bgColor} shrink-0`}>
                            <LogIcon className={`size-4 ${logCfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{log.message_sent || log.error_message || log.action_type}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground">{formatTimestamp(log.created_at)}</p>
                              {log.status === "failed" && <Badge variant="destructive" className="text-[9px] h-4">Erreur</Badge>}
                              {log.status === "success" && <Badge variant="secondary" className="text-[9px] h-4 bg-green-100 text-green-700">Succes</Badge>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
