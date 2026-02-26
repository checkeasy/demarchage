"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Settings,
  Mail,
  Building,
  User,
  Plus,
  Trash2,
  TestTube,
  Loader2,
} from "lucide-react";

interface EmailAccountForm {
  email_address: string;
  display_name: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_pass: string;
  daily_limit: number;
  signature_html: string;
  warmup_enabled: boolean;
}

export default function SettingsPage() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [emailAccounts, setEmailAccounts] = useState<
    Array<{
      id: string;
      email_address: string;
      display_name: string | null;
      provider: string;
      is_active: boolean;
      health_score: number;
      daily_limit: number;
      warmup_enabled: boolean;
    }>
  >([]);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAccount, setNewAccount] = useState<EmailAccountForm>({
    email_address: "",
    display_name: "",
    provider: "custom",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_pass: "",
    imap_host: "",
    imap_port: 993,
    imap_user: "",
    imap_pass: "",
    daily_limit: 50,
    signature_html: "",
    warmup_enabled: false,
  });

  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadSettings = useCallback(async () => {
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

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", profile.current_workspace_id)
      .single();

    if (workspace) setWorkspaceName(workspace.name);

    const { data: accounts } = await supabase
      .from("email_accounts")
      .select(
        "id, email_address, display_name, provider, is_active, health_score, daily_limit, warmup_enabled"
      )
      .eq("workspace_id", profile.current_workspace_id);

    setEmailAccounts(accounts || []);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveWorkspace() {
    setSaving(true);
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

    const { error } = await supabase
      .from("workspaces")
      .update({ name: workspaceName })
      .eq("id", profile.current_workspace_id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Parametres sauvegardes");
    }
    setSaving(false);
  }

  async function addEmailAccount() {
    setSaving(true);
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

    const { error } = await supabase.from("email_accounts").insert({
      workspace_id: profile.current_workspace_id,
      email_address: newAccount.email_address,
      display_name: newAccount.display_name || null,
      provider: newAccount.provider,
      smtp_host: newAccount.smtp_host || null,
      smtp_port: newAccount.smtp_port,
      smtp_user: newAccount.smtp_user || null,
      smtp_pass_encrypted: newAccount.smtp_pass || null,
      imap_host: newAccount.imap_host || null,
      imap_port: newAccount.imap_port,
      imap_user: newAccount.imap_user || null,
      imap_pass_encrypted: newAccount.imap_pass || null,
      daily_limit: newAccount.daily_limit,
      signature_html: newAccount.signature_html || "",
      warmup_enabled: newAccount.warmup_enabled,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout du compte");
    } else {
      toast.success("Compte email ajoute");
      setShowAddEmail(false);
      loadSettings();
    }
    setSaving(false);
  }

  async function deleteEmailAccount(id: string) {
    const { error } = await supabase
      .from("email_accounts")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Compte email supprime");
      loadSettings();
    }
  }

  function applyProviderPreset(provider: string) {
    setNewAccount((prev) => {
      const presets: Record<
        string,
        Partial<EmailAccountForm>
      > = {
        gmail: {
          smtp_host: "smtp.gmail.com",
          smtp_port: 587,
          imap_host: "imap.gmail.com",
          imap_port: 993,
        },
        outlook: {
          smtp_host: "smtp-mail.outlook.com",
          smtp_port: 587,
          imap_host: "outlook.office365.com",
          imap_port: 993,
        },
        custom: {
          smtp_host: "",
          smtp_port: 587,
          imap_host: "",
          imap_port: 993,
        },
      };

      return { ...prev, provider, ...(presets[provider] || {}) };
    });
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Parametres</h1>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">
            <Building className="mr-2 h-4 w-4" />
            Espace de travail
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="mr-2 h-4 w-4" />
            Comptes email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Espace de travail</CardTitle>
              <CardDescription>
                Configurez les parametres de votre espace de travail.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nom de l&apos;espace</Label>
                <Input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />
              </div>
              <Button onClick={saveWorkspace} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sauvegarder
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Comptes email</h2>
              <p className="text-sm text-muted-foreground">
                Gerez les comptes utilises pour envoyer vos campagnes.
              </p>
            </div>
            <Button onClick={() => setShowAddEmail(!showAddEmail)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un compte
            </Button>
          </div>

          {/* Existing accounts */}
          {emailAccounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      account.is_active ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <div>
                    <p className="font-medium">{account.email_address}</p>
                    <p className="text-sm text-muted-foreground">
                      {account.display_name || account.provider} - Limite: {account.daily_limit}/jour
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      account.health_score > 80
                        ? "default"
                        : account.health_score > 50
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    Sante: {account.health_score}%
                  </Badge>
                  {account.warmup_enabled && (
                    <Badge variant="outline">Warmup actif</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteEmailAccount(account.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add email form */}
          {showAddEmail && (
            <Card>
              <CardHeader>
                <CardTitle>Nouveau compte email</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Adresse email</Label>
                    <Input
                      value={newAccount.email_address}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          email_address: e.target.value,
                        }))
                      }
                      placeholder="vous@entreprise.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom d&apos;affichage</Label>
                    <Input
                      value={newAccount.display_name}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          display_name: e.target.value,
                        }))
                      }
                      placeholder="Jean Dupont"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Fournisseur</Label>
                  <Select
                    value={newAccount.provider}
                    onValueChange={applyProviderPreset}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmail">Gmail</SelectItem>
                      <SelectItem value="outlook">Outlook</SelectItem>
                      <SelectItem value="custom">Personnalise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />
                <h3 className="font-medium">Configuration SMTP (envoi)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Serveur SMTP</Label>
                    <Input
                      value={newAccount.smtp_host}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          smtp_host: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      type="number"
                      value={newAccount.smtp_port}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          smtp_port: parseInt(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Utilisateur</Label>
                    <Input
                      value={newAccount.smtp_user}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          smtp_user: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mot de passe</Label>
                    <Input
                      type="password"
                      value={newAccount.smtp_pass}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          smtp_pass: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <Separator />
                <h3 className="font-medium">Configuration IMAP (reception)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Serveur IMAP</Label>
                    <Input
                      value={newAccount.imap_host}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          imap_host: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      type="number"
                      value={newAccount.imap_port}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          imap_port: parseInt(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Limite quotidienne</Label>
                    <Input
                      type="number"
                      value={newAccount.daily_limit}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          daily_limit: parseInt(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={newAccount.warmup_enabled}
                      onCheckedChange={(checked) =>
                        setNewAccount((p) => ({
                          ...p,
                          warmup_enabled: checked,
                        }))
                      }
                    />
                    <Label>Activer le warmup</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Signature HTML</Label>
                  <Textarea
                    value={newAccount.signature_html}
                    onChange={(e) =>
                      setNewAccount((p) => ({
                        ...p,
                        signature_html: e.target.value,
                      }))
                    }
                    placeholder="<p>Cordialement,<br/>Jean Dupont</p>"
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={addEmailAccount} disabled={saving}>
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Ajouter le compte
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowAddEmail(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
