"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
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
  Bot,
  Linkedin,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Phone,
  QrCode,
  Wifi,
  WifiOff,
  CalendarCheck,
  Pencil,
  ExternalLink,
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
  booking_url: string;
}

export default function SettingsPage() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [aiCompanyContext, setAiCompanyContext] = useState("");
  const [aiTone, setAiTone] = useState("semi-formel");
  const [aiTargetAudience, setAiTargetAudience] = useState("");
  const [savingAi, setSavingAi] = useState(false);
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
      booking_url: string | null;
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
    booking_url: "",
  });

  // LinkedIn state
  const [linkedinLiAt, setLinkedinLiAt] = useState("");
  const [linkedinJsessionId, setLinkedinJsessionId] = useState("");
  const [linkedinStatus, setLinkedinStatus] = useState<"unknown" | "configured" | "not_configured" | "connected" | "expired" | "error">("unknown");
  const [linkedinStatusMessage, setLinkedinStatusMessage] = useState("");
  const [linkedinMaskedLiAt, setLinkedinMaskedLiAt] = useState("");
  const [linkedinMaskedJsessionId, setLinkedinMaskedJsessionId] = useState("");
  const [showLiAt, setShowLiAt] = useState(false);
  const [showJsessionId, setShowJsessionId] = useState(false);
  const [savingLinkedin, setSavingLinkedin] = useState(false);
  const [testingLinkedin, setTestingLinkedin] = useState(false);

  // WhatsApp state
  const [whatsappStatus, setWhatsappStatus] = useState<"disconnected" | "qr_pending" | "authenticating" | "ready" | "error">("disconnected");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappQrCode, setWhatsappQrCode] = useState<string | null>(null);
  const [whatsappLastError, setWhatsappLastError] = useState("");
  const [whatsappConnecting, setWhatsappConnecting] = useState(false);
  const [whatsappPolling, setWhatsappPolling] = useState(false);

  // Booking URL edit state
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editingBookingUrl, setEditingBookingUrl] = useState("");

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
      .select("name, ai_company_context, settings")
      .eq("id", profile.current_workspace_id)
      .single();

    if (workspace) {
      setWorkspaceName(workspace.name);
      setAiCompanyContext(workspace.ai_company_context || "");
      const wsSettings = workspace.settings as Record<string, unknown> | null;
      if (wsSettings) {
        setAiTone((wsSettings.ai_tone as string) || "semi-formel");
        setAiTargetAudience((wsSettings.ai_target_audience as string) || "");
      }
    }

    const { data: accounts } = await supabase
      .from("email_accounts")
      .select(
        "id, email_address, display_name, provider, is_active, health_score, daily_limit, warmup_enabled, booking_url"
      )
      .eq("workspace_id", profile.current_workspace_id)
      .eq("user_id", user.id);

    setEmailAccounts(accounts || []);

    // Load LinkedIn settings
    try {
      const linkedinRes = await fetch("/api/settings/linkedin");
      if (linkedinRes.ok) {
        const linkedinData = await linkedinRes.json();
        setLinkedinStatus(linkedinData.configured ? "configured" : "not_configured");
        setLinkedinMaskedLiAt(linkedinData.li_at_masked || "");
        setLinkedinMaskedJsessionId(linkedinData.jsessionid_masked || "");
      }
    } catch {
      // Non-blocking
    }

    // Load WhatsApp status
    try {
      const waRes = await fetch("/api/settings/whatsapp");
      if (waRes.ok) {
        const waData = await waRes.json();
        setWhatsappStatus(waData.status || "disconnected");
        setWhatsappPhone(waData.phoneNumber || "");
        setWhatsappQrCode(waData.qrCodeDataUrl || null);
        setWhatsappLastError(waData.lastError || "");
      }
    } catch {
      // Non-blocking
    }
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

  async function saveAiSettings() {
    setSavingAi(true);
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

    // Get current settings to merge
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("settings")
      .eq("id", profile.current_workspace_id)
      .single();

    const currentSettings = (workspace?.settings as Record<string, unknown>) || {};

    const { error } = await supabase
      .from("workspaces")
      .update({
        ai_company_context: aiCompanyContext,
        settings: {
          ...currentSettings,
          ai_tone: aiTone,
          ai_target_audience: aiTargetAudience,
        },
      })
      .eq("id", profile.current_workspace_id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Configuration IA sauvegardee");
    }
    setSavingAi(false);
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
      user_id: user.id,
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
      booking_url: newAccount.booking_url || null,
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

  async function saveBookingUrl(accountId: string, url: string) {
    const { error } = await supabase
      .from("email_accounts")
      .update({ booking_url: url || null })
      .eq("id", accountId);

    if (error) {
      toast.error("Erreur lors de la sauvegarde du lien");
    } else {
      toast.success("Lien de prise de RDV sauvegarde");
      setEditingBookingId(null);
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

  async function saveLinkedinSettings() {
    if (!linkedinLiAt || !linkedinJsessionId) {
      toast.error("Les deux cookies sont requis");
      return;
    }
    setSavingLinkedin(true);
    try {
      const res = await fetch("/api/settings/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ li_at: linkedinLiAt, jsessionid: linkedinJsessionId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Cookies LinkedIn sauvegardes");
        setLinkedinStatus("configured");
        setLinkedinLiAt("");
        setLinkedinJsessionId("");
        loadSettings();
      } else {
        toast.error(data.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur reseau");
    }
    setSavingLinkedin(false);
  }

  async function testLinkedinConnection() {
    const liAt = linkedinLiAt || undefined;
    const jsessionId = linkedinJsessionId || undefined;

    if (!liAt && !jsessionId && linkedinStatus !== "configured") {
      toast.error("Saisissez vos cookies avant de tester");
      return;
    }

    setTestingLinkedin(true);
    setLinkedinStatusMessage("");
    try {
      // If user typed new values, test those; otherwise test saved ones
      let testLiAt = liAt;
      let testJsessionId = jsessionId;

      if (!testLiAt || !testJsessionId) {
        // Fetch the saved raw values via a special test with saved cookies
        // We send action=test without cookies to test the saved ones
        const admin = createClient();
        const { data: { user } } = await admin.auth.getUser();
        if (!user) { setTestingLinkedin(false); return; }
        const { data: profile } = await admin.from("profiles").select("current_workspace_id").eq("id", user.id).single();
        if (!profile?.current_workspace_id) { setTestingLinkedin(false); return; }
        const { data: workspace } = await admin.from("workspaces").select("settings").eq("id", profile.current_workspace_id).single();
        const settings = (workspace?.settings || {}) as Record<string, string>;
        testLiAt = settings.linkedin_li_at;
        testJsessionId = settings.linkedin_jsessionid;
      }

      if (!testLiAt || !testJsessionId) {
        toast.error("Aucun cookie configure");
        setTestingLinkedin(false);
        return;
      }

      const res = await fetch("/api/settings/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", li_at: testLiAt, jsessionid: testJsessionId }),
      });
      const data = await res.json();
      setLinkedinStatus(data.status as typeof linkedinStatus);
      setLinkedinStatusMessage(data.message);
      if (data.success) {
        toast.success("Connexion LinkedIn reussie !");
      } else {
        toast.error(data.message || "Echec de la connexion");
      }
    } catch {
      toast.error("Erreur reseau");
    }
    setTestingLinkedin(false);
  }

  async function connectWhatsApp() {
    setWhatsappConnecting(true);
    setWhatsappLastError("");
    try {
      const res = await fetch("/api/settings/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize" }),
      });
      const data = await res.json();
      if (data.status) {
        setWhatsappStatus(data.status);
        setWhatsappQrCode(data.qrCode || null);
        setWhatsappPhone(data.phoneNumber || "");
      }
      // Start polling for QR code / status updates
      setWhatsappPolling(true);
    } catch {
      toast.error("Erreur lors de la connexion WhatsApp");
    }
    setWhatsappConnecting(false);
  }

  async function disconnectWhatsApp() {
    try {
      await fetch("/api/settings/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setWhatsappStatus("disconnected");
      setWhatsappPhone("");
      setWhatsappQrCode(null);
      setWhatsappPolling(false);
      toast.success("WhatsApp deconnecte");
    } catch {
      toast.error("Erreur lors de la deconnexion");
    }
  }

  // Polling WhatsApp status
  useEffect(() => {
    if (!whatsappPolling) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/settings/whatsapp");
        if (res.ok) {
          const data = await res.json();
          setWhatsappStatus(data.status || "disconnected");
          setWhatsappPhone(data.phoneNumber || "");
          setWhatsappQrCode(data.qrCodeDataUrl || null);
          setWhatsappLastError(data.lastError || "");

          if (data.status === "ready") {
            setWhatsappPolling(false);
            toast.success("WhatsApp connecte !");
          } else if (data.status === "error" || data.status === "disconnected") {
            setWhatsappPolling(false);
            if (data.lastError) {
              toast.error(data.lastError);
            }
          }
        }
      } catch {
        // Silencieux
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [whatsappPolling]);

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
          <TabsTrigger value="ai">
            <Bot className="mr-2 h-4 w-4" />
            IA & Prospection
          </TabsTrigger>
          <TabsTrigger value="linkedin">
            <Linkedin className="mr-2 h-4 w-4" />
            LinkedIn
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <Phone className="mr-2 h-4 w-4" />
            WhatsApp
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
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
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
                </div>
                {/* Booking URL */}
                <div className="flex items-center gap-2 pl-6">
                  <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                  {editingBookingId === account.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingBookingUrl}
                        onChange={(e) => setEditingBookingUrl(e.target.value)}
                        placeholder="https://tidycal.com/votre-lien"
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => saveBookingUrl(account.id, editingBookingUrl)}
                      >
                        Sauvegarder
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => setEditingBookingId(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : account.booking_url ? (
                    <div className="flex items-center gap-2 flex-1">
                      <a
                        href={account.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate max-w-[300px]"
                      >
                        {account.booking_url}
                      </a>
                      <ExternalLink className="h-3 w-3 text-blue-600 shrink-0" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => {
                          setEditingBookingId(account.id);
                          setEditingBookingUrl(account.booking_url || "");
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-sm text-muted-foreground"
                      onClick={() => {
                        setEditingBookingId(account.id);
                        setEditingBookingUrl("");
                      }}
                    >
                      + Ajouter un lien de prise de RDV
                    </Button>
                  )}
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
                  <Label>Lien de prise de RDV (TidyCal, Calendly...)</Label>
                  <Input
                    value={newAccount.booking_url}
                    onChange={(e) =>
                      setNewAccount((p) => ({
                        ...p,
                        booking_url: e.target.value,
                      }))
                    }
                    placeholder="https://tidycal.com/votre-lien"
                  />
                  <p className="text-xs text-muted-foreground">
                    L&apos;IA pourra proposer ce lien dans les emails pour inviter les prospects a reserver un creneau.
                  </p>
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

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contexte entreprise pour l&apos;IA</CardTitle>
              <CardDescription>
                Decrivez precisement votre entreprise, ce que vous vendez et a
                qui. L&apos;IA utilisera ce texte pour personnaliser chaque
                email de prospection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>
                  Description de votre entreprise et de votre offre
                </Label>
                <Textarea
                  value={aiCompanyContext}
                  onChange={(e) => setAiCompanyContext(e.target.value)}
                  placeholder={`Exemple :

Nous sommes [Nom de l'entreprise], une agence/startup/societe basee a [Ville].

Notre offre :
Nous proposons [description detaillee de vos produits/services]. Notre solution permet de [benefice principal] pour [type de clients].

Nos clients types :
- [Segment 1] : ex. TPE du batiment qui ont besoin de...
- [Segment 2] : ex. PME industrielles qui cherchent...

Ce qui nous differencie :
- [Avantage 1]
- [Avantage 2]
- [Avantage 3]

Resultats concrets :
- [Chiffre cle 1] : ex. "nos clients gagnent 5h/semaine"
- [Chiffre cle 2] : ex. "+30% de conformite en 3 mois"

Ce que nous cherchons :
Nous voulons prendre contact avec [type de decideur] dans [secteur] pour leur proposer [offre specifique].`}
                  rows={18}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Plus votre description est precise et detaillee, plus l&apos;IA
                  generera des emails pertinents et personnalises.
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Audience cible</Label>
                  <Textarea
                    value={aiTargetAudience}
                    onChange={(e) => setAiTargetAudience(e.target.value)}
                    placeholder="Ex: Dirigeants de TPE/PME dans le BTP, directeurs qualite dans l'industrie, gerants de cabinets comptables..."
                    rows={3}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ton des emails</Label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formel">
                        Formel - Vouvoiement strict, tres professionnel
                      </SelectItem>
                      <SelectItem value="semi-formel">
                        Semi-formel - Professionnel mais chaleureux
                      </SelectItem>
                      <SelectItem value="decontracte">
                        Decontracte - Direct et naturel
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Le ton influence la facon dont l&apos;IA redige vos emails.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-blue-50 p-4">
                <h4 className="font-medium text-sm text-blue-900 mb-2">
                  Comment l&apos;IA utilise ces informations
                </h4>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>
                    Elle adapte chaque email en fonction de votre offre et du
                    profil du prospect
                  </li>
                  <li>
                    Elle analyse les performances passees (ouvertures, clics,
                    reponses) pour ameliorer les futurs emails
                  </li>
                  <li>
                    Elle s&apos;inspire des emails qui ont eu les meilleurs
                    resultats
                  </li>
                  <li>
                    Si les donnees de l&apos;entreprise du prospect sont
                    disponibles (via le scraper), elle personnalise encore plus
                  </li>
                </ul>
              </div>

              <Button onClick={saveAiSettings} disabled={savingAi}>
                {savingAi && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sauvegarder la configuration IA
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="linkedin" className="space-y-4">
          {/* How it works */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                Comment fonctionne la connexion LinkedIn
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm text-blue-900 space-y-2 list-disc list-inside">
                <li>
                  L&apos;outil utilise les <strong>cookies de session</strong> de votre compte LinkedIn pour effectuer des recherches, voir des profils et envoyer des messages.
                </li>
                <li>
                  Toutes les actions passent par votre compte LinkedIn personnel. LinkedIn ne fournit pas d&apos;API publique pour ces fonctionnalites.
                </li>
                <li>
                  Les cookies <strong>expirent regulierement</strong> (toutes les quelques semaines). Quand ca arrive, mettez-les a jour ici.
                </li>
                <li>
                  Pour eviter les restrictions LinkedIn, l&apos;outil respecte des <strong>limites quotidiennes</strong> sur chaque type d&apos;action.
                </li>
              </ul>
              <Separator className="bg-blue-200" />
              <div>
                <h4 className="font-medium text-sm text-blue-900 mb-2">
                  Comment recuperer vos cookies LinkedIn
                </h4>
                <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside">
                  <li>Connectez-vous a <strong>linkedin.com</strong> dans votre navigateur</li>
                  <li>Ouvrez les DevTools : <kbd className="px-1.5 py-0.5 bg-blue-100 rounded text-xs font-mono">F12</kbd> ou <kbd className="px-1.5 py-0.5 bg-blue-100 rounded text-xs font-mono">Ctrl+Shift+I</kbd></li>
                  <li>Allez dans l&apos;onglet <strong>Application</strong> (ou Storage)</li>
                  <li>Dans le menu de gauche : <strong>Cookies &gt; https://www.linkedin.com</strong></li>
                  <li>Copiez la valeur du cookie <code className="px-1 py-0.5 bg-blue-100 rounded text-xs font-mono">li_at</code></li>
                  <li>Copiez la valeur du cookie <code className="px-1 py-0.5 bg-blue-100 rounded text-xs font-mono">JSESSIONID</code> (sans les guillemets)</li>
                  <li>Collez les valeurs ci-dessous et sauvegardez</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Configuration LinkedIn</CardTitle>
                {linkedinStatus === "connected" && (
                  <Badge className="bg-green-100 text-green-800 gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Connecte
                  </Badge>
                )}
                {linkedinStatus === "configured" && (
                  <Badge className="bg-blue-100 text-blue-800 gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Configure
                  </Badge>
                )}
                {linkedinStatus === "expired" && (
                  <Badge className="bg-red-100 text-red-800 gap-1">
                    <XCircle className="h-3 w-3" />
                    Session expiree
                  </Badge>
                )}
                {linkedinStatus === "not_configured" && (
                  <Badge className="bg-gray-100 text-gray-600 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Non configure
                  </Badge>
                )}
                {linkedinStatus === "error" && (
                  <Badge className="bg-red-100 text-red-800 gap-1">
                    <XCircle className="h-3 w-3" />
                    Erreur
                  </Badge>
                )}
              </div>
              {linkedinStatusMessage && (
                <p className={`text-sm mt-1 ${linkedinStatus === "connected" ? "text-green-700" : "text-red-600"}`}>
                  {linkedinStatusMessage}
                </p>
              )}
              <CardDescription>
                {linkedinStatus === "configured" || linkedinStatus === "connected"
                  ? "Vos cookies LinkedIn sont configures. Vous pouvez les mettre a jour ci-dessous."
                  : "Configurez vos cookies LinkedIn pour activer les recherches et l'automatisation."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(linkedinStatus === "configured" || linkedinStatus === "connected") && !linkedinLiAt && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Cookies actuels (masques)</p>
                  <p className="text-sm font-mono">li_at: {linkedinMaskedLiAt || "***"}</p>
                  <p className="text-sm font-mono">JSESSIONID: {linkedinMaskedJsessionId || "***"}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="li_at">Cookie li_at</Label>
                <div className="relative">
                  <Input
                    id="li_at"
                    type={showLiAt ? "text" : "password"}
                    value={linkedinLiAt}
                    onChange={(e) => setLinkedinLiAt(e.target.value)}
                    placeholder="AQEDARuUvd0DJsy6..."
                    className="pr-10 font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowLiAt(!showLiAt)}
                    type="button"
                  >
                    {showLiAt ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jsessionid">Cookie JSESSIONID</Label>
                <div className="relative">
                  <Input
                    id="jsessionid"
                    type={showJsessionId ? "text" : "password"}
                    value={linkedinJsessionId}
                    onChange={(e) => setLinkedinJsessionId(e.target.value)}
                    placeholder="ajax:8203344785197656309"
                    className="pr-10 font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowJsessionId(!showJsessionId)}
                    type="button"
                  >
                    {showJsessionId ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveLinkedinSettings} disabled={savingLinkedin || (!linkedinLiAt && !linkedinJsessionId)}>
                  {savingLinkedin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sauvegarder
                </Button>
                <Button
                  variant="outline"
                  onClick={testLinkedinConnection}
                  disabled={testingLinkedin}
                >
                  {testingLinkedin ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="mr-2 h-4 w-4" />
                  )}
                  Tester la connexion
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Daily limits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limites quotidiennes LinkedIn</CardTitle>
              <CardDescription>
                Pour proteger votre compte, l&apos;outil respecte ces limites par jour.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">25-30</p>
                  <p className="text-xs text-muted-foreground">Recherches / jour</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">80-150</p>
                  <p className="text-xs text-muted-foreground">Vues profil / jour</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">20-25</p>
                  <p className="text-xs text-muted-foreground">Connexions / jour</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">50-100</p>
                  <p className="text-xs text-muted-foreground">Messages / jour</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="whatsapp" className="space-y-4">
          {/* How it works */}
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-green-600" />
                Comment fonctionne la connexion WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm text-green-900 space-y-2 list-disc list-inside">
                <li>
                  L&apos;outil se connecte a <strong>votre compte WhatsApp personnel</strong> en scannant un QR code (comme WhatsApp Web).
                </li>
                <li>
                  Les messages sont envoyes depuis votre numero. WhatsApp ne fournit pas d&apos;API gratuite pour ca.
                </li>
                <li>
                  La session reste active sur le serveur. Si elle expire, vous devrez re-scanner le QR code.
                </li>
                <li>
                  Pour eviter les restrictions, l&apos;outil envoie <strong>maximum ~20 messages/jour</strong> et respecte des delais entre chaque envoi.
                </li>
              </ul>
              <Separator className="bg-green-200" />
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Attention</p>
                  <p className="text-xs mt-1">
                    L&apos;envoi massif de messages non sollicites peut entrainer un ban de votre compte WhatsApp.
                    Utilisez cette fonctionnalite avec moderation et uniquement pour des prospects pertinents.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connection status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Connexion WhatsApp</CardTitle>
                {whatsappStatus === "ready" && (
                  <Badge className="bg-green-100 text-green-800 gap-1">
                    <Wifi className="h-3 w-3" />
                    Connecte
                  </Badge>
                )}
                {whatsappStatus === "qr_pending" && (
                  <Badge className="bg-yellow-100 text-yellow-800 gap-1">
                    <QrCode className="h-3 w-3" />
                    En attente du scan
                  </Badge>
                )}
                {whatsappStatus === "authenticating" && (
                  <Badge className="bg-blue-100 text-blue-800 gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Authentification...
                  </Badge>
                )}
                {whatsappStatus === "disconnected" && (
                  <Badge className="bg-gray-100 text-gray-600 gap-1">
                    <WifiOff className="h-3 w-3" />
                    Deconnecte
                  </Badge>
                )}
                {whatsappStatus === "error" && (
                  <Badge className="bg-red-100 text-red-800 gap-1">
                    <XCircle className="h-3 w-3" />
                    Erreur
                  </Badge>
                )}
              </div>
              <CardDescription>
                {whatsappStatus === "ready"
                  ? `Connecte avec le numero ${whatsappPhone || "inconnu"}`
                  : whatsappStatus === "qr_pending"
                    ? "Scannez le QR code ci-dessous avec votre application WhatsApp"
                    : "Connectez votre compte WhatsApp pour envoyer des messages automatiquement."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Code display */}
              {whatsappStatus === "qr_pending" && whatsappQrCode && (
                <div className="flex flex-col items-center gap-3 p-4 rounded-lg border bg-white">
                  <Image
                    src={whatsappQrCode}
                    alt="QR Code WhatsApp"
                    width={256}
                    height={256}
                    unoptimized
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Ouvrez WhatsApp sur votre telephone &gt; Menu &gt; Appareils connectes &gt; Connecter un appareil
                  </p>
                </div>
              )}

              {/* Connected info */}
              {whatsappStatus === "ready" && whatsappPhone && (
                <div className="rounded-lg border bg-green-50 p-3 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Numero connecte</p>
                    <p className="text-sm font-mono text-green-700">+{whatsappPhone}</p>
                  </div>
                </div>
              )}

              {/* Error display */}
              {whatsappLastError && whatsappStatus === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">{whatsappLastError}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {whatsappStatus === "disconnected" || whatsappStatus === "error" ? (
                  <Button
                    onClick={connectWhatsApp}
                    disabled={whatsappConnecting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {whatsappConnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="mr-2 h-4 w-4" />
                    )}
                    Connecter WhatsApp
                  </Button>
                ) : whatsappStatus === "ready" ? (
                  <Button variant="outline" onClick={disconnectWhatsApp}>
                    <WifiOff className="mr-2 h-4 w-4" />
                    Deconnecter
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Daily limits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limites quotidiennes WhatsApp</CardTitle>
              <CardDescription>
                Pour proteger votre compte, l&apos;outil applique des limites strictes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">~20</p>
                  <p className="text-xs text-muted-foreground">Messages / jour</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">3-8s</p>
                  <p className="text-xs text-muted-foreground">Delai entre messages</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Ces limites sont volontairement basses en phase de demarrage. Elles pourront etre augmentees progressivement une fois votre compte &quot;chauffe&quot;.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
