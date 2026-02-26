"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Briefcase,
  Globe,
  Mail,
  Phone,
  ExternalLink,
  Sparkles,
  UserPlus,
  Zap,
  Send,
  Copy,
  Check,
  Loader2,
  Star,
  MessageSquare,
  Target,
  Lightbulb,
  TrendingUp,
  Brain,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProfileData {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  location: string;
  headline: string;
  profileUrl: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
  relevanceScore: number;
  industry?: string;
  companySize?: string;
  connectionDegree?: string;
  summary?: string;
  experience?: {
    title: string;
    company: string;
    duration: string;
    description?: string;
  }[];
  skills?: string[];
}

interface AnalysisResult {
  score: number;
  breakdown: {
    category: string;
    score: number;
    reason: string;
  }[];
  talkingPoints: string[];
  recommendedApproach: string;
  icebreaker: string;
}

interface WebsiteAnalysis {
  url: string;
  title: string;
  description: string;
  technologies: string[];
  socialProfiles: string[];
  hasContactForm: boolean;
  employeeCount: string;
  revenue: string;
}

export default function ProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const profileId = params.profileId as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [websiteData, setWebsiteData] = useState<WebsiteAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingWebsite, setIsAnalyzingWebsite] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messageType, setMessageType] = useState<"connection" | "email">(
    "connection"
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("prospects")
          .select("*")
          .eq("id", profileId)
          .single();

        if (error || !data) {
          toast.error("Profil introuvable");
          router.push("/scraper");
          return;
        }

        setProfile({
          id: data.id,
          fullName: `${data.first_name} ${data.last_name}`,
          firstName: data.first_name,
          lastName: data.last_name,
          jobTitle: data.job_title || "",
          company: data.company || "",
          location: data.location || "",
          headline: data.custom_fields?.headline || "",
          profileUrl: data.linkedin_url || "",
          avatarUrl: data.custom_fields?.avatar_url,
          email: data.email,
          phone: data.phone,
          website: data.website,
          relevanceScore: data.custom_fields?.relevance_score || 0,
          industry: data.custom_fields?.industry,
          companySize: data.custom_fields?.company_size,
          connectionDegree: data.custom_fields?.connection_degree,
          summary: data.custom_fields?.summary,
          experience: data.custom_fields?.experience,
          skills: data.custom_fields?.skills,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [profileId, supabase, router]);

  async function handleAnalyze() {
    if (!profile) return;
    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/ai/analyze-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        toast.success("Analyse terminee");
      } else {
        toast.error("Erreur lors de l'analyse du profil");
      }
    } catch {
      toast.error("Erreur lors de l'analyse du profil");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleAnalyzeWebsite() {
    if (!profile?.website) return;
    setIsAnalyzingWebsite(true);

    try {
      const res = await fetch("/api/scraper/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: profile.website }),
      });

      if (res.ok) {
        const data = await res.json();
        setWebsiteData(data);
        toast.success("Analyse du site terminee");
      } else {
        toast.error("Erreur lors de l'analyse du site");
      }
    } catch {
      toast.error("Erreur lors de l'analyse du site");
    } finally {
      setIsAnalyzingWebsite(false);
    }
  }

  async function handleGenerateMessage(type: "connection" | "email") {
    if (!profile) return;
    setMessageType(type);
    setIsGenerating(true);
    setShowMessageDialog(true);

    try {
      const res = await fetch("/api/ai/analyze-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          action:
            type === "connection"
              ? "generate_connection_message"
              : "generate_email_sequence",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedMessage(data.message || "");
      } else {
        toast.error("Erreur lors de la generation du message");
        setShowMessageDialog(false);
      }
    } catch {
      toast.error("Erreur lors de la generation du message");
      setShowMessageDialog(false);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAddToProspects() {
    if (!profile) return;

    try {
      const { error } = await supabase.from("prospects").insert({
        email: profile.email || `${profile.firstName.toLowerCase()}.${profile.lastName.toLowerCase()}@placeholder.com`,
        first_name: profile.firstName,
        last_name: profile.lastName,
        company: profile.company,
        job_title: profile.jobTitle,
        linkedin_url: profile.profileUrl,
        location: profile.location,
        website: profile.website,
        phone: profile.phone,
        source: "linkedin" as const,
        status: "active" as const,
        workspace_id: "",
        custom_fields: {
          headline: profile.headline,
          relevance_score: profile.relevanceScore,
          industry: profile.industry,
          company_size: profile.companySize,
          summary: profile.summary,
        },
      });

      if (error) {
        toast.error("Erreur lors de l'ajout du prospect");
        return;
      }

      toast.success(`${profile.fullName} ajoute aux prospects`);
    } catch {
      toast.error("Erreur lors de l'ajout du prospect");
    }
  }

  function handleCopyMessage() {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    toast.success("Message copie dans le presse-papier");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLaunchSequence() {
    if (!profile) return;
    router.push(`/automation?prospects=${profile.id}`);
  }

  function getScoreColor(score: number): string {
    if (score >= 70) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  }

  function getScoreBg(score: number): string {
    if (score >= 70) return "bg-green-50 border-green-200";
    if (score >= 40) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  }

  function getScoreBarColor(score: number): string {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4 animate-pulse">
                  <div className="size-20 bg-slate-200 rounded-full" />
                  <div className="flex-1 space-y-3">
                    <div className="h-6 w-48 bg-slate-200 rounded" />
                    <div className="h-4 w-36 bg-slate-200 rounded" />
                    <div className="h-4 w-64 bg-slate-200 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardContent className="pt-6 animate-pulse">
                <div className="h-20 w-20 bg-slate-200 rounded-full mx-auto" />
                <div className="h-4 w-32 bg-slate-200 rounded mx-auto mt-3" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-muted-foreground">Profil introuvable</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/scraper">
            <ArrowLeft className="size-4" />
            Retour au scraper
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="gap-2">
        <Link href="/scraper">
          <ArrowLeft className="size-4" />
          Retour aux resultats
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Left side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-5">
                <div className="size-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-2xl shrink-0">
                  {profile.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {profile.fullName}
                  </h1>
                  <p className="text-lg text-slate-700 mt-0.5">
                    {profile.jobTitle}
                  </p>
                  <p className="text-muted-foreground">{profile.headline}</p>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="size-4" />
                      {profile.company}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      {profile.location}
                    </span>
                    {profile.industry && (
                      <Badge variant="secondary">{profile.industry}</Badge>
                    )}
                    {profile.companySize && (
                      <Badge variant="outline">
                        {profile.companySize} emp.
                      </Badge>
                    )}
                    {profile.connectionDegree && (
                      <Badge variant="secondary">
                        {profile.connectionDegree}
                      </Badge>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    {profile.email && (
                      <a
                        href={`mailto:${profile.email}`}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                      >
                        <Mail className="size-3.5" />
                        {profile.email}
                      </a>
                    )}
                    {profile.phone && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="size-3.5" />
                        {profile.phone}
                      </span>
                    )}
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                      >
                        <Globe className="size-3.5" />
                        {profile.website}
                      </a>
                    )}
                    <a
                      href={profile.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="size-3.5" />
                      Profil LinkedIn
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Analysis, Website, Profile */}
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList>
              <TabsTrigger value="analysis">Analyse IA</TabsTrigger>
              <TabsTrigger value="website">Site web</TabsTrigger>
              <TabsTrigger value="profile">Profil complet</TabsTrigger>
            </TabsList>

            {/* Analysis tab */}
            <TabsContent value="analysis" className="space-y-4">
              {!analysis ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center text-center">
                      <Brain className="size-12 text-slate-300 mb-4" />
                      <h3 className="text-lg font-semibold">
                        Analyse non effectuee
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        Lancez l&apos;analyse IA pour obtenir un score de
                        pertinence detaille, des points de discussion et une
                        approche recommandee.
                      </p>
                      <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="mt-4"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        Lancer l&apos;analyse
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Score breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Target className="size-5" />
                        Score de pertinence detaille
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {analysis.breakdown.map((item, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {item.category}
                            </span>
                            <span
                              className={`text-sm font-bold ${getScoreColor(
                                item.score
                              )}`}
                            >
                              {item.score}/100
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(
                                item.score
                              )}`}
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.reason}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Talking points */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Lightbulb className="size-5" />
                        Points de discussion suggeres
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysis.talkingPoints.map((point, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Star className="size-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Recommended approach */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="size-5" />
                        Approche recommandee
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-700">
                        {analysis.recommendedApproach}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Icebreaker */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageSquare className="size-5" />
                        Accroche generee
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-slate-800 italic">
                          &quot;{analysis.icebreaker}&quot;
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    variant="outline"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Relancer l&apos;analyse
                  </Button>
                </>
              )}
            </TabsContent>

            {/* Website tab */}
            <TabsContent value="website" className="space-y-4">
              {!profile.website ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center text-center">
                      <Globe className="size-12 text-slate-300 mb-4" />
                      <h3 className="text-lg font-semibold">
                        Aucun site web detecte
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Le site web de l&apos;entreprise n&apos;a pas ete
                        trouve dans le profil LinkedIn.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : !websiteData ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center text-center">
                      <Globe className="size-12 text-slate-300 mb-4" />
                      <h3 className="text-lg font-semibold">
                        Analyser le site web
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        Analysez le site web de {profile.company} pour obtenir
                        des informations supplementaires et personnaliser votre
                        approche.
                      </p>
                      <Button
                        onClick={handleAnalyzeWebsite}
                        disabled={isAnalyzingWebsite}
                        className="mt-4"
                      >
                        {isAnalyzingWebsite ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Globe className="size-4" />
                        )}
                        Analyser {profile.website}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Analyse du site web
                    </CardTitle>
                    <CardDescription>
                      <a
                        href={websiteData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {websiteData.url}
                      </a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Titre
                        </p>
                        <p className="text-sm mt-1">{websiteData.title}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Description
                        </p>
                        <p className="text-sm mt-1">
                          {websiteData.description}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Technologies
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {websiteData.technologies.map((tech) => (
                            <Badge
                              key={tech}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Reseaux sociaux
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {websiteData.socialProfiles.map((social) => (
                            <Badge
                              key={social}
                              variant="outline"
                              className="text-[10px]"
                            >
                              {social}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Formulaire de contact
                        </p>
                        <p className="text-sm mt-1">
                          {websiteData.hasContactForm ? "Oui" : "Non"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Employes (estimation)
                        </p>
                        <p className="text-sm mt-1">
                          {websiteData.employeeCount}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Profile tab */}
            <TabsContent value="profile" className="space-y-4">
              {/* Summary */}
              {profile.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">A propos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700 whitespace-pre-line">
                      {profile.summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Experience */}
              {profile.experience && profile.experience.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Experience</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {profile.experience.map((exp, idx) => (
                      <div key={idx}>
                        {idx > 0 && <Separator className="mb-4" />}
                        <div className="flex items-start gap-3">
                          <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Briefcase className="size-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {exp.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {exp.company}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {exp.duration}
                            </p>
                            {exp.description && (
                              <p className="text-sm text-slate-600 mt-2">
                                {exp.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Skills */}
              {profile.skills && profile.skills.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Competences</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Right side */}
        <div className="space-y-4">
          {/* Relevance score card */}
          <Card className={`border-2 ${getScoreBg(profile.relevanceScore)}`}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div
                  className={`text-4xl font-bold ${getScoreColor(
                    profile.relevanceScore
                  )}`}
                >
                  {profile.relevanceScore}
                </div>
                <p className="text-sm font-medium text-slate-700 mt-1">
                  Score de pertinence
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  sur 100
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start"
                onClick={() => handleGenerateMessage("connection")}
              >
                <MessageSquare className="size-4" />
                Generer message de connexion
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleGenerateMessage("email")}
              >
                <Send className="size-4" />
                Generer sequence email
              </Button>
              <Separator />
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleAddToProspects}
              >
                <UserPlus className="size-4" />
                Ajouter aux prospects
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleLaunchSequence}
              >
                <Zap className="size-4" />
                Lancer sequence auto
              </Button>
              <Separator />
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {analysis ? "Relancer l'analyse IA" : "Analyser avec IA"}
              </Button>
            </CardContent>
          </Card>

          {/* Quick info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Entreprise</span>
                <span className="font-medium">{profile.company}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Secteur</span>
                <span className="font-medium">
                  {profile.industry || "N/A"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Taille</span>
                <span className="font-medium">
                  {profile.companySize || "N/A"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connexion</span>
                <Badge variant="secondary">
                  {profile.connectionDegree || "N/A"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Message generation dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {messageType === "connection"
                ? "Message de connexion"
                : "Sequence email"}
            </DialogTitle>
            <DialogDescription>
              {messageType === "connection"
                ? "Message genere par l'IA pour la demande de connexion LinkedIn"
                : "Sequence email generee par l'IA pour contacter ce prospect"}
            </DialogDescription>
          </DialogHeader>

          {isGenerating ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="size-8 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground mt-3">
                Generation du message en cours...
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Message (modifiable avant envoi)
                </Label>
                <Textarea
                  value={generatedMessage}
                  onChange={(e) => setGeneratedMessage(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCopyMessage}>
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copie !" : "Copier"}
            </Button>
            <Button
              onClick={() => {
                toast.success("Message envoye (simulation)");
                setShowMessageDialog(false);
              }}
              disabled={isGenerating}
            >
              <Send className="size-4" />
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
