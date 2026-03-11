"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  List,
  UserPlus,
  Loader2,
  Globe,
  MapPin,
  Download,
  Search,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

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

import {
  MapsSearchForm,
  type MapsSearchFilters,
} from "@/components/maps-scraper/MapsSearchForm";
import {
  BusinessCard,
  type BusinessEnrichmentData,
} from "@/components/maps-scraper/BusinessCard";
import { EmailComposer } from "@/components/email/EmailComposer";
import type { GoogleMapsBusinessResult } from "@/lib/scraper/google-maps-scraper";

export default function MapsScraperPage() {
  const searchParams = useSearchParams();
  const [businesses, setBusinesses] = useState<GoogleMapsBusinessResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [hasSearched, setHasSearched] = useState(false);
  const [isEnrichingBulk, setIsEnrichingBulk] = useState(false);
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [missions, setMissions] = useState<Array<{ id: string; name: string; search_keywords: string[]; language: string }>>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(searchParams.get("mission_id"));

  // Fetch missions on mount
  useEffect(() => {
    fetch("/api/missions")
      .then(r => r.json())
      .then(data => {
        if (data.missions) setMissions(data.missions);
      })
      .catch(() => {});
  }, []);

  // Enrichment data per business
  const [enrichmentMap, setEnrichmentMap] = useState<
    Map<string, BusinessEnrichmentData>
  >(new Map());

  // Email composer state
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    company: string;
    jobTitle: string;
  } | null>(null);

  // ── Search ──
  const handleSearch = useCallback(async (filters: MapsSearchFilters) => {
    setIsSearching(true);
    setHasSearched(true);
    setSelectedIds(new Set());
    setEnrichmentMap(new Map());

    try {
      const res = await fetch("/api/scraper/search-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setBusinesses(data.data.businesses || []);
        const count = (data.data.businesses || []).length;
        if (count === 0) {
          toast.info(
            "Aucun resultat trouve. Essayez d'elargir votre recherche."
          );
        } else {
          toast.success(`${count} entreprise(s) trouvee(s)`);
        }
      } else {
        toast.error(data.error || "Erreur lors de la recherche");
        setBusinesses([]);
      }
    } catch {
      toast.error("Erreur reseau. Verifiez votre connexion.");
      setBusinesses([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // ── Toggle selection ──
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === businesses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(businesses.map((b) => b.placeId)));
    }
  }

  // ── Enrich single business ──
  async function handleEnrich(business: GoogleMapsBusinessResult) {
    if (!business.website) {
      toast.warning(`Pas de site web pour ${business.businessName}`);
      return;
    }

    setEnrichmentMap((prev) => {
      const next = new Map(prev);
      next.set(business.placeId, { loading: true });
      return next;
    });

    try {
      const res = await fetch("/api/scraper/enrich-maps-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setEnrichmentMap((prev) => {
          const next = new Map(prev);
          next.set(business.placeId, {
            emails: data.data.emails || [],
            ownerFirstName: data.data.ownerFirstName,
            ownerLastName: data.data.ownerLastName,
            ownerRole: data.data.ownerRole,
            loading: false,
          });
          return next;
        });

        const emailCount = data.data.emails?.length || 0;
        const ownerFound = data.data.ownerFirstName || data.data.ownerLastName;
        if (emailCount > 0 && ownerFound) {
          toast.success(
            `${emailCount} email(s) + dirigeant trouve pour ${business.businessName}`
          );
        } else if (emailCount > 0) {
          toast.success(
            `${emailCount} email(s) trouve(s) pour ${business.businessName}`
          );
        } else if (ownerFound) {
          toast.info(
            `Dirigeant trouve mais pas d'email pour ${business.businessName}`
          );
        } else {
          toast.warning(
            `Aucune donnee trouvee pour ${business.businessName}`
          );
        }
      } else {
        setEnrichmentMap((prev) => {
          const next = new Map(prev);
          next.set(business.placeId, { loading: false });
          return next;
        });
        toast.error(
          data.error ||
            `Enrichissement echoue pour ${business.businessName}`
        );
      }
    } catch {
      setEnrichmentMap((prev) => {
        const next = new Map(prev);
        next.set(business.placeId, { loading: false });
        return next;
      });
      toast.error("Erreur reseau lors de l'enrichissement");
    }
  }

  // ── Bulk enrich ──
  async function handleBulkEnrich() {
    if (selectedIds.size === 0) return;

    setIsEnrichingBulk(true);
    const selected = businesses.filter((b) => selectedIds.has(b.placeId));
    let enriched = 0;

    for (const business of selected) {
      const existing = enrichmentMap.get(business.placeId);
      if (
        existing &&
        !existing.loading &&
        (existing.emails || existing.ownerFirstName)
      ) {
        enriched++;
        continue;
      }

      if (!business.website) {
        enriched++;
        continue;
      }

      await handleEnrich(business);
      enriched++;

      if (enriched < selected.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    setIsEnrichingBulk(false);
    toast.success(`Enrichissement termine : ${enriched} entreprise(s) traitee(s)`);
  }

  // ── Send email ──
  function handleSendEmail(
    business: GoogleMapsBusinessResult,
    email: string
  ) {
    const enrichment = enrichmentMap.get(business.placeId);
    setEmailRecipient({
      email,
      firstName: enrichment?.ownerFirstName || "",
      lastName: enrichment?.ownerLastName || "",
      company: business.businessName,
      jobTitle: enrichment?.ownerRole || "Gerant",
    });
    setEmailComposerOpen(true);
  }

  // ── Add to prospects ──
  async function handleAddToProspects(business: GoogleMapsBusinessResult) {
    try {
      const enrichment = enrichmentMap.get(business.placeId);
      const bestEmail = enrichment?.emails?.[0]?.email;

      const res = await fetch("/api/scraper/add-maps-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: bestEmail || "",
          businessName: business.businessName,
          ownerFirstName: enrichment?.ownerFirstName || null,
          ownerLastName: enrichment?.ownerLastName || null,
          ownerRole: enrichment?.ownerRole || null,
          phone: business.phone,
          website: business.website,
          address: business.address,
          googleMapsUrl: business.googleMapsUrl,
          rating: business.rating,
          reviewCount: business.reviewCount,
          category: business.category,
          ...(selectedMissionId ? { mission_id: selectedMissionId } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de l'ajout");
        return;
      }

      toast.success(`${business.businessName} ajoute aux prospects`);
    } catch {
      toast.error("Erreur lors de l'ajout du prospect");
    }
  }

  async function handleBulkAddToProspects() {
    if (selectedIds.size === 0) return;

    setIsAddingBulk(true);
    const selected = businesses.filter((b) => selectedIds.has(b.placeId));

    try {
      const res = await fetch("/api/scraper/add-maps-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: selected.map((business) => {
            const enrichment = enrichmentMap.get(business.placeId);
            return {
              email: enrichment?.emails?.[0]?.email || "",
              businessName: business.businessName,
              ownerFirstName: enrichment?.ownerFirstName || null,
              ownerLastName: enrichment?.ownerLastName || null,
              ownerRole: enrichment?.ownerRole || null,
              phone: business.phone,
              website: business.website,
              address: business.address,
              googleMapsUrl: business.googleMapsUrl,
              rating: business.rating,
              reviewCount: business.reviewCount,
              category: business.category,
            };
          }),
          mission_id: selectedMissionId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de l'ajout");
        return;
      }

      toast.success(`${selected.length} prospect(s) ajoute(s)`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Erreur lors de l'ajout des prospects");
    } finally {
      setIsAddingBulk(false);
    }
  }

  // ── Export CSV ──
  function handleExportCSV() {
    const selected = businesses.filter((b) => selectedIds.has(b.placeId));
    if (selected.length === 0) {
      toast.warning("Selectionnez au moins une entreprise");
      return;
    }

    const csvData = selected.map((b) => {
      const enrichment = enrichmentMap.get(b.placeId);
      const ownerName =
        enrichment?.ownerFirstName || enrichment?.ownerLastName
          ? `${enrichment?.ownerFirstName || ""} ${enrichment?.ownerLastName || ""}`.trim()
          : "";

      return {
        "Nom entreprise": b.businessName,
        Adresse: b.address || "",
        Telephone: b.phone || "",
        "Site web": b.website || "",
        Email: enrichment?.emails?.[0]?.email || "",
        Dirigeant: ownerName,
        Role: enrichment?.ownerRole || "",
        "Note Google": b.rating || "",
        Avis: b.reviewCount || "",
        Categorie: b.category || "",
        "Lien Google Maps": b.googleMapsUrl || "",
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `google-maps-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`${selected.length} entreprise(s) exportee(s) en CSV`);
  }

  const allSelected =
    businesses.length > 0 && selectedIds.size === businesses.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Scraper Google Maps
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Recherchez des entreprises locales sur Google Maps et enrichissez
          automatiquement avec emails et nom du dirigeant
        </p>
      </div>

      {/* Mission Selector */}
      {missions.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Target className="size-4 text-indigo-500" />
                Mission active
              </div>
              <select
                className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm bg-white"
                value={selectedMissionId || ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setSelectedMissionId(val);
                }}
              >
                <option value="">Aucune mission</option>
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.language.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-5 text-green-600" />
            Recherche d&apos;entreprises
          </CardTitle>
          <CardDescription>
            Entrez un type d&apos;entreprise et une localisation pour trouver
            des prospects sur Google Maps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MapsSearchForm onSearch={handleSearch} isLoading={isSearching} />
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
                {businesses.length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    ({businesses.length} entreprises trouvees)
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
          {businesses.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Tout selectionner"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selectionnee(s)`
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
                    onClick={handleExportCSV}
                  >
                    <Download className="size-3.5" />
                    Exporter CSV
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
                      <div className="size-14 bg-slate-200 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="flex justify-between">
                          <div className="space-y-2">
                            <div className="h-5 w-48 bg-slate-200 rounded" />
                            <div className="h-4 w-32 bg-slate-200 rounded" />
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="h-4 w-40 bg-slate-200 rounded" />
                          <div className="h-4 w-28 bg-slate-200 rounded" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-8 w-24 bg-slate-200 rounded" />
                          <div className="h-8 w-28 bg-slate-200 rounded" />
                          <div className="h-8 w-24 bg-slate-200 rounded" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No results */}
          {!isSearching && businesses.length === 0 && (
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
                    Essayez de modifier votre recherche. Assurez-vous que le type
                    d&apos;entreprise et la localisation sont corrects.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Business cards */}
          {!isSearching && businesses.length > 0 && (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 lg:grid-cols-2 gap-4"
                  : "space-y-3"
              }
            >
              {businesses.map((business) => (
                <BusinessCard
                  key={business.placeId}
                  business={business}
                  isSelected={selectedIds.has(business.placeId)}
                  enrichment={enrichmentMap.get(business.placeId)}
                  onToggleSelect={toggleSelect}
                  onEnrich={handleEnrich}
                  onAddToProspects={handleAddToProspects}
                  onSendEmail={handleSendEmail}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!hasSearched && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center size-20 rounded-full bg-green-50 mb-4">
                <MapPin className="size-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">
                Trouvez des entreprises locales
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg">
                Recherchez des entreprises sur Google Maps par type et
                localisation. Enrichissez automatiquement avec emails et noms
                des dirigeants.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                <Badge variant="secondary">Google Maps</Badge>
                <Badge variant="secondary">Emails automatiques</Badge>
                <Badge variant="secondary">Nom du dirigeant</Badge>
                <Badge variant="secondary">Export CSV</Badge>
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
