"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  SequenceEditor,
  type StepData,
} from "@/components/campaigns/SequenceEditor";
import {
  ScheduleConfig,
  getDefaultSchedule,
  type ScheduleData,
} from "@/components/campaigns/ScheduleConfig";
import type { Campaign, SequenceStep, EmailAccount } from "@/lib/types/database";

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Campaign data
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emailAccountId, setEmailAccountId] = useState("");
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);

  // Sequence
  const [steps, setSteps] = useState<StepData[]>([]);

  // Schedule
  const [schedule, setSchedule] = useState<ScheduleData>(getDefaultSchedule());

  useEffect(() => {
    async function loadCampaign() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Load campaign
        const { data: campaign, error } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignId)
          .single();

        if (error || !campaign) {
          toast.error("Campagne introuvable");
          router.push("/campaigns");
          return;
        }

        const c = campaign as Campaign;
        setName(c.name);
        setDescription(c.description ?? "");
        setEmailAccountId(c.email_account_id ?? "");
        setSchedule({
          timezone: c.timezone,
          sending_window_start: c.sending_window_start,
          sending_window_end: c.sending_window_end,
          sending_days: c.sending_days,
          daily_limit: c.daily_limit ?? 50,
        });

        // Load email accounts
        const { data: accounts } = await supabase
          .from("email_accounts")
          .select("*")
          .eq("workspace_id", c.workspace_id)
          .eq("is_active", true);

        setEmailAccounts((accounts ?? []) as EmailAccount[]);

        // Load sequence steps
        const { data: stepsData } = await supabase
          .from("sequence_steps")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("step_order", { ascending: true });

        const dbSteps = (stepsData ?? []) as (SequenceStep & Record<string, unknown>)[];
        setSteps(
          dbSteps.map((s) => ({
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
            use_ai_generation: (s.use_ai_generation as boolean) ?? false,
            ai_prompt_context: (s.ai_prompt_context as string) ?? null,
          }))
        );
      } catch (err) {
        console.error("Error loading campaign:", err);
        toast.error("Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    }

    loadCampaign();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, supabase]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Le nom de la campagne est requis");
      return;
    }

    if (!emailAccountId) {
      toast.error("Un compte email est requis pour envoyer les emails");
      return;
    }

    setSaving(true);

    try {
      // Update campaign
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({
          name,
          description: description || null,
          email_account_id: emailAccountId || null,
          timezone: schedule.timezone,
          sending_window_start: schedule.sending_window_start,
          sending_window_end: schedule.sending_window_end,
          sending_days: schedule.sending_days,
          daily_limit: schedule.daily_limit,
        })
        .eq("id", campaignId);

      if (updateError) throw updateError;

      // Save steps via server-side API (uses admin client to handle FK constraints)
      const stepsRes = await fetch(`/api/campaigns/${campaignId}/steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });

      if (!stepsRes.ok) {
        const err = await stepsRes.json();
        throw new Error(err.error || "Failed to save steps");
      }

      toast.success("Campagne mise a jour avec succes !");
      router.push(`/campaigns/${campaignId}`);
    } catch (error: unknown) {
      console.error("Error updating campaign:", error);
      toast.error("Erreur lors de la mise a jour");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/campaigns/${campaignId}`)}
          >
            <ChevronLeft className="size-4" />
            Retour
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Modifier la campagne
            </h2>
            <p className="text-sm text-muted-foreground">{name}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="sequence">Sequence</TabsTrigger>
          <TabsTrigger value="schedule">Planification</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Informations generales
              </CardTitle>
              <CardDescription>
                Modifiez le nom, la description et le compte email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="edit-name">
                  Nom de la campagne <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom de la campagne"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description de la campagne..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Compte email</Label>
                <Select
                  value={emailAccountId}
                  onValueChange={setEmailAccountId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selectionner un compte email" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.display_name
                          ? `${account.display_name} (${account.email_address})`
                          : account.email_address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sequence Tab */}
        <TabsContent value="sequence" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Editeur de sequence
              </CardTitle>
              <CardDescription>
                Modifiez les etapes de votre sequence. Glissez-deposez pour
                reordonner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SequenceEditor steps={steps} onChange={setSteps} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planification</CardTitle>
              <CardDescription>
                Configurez les horaires et la frequence d&apos;envoi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduleConfig value={schedule} onChange={setSchedule} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
