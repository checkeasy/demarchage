"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Building2,
  Briefcase,
  Phone,
  Linkedin,
  Globe,
  MapPin,
  Calendar,
  Pencil,
  X,
  Clock,
  Send,
  AlertTriangle,
  AlertCircle,
  Flag,
  Hash,
  TrendingUp,
  Plus,
  Check,
  UserPlus,
  MessageSquare,
  Eye,
  FileText,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { prospectSchema, type ProspectFormData } from "@/lib/validations";
import { PROSPECT_STATUSES, CRM_STATUSES, PIPELINE_STAGES, COUNTRIES } from "@/lib/constants";
import type { Prospect } from "@/lib/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProspectTimeline, type TimelineEvent } from "./ProspectTimeline";

type ProspectStatus = keyof typeof PROSPECT_STATUSES;
type CrmStatus = keyof typeof CRM_STATUSES;
type PipelineStage = keyof typeof PIPELINE_STAGES;

interface CustomFields {
  crm_status?: string;
  pipeline_stage?: string;
  country?: string;
  organization?: string;
  nb_properties?: number;
  loss_reason?: string;
  needs_email?: boolean;
  deal_title?: string;
  source_lead_original?: string;
  standing?: string;
  type_biens?: string;
  type_conciergerie?: string;
  vision_conciergerie?: string;
  [key: string]: unknown;
}

interface CampaignEnrollment {
  id: string;
  name: string;
  campaignStatus: string;
  enrollmentStatus: string;
  hasOpened: boolean;
  hasClicked: boolean;
  hasReplied: boolean;
  enrolledAt: string;
}

interface AutomationEnrollment {
  id: string;
  name: string;
  sequenceStatus: string;
  enrollmentStatus: string;
  profileViewed: boolean;
  connectionSent: boolean;
  connectionAccepted: boolean;
  messageSentCount: number;
  hasReplied: boolean;
  enrolledAt: string;
}

interface ProspectDetailProps {
  prospect: Prospect;
  campaigns?: CampaignEnrollment[];
  automations?: AutomationEnrollment[];
  timelineEvents?: TimelineEvent[];
}

export function ProspectDetail({
  prospect,
  campaigns = [],
  automations = [],
  timelineEvents = [],
}: ProspectDetailProps) {
  const router = useRouter();
  const supabase = createClient();

  const cf = (prospect.custom_fields || {}) as CustomFields;
  const crmStatus = cf.crm_status as CrmStatus;
  const pipelineStage = cf.pipeline_stage as PipelineStage;
  const crmConfig = crmStatus ? CRM_STATUSES[crmStatus] : null;
  const pipelineConfig = pipelineStage ? PIPELINE_STAGES[pipelineStage] : null;
  const countryConfig = cf.country ? COUNTRIES[cf.country as keyof typeof COUNTRIES] : null;
  const isPlaceholderEmail = prospect.email.endsWith('@crm-import.local') || prospect.email.endsWith('@linkedin-prospect.local');

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Enrollment state
  const [availableCampaigns, setAvailableCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [availableAutomations, setAvailableAutomations] = useState<{ id: string; name: string }[]>([]);
  const [showCampaignSelect, setShowCampaignSelect] = useState(false);
  const [showAutomationSelect, setShowAutomationSelect] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const hasConflict = campaigns.length > 0 && automations.length > 0;

  // Notes state
  const [noteText, setNoteText] = useState(prospect.notes || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // CRM custom fields editing state
  const [isEditingCrm, setIsEditingCrm] = useState(false);
  const [isSavingCrm, setIsSavingCrm] = useState(false);
  const [crmFormData, setCrmFormData] = useState({
    type_biens: cf.type_biens || '',
    type_conciergerie: cf.type_conciergerie || '',
    standing: cf.standing || '',
    vision_conciergerie: cf.vision_conciergerie || '',
    nb_properties: cf.nb_properties ?? '',
    source_lead_original: cf.source_lead_original || '',
  });

  async function handleSaveNote() {
    setIsSavingNote(true);
    const { error } = await supabase
      .from('prospects')
      .update({ notes: noteText || null })
      .eq('id', prospect.id);
    setIsSavingNote(false);

    if (error) {
      toast.error("Erreur lors de la sauvegarde des notes");
      return;
    }
    toast.success("Notes sauvegardees");
    router.refresh();
  }

  function cancelCrmEdit() {
    setIsEditingCrm(false);
    setCrmFormData({
      type_biens: cf.type_biens || '',
      type_conciergerie: cf.type_conciergerie || '',
      standing: cf.standing || '',
      vision_conciergerie: cf.vision_conciergerie || '',
      nb_properties: cf.nb_properties ?? '',
      source_lead_original: cf.source_lead_original || '',
    });
  }

  async function handleSaveCrm() {
    setIsSavingCrm(true);
    const updatedFields = {
      ...prospect.custom_fields as Record<string, unknown>,
      type_biens: crmFormData.type_biens || undefined,
      type_conciergerie: crmFormData.type_conciergerie || undefined,
      standing: crmFormData.standing || undefined,
      vision_conciergerie: crmFormData.vision_conciergerie || undefined,
      nb_properties: crmFormData.nb_properties !== '' ? Number(crmFormData.nb_properties) : undefined,
      source_lead_original: crmFormData.source_lead_original || undefined,
    };
    const { error } = await supabase
      .from('prospects')
      .update({ custom_fields: updatedFields })
      .eq('id', prospect.id);
    setIsSavingCrm(false);

    if (error) {
      toast.error("Erreur lors de la sauvegarde des donnees CRM");
      return;
    }
    toast.success("Donnees CRM mises a jour");
    setIsEditingCrm(false);
    router.refresh();
  }

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_workspace_id")
        .eq("id", user.id)
        .single();
      if (!profile?.current_workspace_id || cancelled) return;

      const { data: camps } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("workspace_id", profile.current_workspace_id)
        .in("status", ["draft", "active", "paused"]);

      const { data: autos } = await supabase
        .from("automation_sequences")
        .select("id, name")
        .eq("workspace_id", profile.current_workspace_id)
        .in("status", ["draft", "active", "paused"]);

      if (!cancelled) {
        setAvailableCampaigns(camps || []);
        setAvailableAutomations(autos || []);
      }
    }
    loadOptions();
    return () => { cancelled = true; };
  }, [supabase]);

  async function enrollInCampaign(campaignId: string) {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: [prospect.id] }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Prospect ajoute a la campagne (${data.enrolled} inscrit)`);
        setShowCampaignSelect(false);
        router.refresh();
      } else {
        toast.error(data.error || "Erreur lors de l'inscription");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setEnrolling(false);
    }
  }

  async function enrollInAutomation(sequenceId: string) {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/automation/sequences/${sequenceId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: [prospect.id] }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Prospect ajoute a la sequence (${data.enrolled} inscrit)`);
        setShowAutomationSelect(false);
        router.refresh();
      } else {
        toast.error(data.error || "Erreur lors de l'inscription");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setEnrolling(false);
    }
  }
  const [formData, setFormData] = useState<ProspectFormData>({
    email: prospect.email,
    first_name: prospect.first_name ?? "",
    last_name: prospect.last_name ?? "",
    company: prospect.company ?? "",
    job_title: prospect.job_title ?? "",
    phone: prospect.phone ?? "",
    linkedin_url: prospect.linkedin_url ?? "",
    website: prospect.website ?? "",
    location: prospect.location ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function cancelEdit() {
    setIsEditing(false);
    setFormData({
      email: prospect.email,
      first_name: prospect.first_name ?? "",
      last_name: prospect.last_name ?? "",
      company: prospect.company ?? "",
      job_title: prospect.job_title ?? "",
      phone: prospect.phone ?? "",
      linkedin_url: prospect.linkedin_url ?? "",
      website: prospect.website ?? "",
      location: prospect.location ?? "",
    });
    setErrors({});
  }

  async function handleSave() {
    setErrors({});

    const result = prospectSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<string, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    const cleaned: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(result.data)) {
      cleaned[key] = value && value.trim() !== "" ? value.trim() : null;
    }

    const { error } = await supabase
      .from("prospects")
      .update(cleaned)
      .eq("id", prospect.id);

    setIsLoading(false);

    if (error) {
      toast.error("Erreur lors de la mise a jour du prospect");
      return;
    }

    toast.success("Prospect mis a jour");
    setIsEditing(false);
    router.refresh();
  }

  const statusConfig = PROSPECT_STATUSES[prospect.status as ProspectStatus];

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const infoFields = [
    {
      icon: Mail,
      label: "Email",
      field: "email" as const,
      value: prospect.email,
      type: "email",
    },
    {
      icon: Building2,
      label: "Entreprise",
      field: "company" as const,
      value: prospect.company,
      type: "text",
    },
    {
      icon: Briefcase,
      label: "Poste",
      field: "job_title" as const,
      value: prospect.job_title,
      type: "text",
    },
    {
      icon: Phone,
      label: "Telephone",
      field: "phone" as const,
      value: prospect.phone,
      type: "tel",
    },
    {
      icon: Linkedin,
      label: "LinkedIn",
      field: "linkedin_url" as const,
      value: prospect.linkedin_url,
      type: "url",
    },
    {
      icon: Globe,
      label: "Site web",
      field: "website" as const,
      value: prospect.website,
      type: "url",
    },
    {
      icon: MapPin,
      label: "Localisation",
      field: "location" as const,
      value: prospect.location,
      type: "text",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  name="first_name"
                  placeholder="Prenom"
                  value={formData.first_name ?? ""}
                  onChange={handleChange}
                  className="w-40"
                  disabled={isLoading}
                />
                <Input
                  name="last_name"
                  placeholder="Nom"
                  value={formData.last_name ?? ""}
                  onChange={handleChange}
                  className="w-40"
                  disabled={isLoading}
                />
              </div>
            ) : (
              [prospect.first_name, prospect.last_name]
                .filter(Boolean)
                .join(" ") || "Sans nom"
            )}
          </h3>
          {!isEditing && (
            <>
              <p className="text-sm text-muted-foreground mt-1">
                {isPlaceholderEmail ? (
                  <span className="text-orange-500 italic">Email manquant</span>
                ) : (
                  prospect.email
                )}
              </p>
              {cf.deal_title && (
                <p className="text-xs text-muted-foreground mt-0.5">{cf.deal_title}</p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {crmConfig && (
            <Badge variant="secondary" className="gap-1.5">
              <span className={`size-1.5 rounded-full ${crmConfig.color}`} />
              {crmConfig.label}
            </Badge>
          )}
          {pipelineConfig && (
            <Badge variant="outline" className="gap-1.5">
              <span className={`size-1.5 rounded-full ${pipelineConfig.color}`} />
              {pipelineConfig.label}
            </Badge>
          )}
          {isEditing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEdit}
                disabled={isLoading}
              >
                <X className="size-4" />
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isLoading}>
                Enregistrer
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-4" />
              Modifier
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Loss reason alert */}
      {cf.crm_status === 'lost' && cf.loss_reason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Raison de la perte</p>
            <p className="text-sm text-red-700">{cf.loss_reason}</p>
          </div>
        </div>
      )}

      {/* CRM Data Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Donnees CRM</CardTitle>
          {!isEditingCrm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingCrm(true)}
              className="h-7 text-xs"
            >
              <Pencil className="size-3 mr-1" />
              Modifier
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelCrmEdit}
                disabled={isSavingCrm}
                className="h-7 text-xs"
              >
                <X className="size-3 mr-1" />
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSaveCrm}
                disabled={isSavingCrm}
                className="h-7 text-xs"
              >
                <Save className="size-3 mr-1" />
                Sauvegarder
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {cf.country && (
            <div className="flex items-center gap-2">
              <Flag className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Pays</p>
                <p className="text-sm">
                  {countryConfig ? `${countryConfig.flag} ${countryConfig.label}` : cf.country}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Hash className="size-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Nombre de biens</p>
              {isEditingCrm ? (
                <Input
                  type="number"
                  value={crmFormData.nb_properties}
                  onChange={(e) => setCrmFormData(prev => ({ ...prev, nb_properties: e.target.value === '' ? '' : Number(e.target.value) }))}
                  disabled={isSavingCrm}
                  className="h-7 text-sm mt-1"
                  placeholder="Ex: 3"
                />
              ) : (
                <p className="text-sm">{cf.nb_properties || <span className="text-muted-foreground">-</span>}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Type de biens</p>
              {isEditingCrm ? (
                <Input
                  value={crmFormData.type_biens}
                  onChange={(e) => setCrmFormData(prev => ({ ...prev, type_biens: e.target.value }))}
                  disabled={isSavingCrm}
                  className="h-7 text-sm mt-1"
                  placeholder="Ex: Appartement, Villa..."
                />
              ) : (
                <p className="text-sm">{cf.type_biens || <span className="text-muted-foreground">-</span>}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Type de conciergerie</p>
              {isEditingCrm ? (
                <Input
                  value={crmFormData.type_conciergerie}
                  onChange={(e) => setCrmFormData(prev => ({ ...prev, type_conciergerie: e.target.value }))}
                  disabled={isSavingCrm}
                  className="h-7 text-sm mt-1"
                  placeholder="Ex: Airbnb, Booking..."
                />
              ) : (
                <p className="text-sm">{cf.type_conciergerie || <span className="text-muted-foreground">-</span>}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Standing</p>
              {isEditingCrm ? (
                <Input
                  value={crmFormData.standing}
                  onChange={(e) => setCrmFormData(prev => ({ ...prev, standing: e.target.value }))}
                  disabled={isSavingCrm}
                  className="h-7 text-sm mt-1"
                  placeholder="Ex: Standard, Premium..."
                />
              ) : (
                <p className="text-sm">{cf.standing || <span className="text-muted-foreground">-</span>}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Vision</p>
              {isEditingCrm ? (
                <Input
                  value={crmFormData.vision_conciergerie}
                  onChange={(e) => setCrmFormData(prev => ({ ...prev, vision_conciergerie: e.target.value }))}
                  disabled={isSavingCrm}
                  className="h-7 text-sm mt-1"
                  placeholder="Ex: Developpement, Maintien..."
                />
              ) : (
                <p className="text-sm">{cf.vision_conciergerie || <span className="text-muted-foreground">-</span>}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Send className="size-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Source du lead</p>
              {isEditingCrm ? (
                <Input
                  value={crmFormData.source_lead_original}
                  onChange={(e) => setCrmFormData(prev => ({ ...prev, source_lead_original: e.target.value }))}
                  disabled={isSavingCrm}
                  className="h-7 text-sm mt-1"
                  placeholder="Ex: Google Maps, LinkedIn..."
                />
              ) : (
                <p className="text-sm">{cf.source_lead_original || <span className="text-muted-foreground">-</span>}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Comments Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" />
            Notes & Commentaires
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Ajoutez des notes sur ce prospect..."
            className="min-h-[120px] text-sm resize-y"
            disabled={isSavingNote}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {noteText.length} caractere{noteText.length !== 1 ? 's' : ''}
            </p>
            <Button
              size="sm"
              onClick={handleSaveNote}
              disabled={isSavingNote || noteText === (prospect.notes || '')}
              className="h-7 text-xs"
            >
              <Save className="size-3 mr-1" />
              {isSavingNote ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {infoFields.map(({ icon: Icon, label, field, value, type }) => (
            <div key={field} className="flex items-center gap-3">
              <Icon className="size-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                {isEditing ? (
                  <div className="mt-1">
                    <Input
                      name={field}
                      type={type}
                      value={(formData[field] as string) ?? ""}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="h-8 text-sm"
                    />
                    {errors[field] && (
                      <p className="text-xs text-destructive mt-1">
                        {errors[field]}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm truncate">
                    {value ? (
                      type === "url" ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {value}
                        </a>
                      ) : type === "email" ? (
                        <a
                          href={`mailto:${value}`}
                          className="text-primary hover:underline"
                        >
                          {value}
                        </a>
                      ) : (
                        value
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadonnees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Date de creation</p>
              <p className="text-sm">{formatDate(prospect.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Derniere modification</p>
              <p className="text-sm">{formatDate(prospect.updated_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Send className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Dernier contact</p>
              <p className="text-sm">
                {formatDate(prospect.last_contacted_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-4 text-center">
              Src
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="text-sm capitalize">{prospect.source.replace("_", " ")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conflict warning */}
      {hasConflict && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              Ce prospect est actif dans {campaigns.length} campagne(s) email ET{" "}
              {automations.length} sequence(s) LinkedIn simultanement.
              Verifiez qu&apos;il ne recoit pas trop de messages.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Campaign enrollments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Campagnes Email</CardTitle>
          {!showCampaignSelect ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCampaignSelect(true)}
              className="h-7 text-xs"
            >
              <Plus className="size-3 mr-1" />
              Ajouter
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Select onValueChange={(val) => enrollInCampaign(val)} disabled={enrolling}>
                <SelectTrigger className="h-7 w-48 text-xs">
                  <SelectValue placeholder="Choisir une campagne" />
                </SelectTrigger>
                <SelectContent>
                  {availableCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowCampaignSelect(false)}
              >
                <X className="size-3" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune campagne email active.
            </p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Mail className="size-4 text-blue-600" />
                    <div>
                      <Link href={`/campaigns/${c.id}`} className="text-sm font-medium hover:underline">
                        {c.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] h-4">
                          {c.enrollmentStatus}
                        </Badge>
                        {c.hasOpened && (
                          <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                            <Eye className="size-2.5" /> Ouvert
                          </span>
                        )}
                        {c.hasClicked && (
                          <span className="text-[10px] text-purple-600 flex items-center gap-0.5">
                            <Check className="size-2.5" /> Clique
                          </span>
                        )}
                        {c.hasReplied && (
                          <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                            <MessageSquare className="size-2.5" /> Repondu
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.enrolledAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Automation enrollments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Sequences LinkedIn</CardTitle>
          {!showAutomationSelect ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAutomationSelect(true)}
              className="h-7 text-xs"
            >
              <Plus className="size-3 mr-1" />
              Ajouter
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Select onValueChange={(val) => enrollInAutomation(val)} disabled={enrolling}>
                <SelectTrigger className="h-7 w-48 text-xs">
                  <SelectValue placeholder="Choisir une sequence" />
                </SelectTrigger>
                <SelectContent>
                  {availableAutomations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowAutomationSelect(false)}
              >
                <X className="size-3" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {automations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune sequence LinkedIn active.
            </p>
          ) : (
            <div className="space-y-3">
              {automations.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Linkedin className="size-4 text-blue-700" />
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] h-4">
                          {a.enrollmentStatus}
                        </Badge>
                        {a.connectionSent && (
                          <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                            <UserPlus className="size-2.5" /> Connexion envoyee
                          </span>
                        )}
                        {a.connectionAccepted && (
                          <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                            <Check className="size-2.5" /> Acceptee
                          </span>
                        )}
                        {a.messageSentCount > 0 && (
                          <span className="text-[10px] text-purple-600 flex items-center gap-0.5">
                            <MessageSquare className="size-2.5" /> {a.messageSentCount} msg
                          </span>
                        )}
                        {a.hasReplied && (
                          <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                            <MessageSquare className="size-2.5" /> Repondu
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(a.enrolledAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unified activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activite</CardTitle>
        </CardHeader>
        <CardContent>
          <ProspectTimeline events={timelineEvents} />
        </CardContent>
      </Card>
    </div>
  );
}
