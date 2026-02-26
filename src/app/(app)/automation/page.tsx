"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Search,
  Users,
  UserCheck,
  MessageSquare,
  CalendarCheck,
  Send,
  ArrowRight,
  Clock,
  Shield,
  Activity,
  Eye,
  UserPlus,
  Mail,
  Zap,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  AutomationCard,
  type AutomationSequenceData,
} from "@/components/automation/AutomationCard";
import {
  AutomationSequenceBuilder,
  DEFAULT_STEPS,
  type SequenceStep,
} from "@/components/automation/AutomationSequenceBuilder";

interface ActivityLog {
  id: string;
  type: "view" | "connect" | "message" | "email" | "reply" | "meeting";
  message: string;
  status: string;
  timestamp: string;
}

const LOG_TYPE_CONFIG = {
  view: { color: "text-slate-500", bgColor: "bg-slate-100", icon: Eye },
  connect: { color: "text-blue-600", bgColor: "bg-blue-50", icon: UserPlus },
  message: {
    color: "text-green-600",
    bgColor: "bg-green-50",
    icon: MessageSquare,
  },
  email: { color: "text-purple-600", bgColor: "bg-purple-50", icon: Mail },
  reply: { color: "text-amber-600", bgColor: "bg-amber-50", icon: Send },
  meeting: {
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    icon: CalendarCheck,
  },
};

export default function AutomationPage() {
  const [sequences, setSequences] = useState<AutomationSequenceData[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [isLoadingSequences, setIsLoadingSequences] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [wizardStep, setWizardStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_STEPS);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [sequenceName, setSequenceName] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Configuration state
  const [config, setConfig] = useState({
    maxConnectionsDay: 25,
    maxMessagesDay: 50,
    sendingHoursStart: "08:00",
    sendingHoursEnd: "18:00",
    sendingDays: [true, true, true, true, true, false, false],
    delayMin: 2,
    delayMax: 8,
    prospectSource: "existing" as "existing" | "search",
  });

  // Load sequences from API
  const loadSequences = useCallback(async () => {
    try {
      const res = await fetch("/api/automation/sequences");
      if (res.ok) {
        const data = await res.json();
        setSequences(data.sequences || []);
      }
    } catch {
      // Silently fail on first load
    } finally {
      setIsLoadingSequences(false);
    }
  }, []);

  // Load activity log from API
  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/automation/activity");
      if (res.ok) {
        const data = await res.json();
        setActivityLog(data.activity || []);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    loadSequences();
    loadActivity();
  }, [loadSequences, loadActivity]);

  // Computed stats from sequences
  const globalStats = [
    {
      label: "Prospects total",
      value: String(sequences.reduce((sum, s) => sum + s.totalProspects, 0)),
      icon: Search,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Connexions envoyees",
      value: String(sequences.reduce((sum, s) => sum + s.stats.connected, 0)),
      icon: UserPlus,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Taux d'acceptation",
      value: (() => {
        const total = sequences.reduce((sum, s) => sum + s.totalProspects, 0);
        const connected = sequences.reduce((sum, s) => sum + s.stats.connected, 0);
        return total > 0 ? `${Math.round((connected / total) * 100)}%` : "0%";
      })(),
      icon: UserCheck,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Reponses",
      value: String(sequences.reduce((sum, s) => sum + s.stats.replied, 0)),
      icon: MessageSquare,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Taux de reponse",
      value: (() => {
        const total = sequences.reduce((sum, s) => sum + s.totalProspects, 0);
        const replied = sequences.reduce((sum, s) => sum + s.stats.replied, 0);
        return total > 0 ? `${Math.round((replied / total) * 100)}%` : "0%";
      })(),
      icon: Send,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      label: "Meetings bookes",
      value: String(sequences.reduce((sum, s) => sum + s.stats.meetings, 0)),
      icon: CalendarCheck,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
    },
  ];

  async function handlePause(id: string) {
    try {
      const res = await fetch(`/api/automation/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
      if (res.ok) {
        setSequences((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: "paused" as const } : s))
        );
        toast.success("Sequence mise en pause");
      } else {
        toast.error("Erreur lors de la mise en pause");
      }
    } catch {
      toast.error("Erreur reseau");
    }
  }

  async function handleResume(id: string) {
    try {
      const res = await fetch(`/api/automation/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (res.ok) {
        setSequences((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: "active" as const } : s))
        );
        toast.success("Sequence reprise");
      } else {
        toast.error("Erreur lors de la reprise");
      }
    } catch {
      toast.error("Erreur reseau");
    }
  }

  async function handleStop(id: string) {
    try {
      const res = await fetch(`/api/automation/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        setSequences((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, status: "completed" as const } : s
          )
        );
        toast.success("Sequence arretee");
      } else {
        toast.error("Erreur lors de l'arret");
      }
    } catch {
      toast.error("Erreur reseau");
    }
  }

  async function handleGenerateAI(stepId: string) {
    setIsGenerating(stepId);

    try {
      const step = steps.find((s) => s.id === stepId);
      if (!step) return;

      const res = await fetch("/api/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: {
            firstName: "{prenom}",
            lastName: "{nom}",
            company: "{entreprise}",
            jobTitle: "{poste}",
          },
          context: step.type === "connect"
            ? "message court de demande de connexion LinkedIn (max 300 caracteres)"
            : step.type === "email"
            ? "email de prospection froid"
            : "message de relance LinkedIn",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSteps((prev) =>
          prev.map((s) =>
            s.id === stepId ? { ...s, message: data.body || data.subject || "" } : s
          )
        );
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

  async function handleLaunchSequence() {
    if (!sequenceName.trim()) {
      toast.error("Veuillez donner un nom a votre sequence");
      return;
    }

    setIsLaunching(true);

    try {
      const res = await fetch("/api/automation/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sequenceName,
          steps,
          config,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Sequence creee avec succes !");
        setShowWizard(false);
        setWizardStep(0);
        setSequenceName("");
        setSteps(DEFAULT_STEPS);
        // Reload sequences
        loadSequences();
      } else {
        toast.error(data.error || "Erreur lors de la creation");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsLaunching(false);
    }
  }

  async function handleExecuteQueue() {
    setIsExecuting(true);
    try {
      const res = await fetch("/api/automation/execute", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        if (data.processed === 0) {
          toast.info("Aucune action en attente dans la queue");
        } else {
          toast.success(
            `${data.success} action(s) executee(s) sur ${data.processed}`
          );
        }
        // Refresh data
        loadSequences();
        loadActivity();
      } else {
        toast.error(data.error || "Erreur d'execution");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setIsExecuting(false);
    }
  }

  const WIZARD_STEPS = [
    "Selectionner les prospects",
    "Configurer la sequence",
    "Parametres",
    "Revoir et lancer",
  ];

  const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Automation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerez vos sequences de prospection automatisees
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExecuteQueue}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Executer la queue
          </Button>
          <Button onClick={() => setShowWizard(true)}>
            <Zap className="size-4" />
            Nouvelle sequence
          </Button>
        </div>
      </div>

      {/* New sequence wizard */}
      {showWizard && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5" />
              Nouvelle sequence automatique
            </CardTitle>
            <CardDescription>
              Configurez votre sequence de prospection automatisee en quelques
              etapes
            </CardDescription>
            {/* Stepper */}
            <div className="flex items-center gap-2 mt-4">
              {WIZARD_STEPS.map((stepLabel, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <button
                    onClick={() => setWizardStep(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      idx === wizardStep
                        ? "bg-blue-600 text-white"
                        : idx < wizardStep
                        ? "bg-blue-200 text-blue-800"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    <span className="size-5 flex items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="hidden sm:inline">{stepLabel}</span>
                  </button>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <ChevronRight className="size-4 text-slate-400" />
                  )}
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {/* Step 1: Select prospects */}
            {wizardStep === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom de la sequence</Label>
                  <Input
                    placeholder="Ex: Prospection BTP - Directeurs"
                    value={sequenceName}
                    onChange={(e) => setSequenceName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Source des prospects</Label>
                  <Select
                    value={config.prospectSource}
                    onValueChange={(value: "existing" | "search") =>
                      setConfig((prev) => ({ ...prev, prospectSource: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existing">
                        Prospects existants
                      </SelectItem>
                      <SelectItem value="search">
                        Depuis une recherche
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.prospectSource === "existing" ? (
                  <Card>
                    <CardContent className="py-8">
                      <div className="flex flex-col items-center text-center">
                        <Users className="size-10 text-slate-300 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Les prospects de votre base seront utilises. Allez
                          dans la page Prospects pour les ajouter a la
                          sequence une fois creee.
                        </p>
                        <Button variant="outline" className="mt-3" asChild>
                          <Link href="/prospects">
                            Voir les prospects
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-8">
                      <div className="flex flex-col items-center text-center">
                        <Search className="size-10 text-slate-300 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Effectuez une recherche LinkedIn pour trouver et
                          ajouter des prospects a cette sequence.
                        </p>
                        <Button variant="outline" className="mt-3" asChild>
                          <Link href="/scraper">
                            Ouvrir le scraper
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 2: Configure sequence steps */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configurez les etapes de votre sequence automatisee. L&apos;IA
                  peut generer des messages personnalises pour chaque etape.
                </p>
                <AutomationSequenceBuilder
                  steps={steps}
                  onStepsChange={setSteps}
                  onGenerateAI={handleGenerateAI}
                  isGenerating={isGenerating}
                />
              </div>
            )}

            {/* Step 3: Configuration */}
            {wizardStep === 2 && (
              <div className="space-y-6">
                {/* Daily limits */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Shield className="size-4" />
                    Limites quotidiennes
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Max connexions / jour</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={config.maxConnectionsDay}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            maxConnectionsDay: parseInt(e.target.value) || 25,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Max messages / jour</Label>
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        value={config.maxMessagesDay}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            maxMessagesDay: parseInt(e.target.value) || 50,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sending hours */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Clock className="size-4" />
                    Heures d&apos;envoi
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Debut</Label>
                      <Input
                        type="time"
                        value={config.sendingHoursStart}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            sendingHoursStart: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fin</Label>
                      <Input
                        type="time"
                        value={config.sendingHoursEnd}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            sendingHoursEnd: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sending days */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Jours d&apos;envoi</h4>
                  <div className="flex items-center gap-2">
                    {dayLabels.map((day, idx) => (
                      <button
                        key={idx}
                        onClick={() =>
                          setConfig((prev) => {
                            const days = [...prev.sendingDays];
                            days[idx] = !days[idx];
                            return { ...prev, sendingDays: days };
                          })
                        }
                        className={`size-10 rounded-full text-xs font-medium transition-colors ${
                          config.sendingDays[idx]
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Delay between actions */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Activity className="size-4" />
                    Delai entre actions (secondes)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Minimum</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={config.delayMin}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            delayMin: parseInt(e.target.value) || 2,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Maximum</Label>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={config.delayMax}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            delayMax: parseInt(e.target.value) || 8,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Un delai aleatoire entre {config.delayMin}s et{" "}
                    {config.delayMax}s sera applique entre chaque action pour
                    simuler un comportement humain.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Review and launch */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h4 className="font-medium">Recapitulatif de la sequence</h4>

                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-muted-foreground">Nom</p>
                      <p className="text-sm font-medium mt-0.5">
                        {sequenceName || "Non defini"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-muted-foreground">
                        Nombre d&apos;etapes
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {steps.length} etapes
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-muted-foreground">
                        Limites quotidiennes
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {config.maxConnectionsDay} conn. /{" "}
                        {config.maxMessagesDay} msg.
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-muted-foreground">
                        Heures d&apos;envoi
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {config.sendingHoursStart} - {config.sendingHoursEnd}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Sequence steps summary */}
                <h4 className="font-medium text-sm">Etapes de la sequence</h4>
                <div className="space-y-2">
                  {steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 text-sm p-2 bg-slate-50 rounded-lg"
                    >
                      <span className="size-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-medium flex-1">{step.label}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        Jour {step.delayDays}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <Shield className="size-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800">
                    La sequence respectera les limites configurees et les heures
                    d&apos;envoi definies. Un delai aleatoire de{" "}
                    {config.delayMin}-{config.delayMax}s sera applique entre
                    chaque action.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="flex gap-2">
                {wizardStep > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setWizardStep((s) => s - 1)}
                  >
                    <ChevronLeft className="size-4" />
                    Precedent
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowWizard(false);
                    setWizardStep(0);
                  }}
                >
                  Annuler
                </Button>
              </div>

              {wizardStep < WIZARD_STEPS.length - 1 ? (
                <Button onClick={() => setWizardStep((s) => s + 1)}>
                  Suivant
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleLaunchSequence}
                  disabled={isLaunching}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLaunching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Zap className="size-4" />
                  )}
                  Lancer la sequence
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global stats */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Statistiques globales</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {globalStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="pt-0">
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`flex items-center justify-center size-10 rounded-lg ${stat.bgColor} mb-2`}
                    >
                      <Icon className={`size-5 ${stat.color}`} />
                    </div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stat.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Two-column layout: Sequences + Activity log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active sequences */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Sequences</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSequences}
              className="text-xs h-7"
            >
              <RefreshCw className="size-3" />
              Rafraichir
            </Button>
          </div>
          {isLoadingSequences ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center">
                  <Loader2 className="size-8 animate-spin text-slate-300 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Chargement des sequences...
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : sequences.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <Bot className="size-12 text-slate-300 mb-4" />
                  <h4 className="text-lg font-semibold">
                    Aucune sequence
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Creez votre premiere sequence automatisee pour commencer a
                    prospecter.
                  </p>
                  <Button
                    onClick={() => setShowWizard(true)}
                    className="mt-4"
                  >
                    <Zap className="size-4" />
                    Creer une sequence
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sequences.map((seq) => (
                <AutomationCard
                  key={seq.id}
                  sequence={seq}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleStop}
                />
              ))}
            </div>
          )}
        </div>

        {/* Activity log */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="size-5" />
              Log d&apos;activite
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadActivity}
              className="text-xs h-7"
            >
              <RefreshCw className="size-3" />
            </Button>
          </div>
          <Card>
            <CardContent className="pt-4 pb-2">
              {isLoadingActivity ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="size-8 animate-spin text-slate-300 mb-3" />
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                </div>
              ) : activityLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Activity className="size-10 text-slate-300 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Aucune activite pour le moment
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Les actions de vos sequences apparaitront ici
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1">
                    {activityLog.map((log) => {
                      const logConfig =
                        LOG_TYPE_CONFIG[log.type as keyof typeof LOG_TYPE_CONFIG] ||
                        LOG_TYPE_CONFIG.view;
                      const Icon = logConfig.icon;

                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div
                            className={`flex items-center justify-center size-8 rounded-full ${logConfig.bgColor} shrink-0`}
                          >
                            <Icon className={`size-4 ${logConfig.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{log.message}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground">
                                {log.timestamp}
                              </p>
                              {log.status === "failed" && (
                                <Badge
                                  variant="destructive"
                                  className="text-[9px] h-4"
                                >
                                  Erreur
                                </Badge>
                              )}
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
        </div>
      </div>
    </div>
  );
}
