"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Settings,
  Users,
  Layers,
  Calendar,
  CheckCircle,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SequenceEditor, type StepData } from "@/components/campaigns/SequenceEditor";
import {
  ScheduleConfig,
  getDefaultSchedule,
  type ScheduleData,
} from "@/components/campaigns/ScheduleConfig";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { STEP_TYPES } from "@/lib/constants";
import type { EmailAccount, Prospect } from "@/lib/types/database";

const WIZARD_STEPS = [
  { label: "Configuration", icon: Settings },
  { label: "Audience", icon: Users },
  { label: "Sequence", icon: Layers },
  { label: "Planification", icon: Calendar },
  { label: "Resume", icon: CheckCircle },
];

interface CampaignFormData {
  name: string;
  description: string;
  email_account_id: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Configuration
  const [formData, setFormData] = useState<CampaignFormData>({
    name: "",
    description: "",
    email_account_id: "",
  });
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);

  // Step 2: Audience
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(
    new Set()
  );
  const [prospectSearch, setProspectSearch] = useState("");

  // Step 3: Sequence
  const [steps, setSteps] = useState<StepData[]>([]);

  // Step 4: Schedule
  const [schedule, setSchedule] = useState<ScheduleData>(getDefaultSchedule());

  // Test email
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  // Workspace ID
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Load workspace data
  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_workspace_id")
        .eq("id", user.id)
        .single();

      if (!profile?.current_workspace_id) return;
      setWorkspaceId(profile.current_workspace_id);

      // Load email accounts
      const { data: accounts } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("workspace_id", profile.current_workspace_id)
        .eq("is_active", true);

      setEmailAccounts((accounts ?? []) as EmailAccount[]);

      // Load prospects
      const { data: prospectsData } = await supabase
        .from("prospects")
        .select("*")
        .eq("workspace_id", profile.current_workspace_id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      setProspects((prospectsData ?? []) as Prospect[]);
    }

    loadData();
  }, [supabase]);

  const filteredProspects = prospects.filter((p) => {
    if (!prospectSearch) return true;
    const search = prospectSearch.toLowerCase();
    return (
      p.email.toLowerCase().includes(search) ||
      (p.first_name?.toLowerCase().includes(search) ?? false) ||
      (p.last_name?.toLowerCase().includes(search) ?? false) ||
      (p.company?.toLowerCase().includes(search) ?? false)
    );
  });

  const toggleProspect = useCallback((id: string) => {
    setSelectedProspectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllProspects = useCallback(() => {
    setSelectedProspectIds(new Set(filteredProspects.map((p) => p.id)));
  }, [filteredProspects]);

  const deselectAllProspects = useCallback(() => {
    setSelectedProspectIds(new Set());
  }, []);

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 0:
        return formData.name.trim().length > 0;
      case 1:
        return selectedProspectIds.size > 0;
      case 2:
        return steps.length > 0;
      case 3:
        return schedule.sending_days.length > 0;
      default:
        return true;
    }
  };

  function replaceVariables(text: string, prospect?: Prospect | null): string {
    if (!prospect || !text) return text;
    return text
      .replace(/\{firstName\}/g, prospect.first_name || 'Jean')
      .replace(/\{lastName\}/g, prospect.last_name || 'Dupont')
      .replace(/\{company\}/g, prospect.company || 'Entreprise')
      .replace(/\{jobTitle\}/g, prospect.job_title || 'Gerant')
      .replace(/\{email\}/g, prospect.email || 'contact@example.com');
  }

  async function handleSendTestEmail() {
    if (!testEmail) return;

    const firstEmailStep = steps.find(s => s.step_type === 'email');
    if (!firstEmailStep) {
      toast.error("Aucun email dans la sequence");
      return;
    }

    setSendingTest(true);
    try {
      const sampleProspect = prospects.find(p => selectedProspectIds.has(p.id));
      const subject = replaceVariables(firstEmailStep.subject || 'Test ColdReach', sampleProspect);
      const body = replaceVariables(firstEmailStep.body_text || firstEmailStep.body_html || '', sampleProspect);

      const response = await fetch('/api/email/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          subject: `[TEST] ${subject}`,
          body_text: body,
          body_html: `<p>${body.replace(/\n/g, '</p><p>')}</p>`,
          email_account_id: formData.email_account_id || null,
        }),
      });

      if (response.ok) {
        toast.success(`Email test envoye a ${testEmail}`);
      } else {
        const data = await response.json();
        toast.error(data.error || "Erreur lors de l'envoi du test");
      }
    } catch {
      toast.error("Erreur lors de l'envoi du test");
    } finally {
      setSendingTest(false);
    }
  }

  const handleSave = async () => {
    if (!workspaceId) {
      toast.error("Aucun workspace selectionne");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Insert campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          workspace_id: workspaceId,
          name: formData.name,
          description: formData.description || null,
          status: "draft",
          email_account_id: formData.email_account_id || null,
          timezone: schedule.timezone,
          sending_window_start: schedule.sending_window_start,
          sending_window_end: schedule.sending_window_end,
          sending_days: schedule.sending_days,
          daily_limit: schedule.daily_limit,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (campaignError) throw campaignError;
      if (!campaign) throw new Error("Erreur lors de la creation de la campagne");

      // Insert sequence steps
      if (steps.length > 0) {
        const stepsToInsert = steps.map((s) => ({
          campaign_id: campaign.id,
          step_order: s.step_order,
          step_type: s.step_type,
          delay_days: s.delay_days,
          delay_hours: s.delay_hours,
          subject: s.subject,
          body_html: s.body_html,
          body_text: s.body_text,
          linkedin_message: s.linkedin_message,
          whatsapp_message: s.whatsapp_message,
          ab_enabled: s.ab_enabled,
        }));

        const { error: stepsError } = await supabase
          .from("sequence_steps")
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      // Enroll selected prospects into the campaign
      if (selectedProspectIds.size > 0) {
        // Get the first step ID for assigning prospects
        const { data: firstStep } = await supabase
          .from("sequence_steps")
          .select("id")
          .eq("campaign_id", campaign.id)
          .order("step_order", { ascending: true })
          .limit(1)
          .single();

        const prospectRows = [...selectedProspectIds].map((prospectId) => ({
          campaign_id: campaign.id,
          prospect_id: prospectId,
          status: "active" as const,
          current_step_id: firstStep?.id || null,
        }));

        const { error: enrollError } = await supabase
          .from("campaign_prospects")
          .insert(prospectRows);

        if (enrollError) throw enrollError;
      }

      // Update campaign prospect count
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({ total_prospects: selectedProspectIds.size })
        .eq("id", campaign.id);

      if (updateError) throw updateError;

      toast.success("Campagne creee avec succes !");
      router.push(`/campaigns/${campaign.id}`);
    } catch (error: unknown) {
      console.error("Error creating campaign:", error);
      toast.error("Erreur lors de la creation de la campagne");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/campaigns")}
        >
          <ChevronLeft className="size-4" />
          Retour
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Nouvelle campagne
          </h2>
          <p className="text-sm text-muted-foreground">
            Etape {currentStep + 1} sur {WIZARD_STEPS.length}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {WIZARD_STEPS.map((ws, idx) => {
          const Icon = ws.icon;
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          return (
            <React.Fragment key={ws.label}>
              <button
                onClick={() => idx <= currentStep && setCurrentStep(idx)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : isCompleted
                    ? "text-green-700 hover:bg-green-50 cursor-pointer"
                    : "text-muted-foreground"
                }`}
                disabled={idx > currentStep}
              >
                <div
                  className={`flex items-center justify-center size-6 rounded-full text-xs ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isCompleted
                      ? "bg-green-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="size-3.5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className="hidden md:inline">{ws.label}</span>
              </button>
              {idx < WIZARD_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 ${
                    idx < currentStep ? "bg-green-400" : "bg-slate-200"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* STEP 1: Configuration */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Nom et configuration
                </h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign-name">
                  Nom de la campagne <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="campaign-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex: Outreach Q1 2026 - SaaS Decision Makers"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign-desc">Description</Label>
                <Textarea
                  id="campaign-desc"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Decrivez l'objectif de cette campagne..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Compte email</Label>
                <Select
                  value={formData.email_account_id}
                  onValueChange={(val) =>
                    setFormData({ ...formData, email_account_id: val })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selectionner un compte email" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailAccounts.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Aucun compte email configure
                      </SelectItem>
                    ) : (
                      emailAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.display_name
                            ? `${account.display_name} (${account.email_address})`
                            : account.email_address}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* STEP 2: Audience */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    Selection des prospects
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedProspectIds.size} prospect
                    {selectedProspectIds.size > 1 ? "s" : ""} selectionne
                    {selectedProspectIds.size > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllProspects}
                  >
                    Tout selectionner
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllProspects}
                  >
                    Tout deselectionner
                  </Button>
                </div>
              </div>

              <Input
                placeholder="Rechercher par nom, email, entreprise..."
                value={prospectSearch}
                onChange={(e) => setProspectSearch(e.target.value)}
              />

              <ScrollArea className="h-[400px] rounded-lg border">
                <div className="p-2 space-y-1">
                  {filteredProspects.length === 0 ? (
                    <div className="text-center py-8 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Aucun prospect trouve.
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/prospects/import">
                          Importer des prospects
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    filteredProspects.map((prospect) => (
                      <label
                        key={prospect.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedProspectIds.has(prospect.id)}
                          onCheckedChange={() => toggleProspect(prospect.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {prospect.first_name} {prospect.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {prospect.email}
                            {prospect.company && ` - ${prospect.company}`}
                          </p>
                        </div>
                        {prospect.job_title && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {prospect.job_title}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* STEP 3: Sequence */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">
                  Editeur de sequence
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Construisez votre sequence d&apos;emails et d&apos;actions.
                  Glissez-deposez pour reordonner les etapes.
                </p>
              </div>

              <Separator />

              <SequenceEditor steps={steps} onChange={setSteps} />
            </div>
          )}

          {/* STEP 4: Planification */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Planification</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configurez les horaires et la frequence d&apos;envoi.
                </p>
              </div>

              <Separator />

              <ScheduleConfig value={schedule} onChange={setSchedule} />
            </div>
          )}

          {/* STEP 5: Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">
                  Resume de la campagne
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Verifiez les informations avant de sauvegarder.
                </p>
              </div>

              <Separator />

              {/* Campaign info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Configuration
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nom :</span>{" "}
                    <span className="font-medium">{formData.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Statut :</span>{" "}
                    <CampaignStatusBadge status="draft" />
                  </div>
                  {formData.description && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">
                        Description :
                      </span>{" "}
                      <span>{formData.description}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">
                      Compte email :
                    </span>{" "}
                    <span className="font-medium">
                      {emailAccounts.find(
                        (a) => a.id === formData.email_account_id
                      )?.email_address ?? "Non selectionne"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Audience */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Audience
                </h4>
                <p className="text-sm">
                  <span className="font-medium text-lg">
                    {selectedProspectIds.size}
                  </span>{" "}
                  prospect{selectedProspectIds.size > 1 ? "s" : ""}{" "}
                  selectionne{selectedProspectIds.size > 1 ? "s" : ""}
                </p>
              </div>

              <Separator />

              {/* Sequence summary */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Sequence
                </h4>
                <div className="space-y-2">
                  {steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="flex items-center justify-center size-5 rounded-full bg-slate-200 text-xs font-medium">
                        {idx + 1}
                      </span>
                      <span className="font-medium">
                        {STEP_TYPES[step.step_type]?.label}
                      </span>
                      {step.step_type === "email" && step.subject && (
                        <span className="text-muted-foreground truncate">
                          - {step.subject}
                        </span>
                      )}
                      {step.step_type === "delay" && (
                        <span className="text-muted-foreground">
                          - {step.delay_days}j {step.delay_hours}h
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Email Preview */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Apercu email
                </h4>

                {steps.filter(s => s.step_type === 'email').length > 0 ? (
                  <div className="space-y-4">
                    {steps.filter(s => s.step_type === 'email').map((step, idx) => {
                      const sampleProspect = prospects.find(p => selectedProspectIds.has(p.id));
                      const previewSubject = replaceVariables(step.subject || '', sampleProspect);
                      const previewBody = replaceVariables(step.body_text || step.body_html || '', sampleProspect);

                      return (
                        <Card key={step.id} className="border-dashed">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">Email {idx + 1}</CardTitle>
                              {step.delay_days > 0 && (
                                <Badge variant="outline">J+{step.delay_days}</Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Objet :</p>
                              <p className="text-sm font-medium">{previewSubject || 'Aucun objet'}</p>
                            </div>
                            <Separator />
                            <div>
                              <p className="text-xs text-muted-foreground">Corps :</p>
                              <p className="text-sm whitespace-pre-wrap">{previewBody || 'Aucun contenu'}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun email dans la sequence</p>
                )}
              </div>

              <Separator />

              {/* Test Email */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Email test
                </h4>
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="test-email">Envoyer un email test a</Label>
                    <Input
                      id="test-email"
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="votre-email@exemple.com"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSendTestEmail}
                    disabled={sendingTest || !testEmail || steps.filter(s => s.step_type === 'email').length === 0}
                  >
                    {sendingTest ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        Envoyer le test
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le premier email de la sequence sera envoye avec des donnees d&apos;exemple.
                </p>
              </div>

              <Separator />

              {/* Schedule summary */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Planification
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      Fuseau horaire :
                    </span>{" "}
                    <span className="font-medium">{schedule.timezone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Horaires :</span>{" "}
                    <span className="font-medium">
                      {schedule.sending_window_start} -{" "}
                      {schedule.sending_window_end}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Limite journaliere :
                    </span>{" "}
                    <span className="font-medium">
                      {schedule.daily_limit} emails/jour
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="size-4" />
          Precedent
        </Button>

        {currentStep < WIZARD_STEPS.length - 1 ? (
          <Button
            onClick={() =>
              setCurrentStep(
                Math.min(WIZARD_STEPS.length - 1, currentStep + 1)
              )
            }
            disabled={!canGoNext()}
          >
            Suivant
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Sauvegarde en cours..." : "Sauvegarder en brouillon"}
          </Button>
        )}
      </div>
    </div>
  );
}
