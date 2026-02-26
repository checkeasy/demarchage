import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CampaignListClient } from "@/components/campaigns/CampaignListClient";
import type { Campaign } from "@/lib/types/database";

export default async function CampaignsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get user profile to determine current workspace
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  let campaigns: Campaign[] = [];

  if (profile?.current_workspace_id) {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("workspace_id", profile.current_workspace_id)
      .order("created_at", { ascending: false });

    campaigns = (data ?? []) as Campaign[];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Campagnes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerez vos campagnes de prospection multi-canal
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="size-4" />
            Nouvelle campagne
          </Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-2">
              <Send className="size-8 text-slate-400" />
            </div>
            <CardTitle>Aucune campagne</CardTitle>
            <CardDescription>
              Creez votre premiere campagne pour commencer a prospecter.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button asChild>
              <Link href="/campaigns/new">
                <Plus className="size-4" />
                Creer une campagne
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <CampaignListClient campaigns={campaigns} />
      )}
    </div>
  );
}
