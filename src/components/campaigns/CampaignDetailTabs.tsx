"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SequenceEditor, type StepData } from "./SequenceEditor";
import { STEP_TYPES } from "@/lib/constants";
import {
  Eye,
  Layers,
  Users,
  BarChart3,
  Mail,
  Clock,
  UserPlus,
  MessageSquare,
} from "lucide-react";
import type { Campaign, SequenceStep } from "@/lib/types/database";

interface CampaignDetailTabsProps {
  campaign: Campaign;
  steps: SequenceStep[];
}

export function CampaignDetailTabs({
  campaign,
  steps,
}: CampaignDetailTabsProps) {
  // Convert DB sequence steps to StepData for the SequenceEditor
  const editorSteps: StepData[] = (steps as (typeof steps[number] & Record<string, unknown>)[]).map((s) => ({
    id: s.id,
    step_order: s.step_order,
    step_type: s.step_type as StepData["step_type"],
    delay_days: s.delay_days,
    delay_hours: s.delay_hours,
    subject: s.subject,
    body_html: s.body_html,
    body_text: s.body_text,
    linkedin_message: s.linkedin_message,
    whatsapp_message: (s.whatsapp_message as string) ?? null,
    ab_enabled: s.ab_enabled,
  }));

  const progress =
    campaign.total_prospects > 0
      ? Math.round((campaign.total_sent / campaign.total_prospects) * 100)
      : 0;

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">
          <Eye className="size-3.5 mr-1.5" />
          Apercu
        </TabsTrigger>
        <TabsTrigger value="sequence">
          <Layers className="size-3.5 mr-1.5" />
          Sequence
        </TabsTrigger>
        <TabsTrigger value="prospects">
          <Users className="size-3.5 mr-1.5" />
          Prospects
        </TabsTrigger>
        <TabsTrigger value="analytics">
          <BarChart3 className="size-3.5 mr-1.5" />
          Analytique
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="mt-4 space-y-4">
        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Prospects traites
                </span>
                <span className="font-medium">
                  {campaign.total_sent} / {campaign.total_prospects}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progress}% termine</p>
            </div>
          </CardContent>
        </Card>

        {/* Campaign details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Fuseau horaire</span>
                <p className="font-medium">{campaign.timezone}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fenetre d&apos;envoi</span>
                <p className="font-medium">
                  {campaign.sending_window_start} - {campaign.sending_window_end}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Limite journaliere</span>
                <p className="font-medium">
                  {campaign.daily_limit ?? "Non definie"} emails/jour
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Suivi des ouvertures</span>
                <p className="font-medium">
                  {campaign.track_opens ? "Active" : "Desactive"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Arret sur reponse</span>
                <p className="font-medium">
                  {campaign.stop_on_reply ? "Oui" : "Non"}
                </p>
              </div>
              {campaign.launched_at && (
                <div>
                  <span className="text-muted-foreground">Lancee le</span>
                  <p className="font-medium">
                    {new Date(campaign.launched_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sequence overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Sequence ({steps.length} etape{steps.length > 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune etape configuree.
              </p>
            ) : (
              <div className="space-y-2">
                {steps.map((step, idx) => {
                  const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
                    email: Mail,
                    delay: Clock,
                    linkedin_connect: UserPlus,
                    linkedin_message: MessageSquare,
                    condition: Clock,
                  };
                  const Icon = ICONS[step.step_type] ?? Clock;
                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50"
                    >
                      <span className="flex items-center justify-center size-6 rounded-full bg-slate-200 text-xs font-medium">
                        {idx + 1}
                      </span>
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {STEP_TYPES[step.step_type]?.label}
                      </span>
                      {step.step_type === "email" && step.subject && (
                        <span className="text-sm text-muted-foreground truncate">
                          {step.subject}
                        </span>
                      )}
                      {step.step_type === "delay" && (
                        <span className="text-sm text-muted-foreground">
                          {step.delay_days}j {step.delay_hours}h
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Sequence Tab - Read-only view */}
      <TabsContent value="sequence" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sequence de la campagne</CardTitle>
            <CardDescription>
              Vue en lecture seule de la sequence configuree.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SequenceEditor
              steps={editorSteps}
              onChange={() => {}}
              readOnly
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Prospects Tab */}
      <TabsContent value="prospects" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prospects inscrits</CardTitle>
            <CardDescription>
              {campaign.total_prospects} prospect
              {campaign.total_prospects > 1 ? "s" : ""} dans cette campagne.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              La liste des prospects inscrits sera disponible prochainement.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Analytics Tab */}
      <TabsContent value="analytics" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analytique</CardTitle>
            <CardDescription>
              Statistiques detaillees de la campagne.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Les graphiques et statistiques detaillees seront disponibles
              prochainement.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
