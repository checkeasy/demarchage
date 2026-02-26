"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");

  async function handleCreateWorkspace() {
    if (!companyName.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Veuillez vous connecter");
        router.push("/auth/login");
        return;
      }

      // Create workspace
      const { data: workspace, error: wsError } = await supabase
        .from("workspaces")
        .insert({
          name: companyName.trim(),
          ai_company_context: companyDescription.trim() || null,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (wsError) throw wsError;
      if (!workspace) throw new Error("Erreur creation workspace");

      // Add user as workspace member (owner)
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      // Set as current workspace on profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ current_workspace_id: workspace.id })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast.success("Workspace cree avec succes !");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Erreur lors de la creation du workspace");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="size-16 rounded-2xl bg-blue-100 flex items-center justify-center">
              <Building2 className="size-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Bienvenue sur ColdReach</CardTitle>
          <CardDescription>
            Creez votre espace de travail pour commencer a prospecter
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="company-name">
              Nom de votre entreprise <span className="text-red-500">*</span>
            </Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Mon Agence Digital"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-desc">
              Description de votre activite (optionnel)
            </Label>
            <Textarea
              id="company-desc"
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="Decrivez votre entreprise et vos services en quelques phrases. Cela aidera l'IA a personnaliser vos messages de prospection."
              rows={4}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Cette description sera utilisee par les agents IA pour generer des messages personnalises.
            </p>
          </div>

          <Button
            onClick={handleCreateWorkspace}
            disabled={loading || !companyName.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {loading ? "Creation en cours..." : "Creer mon workspace"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
