"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutGrid,
  List,
  UserPlus,
  Zap,
  Brain,
  Loader2,
  ChevronDown,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { SearchForm, type SearchFilters } from "@/components/scraper/SearchForm";
import { ProfileCard, type LinkedInProfile, type EnrichmentData } from "@/components/scraper/ProfileCard";
import { EmailComposer } from "@/components/email/EmailComposer";
import { SafetyGauge } from "@/components/scraper/SafetyGauge";
import { trackAction } from "@/lib/linkedin/safety-tracker";

export default function ScraperPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [hasSearched, setHasSearched] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [isEnrichingBulk, setIsEnrichingBulk] = useState(false);

  // Enrichment data per profile
  const [enrichmentMap, setEnrichmentMap] = useState<Map<string, EnrichmentData>>(new Map());

  // Email composer state
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    company: string;
    jobTitle: string;
  } | null>(null);

  const handleSearch = useCallback(async (filters: SearchFilters) => {
    setIsSearching(true);
    setHasSearched(true);
    setSelectedIds(new Set());
    setEnrichmentMap(new Map());

    try {
      const res = await fetch("/api/linkedin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });

      const data = await res.json();

      if (res.ok) {
        trackAction('search');
        setProfiles(data.profiles || []);
        if ((data.profiles || []).length === 0) {
          toast.info("Aucun resultat trouve. Essayez d'elargir vos criteres.");
        } else {
          toast.success(`${data.profiles.length} profil(s) trouve(s)`);
        }
      } else {
        toast.error(data.error || `Erreur ${res.status}`);
        setProfiles([]);
      }
    } catch {
      toast.error("Erreur reseau. Verifiez votre connexion.");
      setProfiles([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === profiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(profiles.map((p) => p.id)));
    }
  }

  // --- Enrich a single profile ---
  async function handleEnrich(profile: LinkedInProfile) {
    const companyName = profile.company?.trim();
    if (!companyName) {
      toast.warning(`Pas de nom d'entreprise pour ${profile.fullName}`);
      return;
    }

    // Set loading state
    setEnrichmentMap((prev) => {
      const next = new Map(prev);
      next.set(profile.id, { loading: true });
      return next;
    });

    try {
      const res = await fetch("/api/scraper/enrich-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactName: `${profile.firstName} ${profile.lastName}`,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setEnrichmentMap((prev) => {
          const next = new Map(prev);
          next.set(profile.id, {
            website: data.data.website,
            emails: data.data.emails?.emails || [],
            loading: false,
          });
          return next;
        });

        trackAction('enrichment');
        const emailCount = data.data.emails?.emails?.length || 0;
        if (emailCount > 0) {
          toast.success(`${emailCount} email(s) trouve(s) pour ${profile.company}`);
        } else if (data.data.website?.websiteUrl) {
          toast.info(`Site trouve mais aucun email pour ${profile.company}`);
        } else {
          toast.warning(`Aucune donnee trouvee pour ${profile.company}`);
        }
      } else {
        setEnrichmentMap((prev) => {
          const next = new Map(prev);
          next.set(profile.id, { loading: false });
          return next;
        });
        toast.error(data.error || `Enrichissement echoue pour ${profile.company}`);
      }
    } catch {
      setEnrichmentMap((prev) => {
        const next = new Map(prev);
        next.set(profile.id, { loading: false });
        return next;
      });
      toast.error("Erreur reseau lors de l'enrichissement");
    }
  }

  // --- Bulk enrich selected profiles ---
  async function handleBulkEnrich() {
    if (selectedIds.size === 0) return;

    setIsEnrichingBulk(true);
    const selectedProfiles = profiles.filter((p) => selectedIds.has(p.id));
    let enriched = 0;

    for (const profile of selectedProfiles) {
      // Skip already enriched profiles
      const existing = enrichmentMap.get(profile.id);
      if (existing && !existing.loading && (existing.emails || existing.website)) {
        enriched++;
        continue;
      }

      await handleEnrich(profile);
      enriched++;

      // Small delay between requests
      if (enriched < selectedProfiles.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    setIsEnrichingBulk(false);
    toast.success(`Enrichissement termine : ${enriched} profil(s) traite(s)`);
  }

  // --- Send email handler ---
  function handleSendEmail(profile: LinkedInProfile, email: string) {
    setEmailRecipient({
      email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      company: profile.company,
      jobTitle: profile.jobTitle,
    });
    setEmailComposerOpen(true);
  }

  // --- Add to prospects ---
  async function handleAddToProspects(profile: LinkedInProfile) {
    try {
      const enrichment = enrichmentMap.get(profile.id);
      const bestEmail = enrichment?.emails?.[0]?.email;

      const res = await fetch("/api/prospects/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: profile.firstName,
          last_name: profile.lastName,
          company: profile.company,
          job_title: profile.jobTitle,
          linkedin_url: profile.profileUrl,
          location: profile.location,
          headline: profile.headline,
          relevance_score: profile.relevanceScore,
          industry: profile.industry,
          company_size: profile.companySize,
          email: bestEmail,
          website: enrichment?.website?.websiteUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de l'ajout du prospect");
        return;
      }

      toast.success(`${profile.fullName} ajoute aux prospects`);
    } catch {
      toast.error("Erreur lors de l'ajout du prospect");
    }
  }

  async function handleBulkAddToProspects() {
    if (selectedIds.size === 0) return;

    setIsAddingBulk(true);
    const selectedProfiles = profiles.filter((p) => selectedIds.has(p.id));

    try {
      const res = await fetch("/api/prospects/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: selectedProfiles.map((profile) => {
            const enrichment = enrichmentMap.get(profile.id);
            return {
              first_name: profile.firstName,
              last_name: profile.lastName,
              company: profile.company,
              job_title: profile.jobTitle,
              linkedin_url: profile.profileUrl,
              location: profile.location,
              headline: profile.headline,
              relevance_score: profile.relevanceScore,
              industry: profile.industry,
              company_size: profile.companySize,
              email: enrichment?.emails?.[0]?.email,
              website: enrichment?.website?.websiteUrl,
            };
          }),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de l'ajout des prospects");
        return;
      }

      toast.success(`${selectedProfiles.length} prospect(s) ajoute(s)`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Erreur lors de l'ajout des prospects");
    } finally {
      setIsAddingBulk(false);
    }
  }

  async function handleAnalyze(profile: LinkedInProfile) {
    toast.info(`Analyse du profil de ${profile.fullName} en cours...`);

    try {
      const res = await fetch("/api/ai/analyze-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === profile.id
              ? { ...p, relevanceScore: data.score || p.relevanceScore }
              : p
          )
        );
        toast.success(`Analyse terminee : score ${data.score}/100`);
      } else {
        toast.error("Erreur lors de l'analyse");
      }
    } catch {
      toast.error("Erreur lors de l'analyse");
    }
  }

  async function handleBulkAnalyze() {
    if (selectedIds.size === 0) return;

    setIsAnalyzing(true);
    toast.info(`Analyse de ${selectedIds.size} profil(s) en cours...`);

    try {
      const selectedProfiles = profiles.filter((p) => selectedIds.has(p.id));
      const res = await fetch("/api/ai/analyze-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles: selectedProfiles }),
      });

      if (res.ok) {
        toast.success("Analyse terminee");
      } else {
        toast.error("Erreur lors de l'analyse");
      }
    } catch {
      toast.error("Erreur lors de l'analyse");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleConnect(profile: LinkedInProfile) {
    try {
      toast.info(`Envoi de la demande de connexion a ${profile.fullName}...`);
      const res = await fetch("/api/linkedin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, profileUrl: profile.profileUrl }),
      });

      const data = await res.json();
      if (res.ok) {
        trackAction('connectionRequest');
        toast.success(`Demande de connexion envoyee a ${profile.fullName}`);
      } else {
        toast.error(data.error || "Erreur lors de la connexion");
      }
    } catch {
      toast.error("Erreur reseau lors de la connexion");
    }
  }

  function handleLaunchSequence() {
    if (selectedIds.size === 0) return;
    router.push(`/automation?prospects=${Array.from(selectedIds).join(",")}`);
  }

  const allSelected =
    profiles.length > 0 && selectedIds.size === profiles.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Scraper LinkedIn
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Recherchez et analysez des prospects sur LinkedIn pour identifier les
          meilleurs contacts
        </p>
      </div>

      {/* Safety Gauge */}
      <SafetyGauge />

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-5" />
            Recherche de profils
          </CardTitle>
          <CardDescription>
            Utilisez les filtres pour trouver des prospects correspondant a
            votre cible ideale
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SearchForm onSearch={handleSearch} isLoading={isSearching} />
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <>
          {/* Results toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">
                Resultats{" "}
                {profiles.length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    ({profiles.length} profils trouves)
                  </span>
                )}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-lg p-0.5">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("list")}
                >
                  <List className="size-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Select all / Bulk actions */}
          {profiles.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Tout selectionner"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selectionne(s)`
                    : "Tout selectionner"}
                </span>
              </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkEnrich}
                    disabled={isEnrichingBulk}
                  >
                    {isEnrichingBulk ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Globe className="size-3.5" />
                    )}
                    Enrichir {selectedIds.size}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkAddToProspects}
                    disabled={isAddingBulk}
                  >
                    {isAddingBulk ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="size-3.5" />
                    )}
                    Ajouter {selectedIds.size} aux prospects
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLaunchSequence}
                  >
                    <Zap className="size-3.5" />
                    Lancer sequence
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkAnalyze}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Brain className="size-3.5" />
                    )}
                    Analyser avec IA
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {isSearching && (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-0">
                    <div className="flex items-start gap-4 animate-pulse">
                      <div className="size-5 bg-slate-200 rounded mt-1" />
                      <div className="size-14 bg-slate-200 rounded-full shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="flex justify-between">
                          <div className="space-y-2">
                            <div className="h-5 w-48 bg-slate-200 rounded" />
                            <div className="h-4 w-32 bg-slate-200 rounded" />
                          </div>
                          <div className="h-6 w-16 bg-slate-200 rounded-full" />
                        </div>
                        <div className="flex gap-4">
                          <div className="h-4 w-28 bg-slate-200 rounded" />
                          <div className="h-4 w-24 bg-slate-200 rounded" />
                        </div>
                        <div className="h-4 w-full bg-slate-200 rounded" />
                        <div className="flex gap-2">
                          <div className="h-8 w-36 bg-slate-200 rounded" />
                          <div className="h-8 w-24 bg-slate-200 rounded" />
                          <div className="h-8 w-28 bg-slate-200 rounded" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No results */}
          {!isSearching && profiles.length === 0 && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center justify-center size-16 rounded-full bg-slate-100 mb-4">
                    <Search className="size-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Aucun resultat
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    Essayez de modifier vos criteres de recherche pour trouver
                    plus de profils correspondant a votre cible.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profile cards */}
          {!isSearching && profiles.length > 0 && (
            <>
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 lg:grid-cols-2 gap-4"
                    : "space-y-3"
                }
              >
                {profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    isSelected={selectedIds.has(profile.id)}
                    enrichment={enrichmentMap.get(profile.id)}
                    onToggleSelect={toggleSelect}
                    onAddToProspects={handleAddToProspects}
                    onAnalyze={handleAnalyze}
                    onConnect={handleConnect}
                    onEnrich={handleEnrich}
                    onSendEmail={handleSendEmail}
                  />
                ))}
              </div>

              {/* Load more */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => toast.info("Chargement de plus de resultats...")}
                >
                  <ChevronDown className="size-4" />
                  Charger plus de resultats
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* Empty state when no search performed */}
      {!hasSearched && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center size-20 rounded-full bg-blue-50 mb-4">
                <Search className="size-10 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">
                Trouvez vos futurs clients
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg">
                Utilisez le scraper LinkedIn pour rechercher des profils
                correspondant a votre client ideal. L&apos;IA analysera chaque
                profil et calculera un score de pertinence.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                <Badge variant="secondary">Recherche avancee</Badge>
                <Badge variant="secondary">Score IA</Badge>
                <Badge variant="secondary">Enrichissement email</Badge>
                <Badge variant="secondary">Envoi Gmail</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Composer Dialog */}
      {emailRecipient && (
        <EmailComposer
          open={emailComposerOpen}
          onClose={() => {
            setEmailComposerOpen(false);
            setEmailRecipient(null);
          }}
          recipient={emailRecipient}
        />
      )}
    </div>
  );
}
