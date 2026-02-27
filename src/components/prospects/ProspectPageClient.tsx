"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Sparkles,
  Loader2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PROSPECT_STATUSES, CRM_STATUSES, PIPELINE_STAGES, COUNTRIES, SOURCE_LABELS, INDUSTRIES, EMPLOYEE_COUNTS } from "@/lib/constants";
import type { Prospect } from "@/lib/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddProspectDialog } from "@/components/prospects/AddProspectDialog";
import { SmartCampaignDialog } from "@/components/campaigns/SmartCampaignDialog";

const ITEMS_PER_PAGE = 25;

type ProspectStatus = keyof typeof PROSPECT_STATUSES;
type CrmStatus = keyof typeof CRM_STATUSES;
type PipelineStage = keyof typeof PIPELINE_STAGES;

interface CustomFields {
  crm_status?: string;
  needs_email?: boolean;
  deal_title?: string;
  enriched_from_directory?: boolean;
  [key: string]: unknown;
}

interface ProspectPageClientProps {
  prospects: Prospect[];
  workspaceId: string;
}

export function ProspectPageClient({
  prospects,
  workspaceId,
}: ProspectPageClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [crmStatusFilter, setCrmStatusFilter] = useState<string>("all");
  const [pipelineFilter, setPipelineFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [employeeCountFilter, setEmployeeCountFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [smartCampaignOpen, setSmartCampaignOpen] = useState(false);

  // Extract unique values from data for dynamic filters
  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    for (const p of prospects) {
      if (p.country) countries.add(p.country);
    }
    return Array.from(countries).sort();
  }, [prospects]);

  const availableIndustries = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      if (p.industry) set.add(p.industry);
    }
    return Array.from(set).sort();
  }, [prospects]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      if (p.city) set.add(p.city);
    }
    return Array.from(set).sort();
  }, [prospects]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      if (p.tags) for (const t of p.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [prospects]);

  // Client-side filtering + sorting
  const filteredProspects = useMemo(() => {
    let result = prospects;

    // Filter by search term
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.first_name && p.first_name.toLowerCase().includes(term)) ||
          (p.last_name && p.last_name.toLowerCase().includes(term)) ||
          p.email.toLowerCase().includes(term) ||
          (p.company && p.company.toLowerCase().includes(term)) ||
          (p.organization && p.organization.toLowerCase().includes(term)) ||
          (p.industry && p.industry.toLowerCase().includes(term)) ||
          (p.city && p.city.toLowerCase().includes(term))
      );
    }

    // Filter by DB status
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Filter by CRM status
    if (crmStatusFilter !== "all") {
      result = result.filter((p) => {
        const cf = (p.custom_fields || {}) as CustomFields;
        return cf.crm_status === crmStatusFilter;
      });
    }

    // Filter by pipeline stage
    if (pipelineFilter !== "all") {
      result = result.filter((p) => p.pipeline_stage === pipelineFilter);
    }

    // Filter by country
    if (countryFilter !== "all") {
      result = result.filter((p) => p.country === countryFilter);
    }

    // Filter by source
    if (sourceFilter !== "all") {
      result = result.filter((p) => p.source === sourceFilter);
    }

    // Filter by industry
    if (industryFilter !== "all") {
      result = result.filter((p) => p.industry === industryFilter);
    }

    // Filter by city
    if (cityFilter !== "all") {
      result = result.filter((p) => p.city === cityFilter);
    }

    // Filter by employee count
    if (employeeCountFilter !== "all") {
      result = result.filter((p) => p.employee_count === employeeCountFilter);
    }

    // Filter by tag
    if (tagFilter !== "all") {
      result = result.filter((p) => p.tags?.includes(tagFilter));
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = (a[sortField as keyof Prospect] ?? "") as string;
      const bVal = (b[sortField as keyof Prospect] ?? "") as string;
      const cmp = aVal
        .toString()
        .localeCompare(bVal.toString(), "fr", { sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [prospects, search, statusFilter, crmStatusFilter, pipelineFilter, countryFilter, sourceFilter, industryFilter, cityFilter, employeeCountFilter, tagFilter, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: prospects.length, active: 0, lost: 0, converted: 0, withEmail: 0 };
    for (const p of prospects) {
      const cf = (p.custom_fields || {}) as CustomFields;
      const crmStatus = cf.crm_status;
      if (crmStatus === 'lost') s.lost++;
      else if (crmStatus === 'converted') s.converted++;
      else s.active++;
      if (!cf.needs_email && !p.email.endsWith('@crm-import.local') && !p.email.endsWith('@directory-import.local')) s.withEmail++;
    }
    return s;
  }, [prospects]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProspects.length / ITEMS_PER_PAGE));
  const paginatedProspects = filteredProspects.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Select all filtered prospects (across all pages)
  const allFilteredSelected =
    filteredProspects.length > 0 &&
    filteredProspects.every((p) => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      // Deselect all filtered prospects
      const newSet = new Set(selectedIds);
      filteredProspects.forEach((p) => newSet.delete(p.id));
      setSelectedIds(newSet);
    } else {
      // Select ALL filtered prospects (not just current page)
      const newSet = new Set(selectedIds);
      filteredProspects.forEach((p) => newSet.add(p.id));
      setSelectedIds(newSet);
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  const [isEnriching, setIsEnriching] = useState(false);

  async function handleEnrichSelected() {
    if (selectedIds.size === 0) return;
    setIsEnriching(true);
    try {
      const ids = Array.from(selectedIds);
      let totalEnriched = 0;
      let totalErrors = 0;

      // Process in batches of 50
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const res = await fetch("/api/prospects/enrich-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospectIds: batch }),
        });
        if (res.ok) {
          const data = await res.json();
          totalEnriched += data.enriched || 0;
          totalErrors += data.errors || 0;
        } else {
          totalErrors += batch.length;
        }
      }

      toast.success(`${totalEnriched} prospect(s) enrichi(s)${totalErrors > 0 ? `, ${totalErrors} erreur(s)` : ""}`);
      router.refresh();
    } catch {
      toast.error("Erreur lors de l'enrichissement");
    } finally {
      setIsEnriching(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("prospects")
      .delete()
      .in("id", ids);

    if (error) {
      toast.error("Erreur lors de la suppression des prospects");
      return;
    }

    toast.success(`${ids.length} prospect(s) supprime(s)`);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleDeleteOne(id: string) {
    const { error } = await supabase.from("prospects").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression du prospect");
      return;
    }

    toast.success("Prospect supprime");
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    router.refresh();
  }

  function getCrmStatusBadge(prospect: Prospect) {
    const cf = (prospect.custom_fields || {}) as CustomFields;
    const crmStatus = cf.crm_status as CrmStatus;
    const config = crmStatus ? CRM_STATUSES[crmStatus] : null;

    if (!config) {
      // Fallback to DB status
      const dbConfig = PROSPECT_STATUSES[prospect.status as ProspectStatus];
      if (!dbConfig) return null;
      return (
        <Badge variant="secondary" className="gap-1.5">
          <span className={`size-1.5 rounded-full ${dbConfig.color}`} />
          {dbConfig.label}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={`size-1.5 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  }

  function getPipelineBadge(prospect: Prospect) {
    const stage = prospect.pipeline_stage as PipelineStage;
    const config = stage ? PIPELINE_STAGES[stage] : null;
    if (!config) return <span className="text-muted-foreground text-xs">-</span>;

    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <span className={`size-1.5 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  }

  function getCountryDisplay(prospect: Prospect) {
    const country = prospect.country;
    if (!country) return "-";
    const config = COUNTRIES[country as keyof typeof COUNTRIES];
    if (config) return `${config.flag} ${config.label}`;
    return country;
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getSourceBadge(source: string) {
    const sourceInfo = SOURCE_LABELS[source as keyof typeof SOURCE_LABELS];
    return (
      <Badge variant="outline" className={sourceInfo?.className || "bg-slate-100 text-slate-700 border-slate-200"}>
        {sourceInfo?.label || source}
      </Badge>
    );
  }

  function isPlaceholderEmail(email: string) {
    return email.endsWith('@crm-import.local') || email.endsWith('@directory-import.local') || email.endsWith('@linkedin-prospect.local');
  }

  function SortableHeader({
    field,
    label,
  }: {
    field: string;
    label: string;
  }) {
    const isActive = sortField === field;
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-slate-50"
        onClick={() => {
          if (isActive) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
          } else {
            setSortField(field);
            setSortDirection("asc");
          }
          setPage(1);
        }}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive ? (
            sortDirection === "asc" ? (
              <ArrowUp className="size-3.5" />
            ) : (
              <ArrowDown className="size-3.5" />
            )
          ) : (
            <ArrowUpDown className="size-3.5 opacity-30" />
          )}
        </div>
      </TableHead>
    );
  }

  const hasActiveFilters = statusFilter !== "all" || crmStatusFilter !== "all" || pipelineFilter !== "all" || countryFilter !== "all" || sourceFilter !== "all" || industryFilter !== "all" || cityFilter !== "all" || employeeCountFilter !== "all" || tagFilter !== "all" || search.trim() !== "";

  return (
    <TooltipProvider>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
          <p className="text-xs text-muted-foreground">En cours</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.lost}</p>
          <p className="text-xs text-muted-foreground">Perdus</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.converted}</p>
          <p className="text-xs text-muted-foreground">Clients</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.withEmail}</p>
          <p className="text-xs text-muted-foreground">Avec email</p>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-2 w-full sm:w-auto flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Nom, email, entreprise..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* CRM Status filter */}
            <Select
              value={crmStatusFilter}
              onValueChange={(value) => {
                setCrmStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Statut CRM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {Object.entries(CRM_STATUSES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.emoji} {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Pipeline filter */}
            <Select
              value={pipelineFilter}
              onValueChange={(value) => {
                setPipelineFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes etapes</SelectItem>
                {Object.entries(PIPELINE_STAGES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Country filter */}
            <Select
              value={countryFilter}
              onValueChange={(value) => {
                setCountryFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Pays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous pays</SelectItem>
                {availableCountries.map((country) => {
                  const config = COUNTRIES[country as keyof typeof COUNTRIES];
                  return (
                    <SelectItem key={country} value={country}>
                      {config ? `${config.flag} ${config.label}` : country}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Source filter */}
            <Select
              value={sourceFilter}
              onValueChange={(value) => {
                setSourceFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sources</SelectItem>
                <SelectItem value="csv_import">CSV Import</SelectItem>
                <SelectItem value="crm_import">CRM Pipedrive</SelectItem>
                <SelectItem value="directory_import">Annuaire Hostinfly</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="google_maps">Google Maps</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>

            {/* Industry filter */}
            <Select
              value={industryFilter}
              onValueChange={(value) => {
                setIndustryFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Secteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous secteurs</SelectItem>
                {availableIndustries.map((ind) => {
                  const config = INDUSTRIES[ind];
                  return (
                    <SelectItem key={ind} value={ind}>
                      {config?.label || ind}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* City filter */}
            <Select
              value={cityFilter}
              onValueChange={(value) => {
                setCityFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Ville" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes villes</SelectItem>
                {availableCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Employee count filter */}
            <Select
              value={employeeCountFilter}
              onValueChange={(value) => {
                setEmployeeCountFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Taille" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes tailles</SelectItem>
                {Object.entries(EMPLOYEE_COUNTS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label} emp.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tag filter */}
            {availableTags.length > 0 && (
              <Select
                value={tagFilter}
                onValueChange={(value) => {
                  setTagFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous tags</SelectItem>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <Button variant="outline" asChild>
              <Link href="/prospects/import">
                <Upload className="size-4" />
                Importer
              </Link>
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="size-4" />
              Ajouter
            </Button>
          </div>
        </div>

        {/* Results counter */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {filteredProspects.length} prospect
            {filteredProspects.length !== 1 ? "s" : ""}
            {hasActiveFilters && ` sur ${prospects.length}`}
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setCrmStatusFilter("all");
                setPipelineFilter("all");
                setCountryFilter("all");
                setSourceFilter("all");
                setIndustryFilter("all");
                setCityFilter("all");
                setEmployeeCountFilter("all");
                setTagFilter("all");
                setPage(1);
              }}
            >
              Reinitialiser les filtres
            </Button>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} prospect(s) selectionne(s)
            {hasActiveFilters && ` sur ${filteredProspects.length} filtres`}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={() => setSmartCampaignOpen(true)}
          >
            <Sparkles className="size-4" />
            Creer campagne IA
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={handleEnrichSelected}
            disabled={isEnriching}
          >
            {isEnriching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {isEnriching ? "Enrichissement..." : "Enrichir avec IA"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
          >
            <Trash2 className="size-4" />
            Supprimer
          </Button>
        </div>
      )}

      {/* Smart Campaign Dialog */}
      <SmartCampaignDialog
        open={smartCampaignOpen}
        onOpenChange={setSmartCampaignOpen}
        selectedProspects={prospects.filter((p) => selectedIds.has(p.id))}
      />

      {/* Table */}
      <div className="border rounded-lg bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Tout selectionner"
                />
              </TableHead>
              <SortableHeader field="first_name" label="Nom" />
              <SortableHeader field="company" label="Entreprise" />
              <TableHead className="text-right w-[60px]">Biens</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Score</TableHead>
              <SortableHeader field="email" label="Email" />
              <SortableHeader field="created_at" label="Date" />
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProspects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="h-32 text-center text-muted-foreground"
                >
                  {prospects.length === 0
                    ? "Aucun prospect. Ajoutez votre premier prospect ou importez un fichier CSV."
                    : "Aucun prospect ne correspond a votre recherche."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedProspects.map((prospect) => {
                const cf = (prospect.custom_fields || {}) as CustomFields;
                const hasLossReason = cf.crm_status === 'lost' && prospect.loss_reason;

                return (
                  <TableRow key={prospect.id} className={cf.crm_status === 'lost' ? 'bg-red-50/30' : cf.crm_status === 'converted' ? 'bg-green-50/30' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(prospect.id)}
                        onCheckedChange={() => toggleSelect(prospect.id)}
                        aria-label={`Selectionner ${prospect.first_name || ""} ${prospect.last_name || ""}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/prospects/${prospect.id}`}
                        className="hover:underline"
                      >
                        {[prospect.first_name, prospect.last_name]
                          .filter(Boolean)
                          .join(" ") || "-"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center">
                        {prospect.organization || prospect.company || "-"}
                        {cf.enriched_from_directory && (
                          <span className="inline-flex items-center ml-1.5" title="Enrichi (annuaire)">
                            <span className="size-2 rounded-full bg-teal-500" />
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {prospect.nb_properties ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getCountryDisplay(prospect)}
                    </TableCell>
                    <TableCell>{getPipelineBadge(prospect)}</TableCell>
                    <TableCell>
                      {hasLossReason ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              {getCrmStatusBadge(prospect)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs max-w-[200px]">Raison : {prospect.loss_reason}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        getCrmStatusBadge(prospect)
                      )}
                    </TableCell>
                    <TableCell>{getSourceBadge(prospect.source)}</TableCell>
                    <TableCell>
                      {prospect.lead_score !== null && prospect.lead_score !== undefined ? (
                        <Badge
                          variant="secondary"
                          className={`text-xs text-white ${
                            prospect.lead_score >= 80 ? "bg-red-500" :
                            prospect.lead_score >= 50 ? "bg-orange-500" :
                            prospect.lead_score >= 20 ? "bg-blue-400" : "bg-slate-400"
                          }`}
                        >
                          {prospect.lead_score}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {isPlaceholderEmail(prospect.email) ? (
                        <span className="text-orange-500 text-xs italic">
                          Pas d&apos;email
                        </span>
                      ) : (
                        prospect.email
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(prospect.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="size-8 p-0">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/prospects/${prospect.id}`}>
                              <Eye className="size-4" />
                              Voir le detail
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDeleteOne(prospect.id)}
                          >
                            <Trash2 className="size-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {filteredProspects.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              {(page - 1) * ITEMS_PER_PAGE + 1} -{" "}
              {Math.min(page * ITEMS_PER_PAGE, filteredProspects.length)} sur{" "}
              {filteredProspects.length} prospects
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="size-4" />
                Precedent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Suivant
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Prospect Dialog */}
      <AddProspectDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        workspaceId={workspaceId}
      />
    </TooltipProvider>
  );
}
