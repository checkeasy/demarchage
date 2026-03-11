"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  ShieldCheck,
  SlidersHorizontal,
  X,
  ChevronDown,
  Mail,
  MailX,
  Target,
  Users,
  SearchX,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/empty-state";
import { PROSPECT_STATUSES, CRM_STATUSES, PIPELINE_STAGES, COUNTRIES, SOURCE_LABELS, INDUSTRIES, EMPLOYEE_COUNTS, LEAD_SCORE_RANGES, DEPARTMENTS, BUSINESS_TYPES, SIZE_TIERS, TOURIST_ZONES, OTA_STRATEGIES, REVIEW_QUALITY } from "@/lib/constants";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AddProspectDialog } from "@/components/prospects/AddProspectDialog";
import { SmartCampaignDialog } from "@/components/campaigns/SmartCampaignDialog";

const ITEMS_PER_PAGE = 100;

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
  const searchParams = useSearchParams();
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
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [leadScoreFilter, setLeadScoreFilter] = useState<string>("all");
  const [emailQualityFilter, setEmailQualityFilter] = useState<string>("all");
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("all");
  const [sizeTierFilter, setSizeTierFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [otaFilter, setOtaFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [emailTypeFilter, setEmailTypeFilter] = useState<string>("all");
  const [contactableFilter, setContactableFilter] = useState<string>("all");
  const [websiteFilter, setWebsiteFilter] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(searchParams.get("action") === "add");
  const [smartCampaignOpen, setSmartCampaignOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      if (p.department) set.add(p.department);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [prospects]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      if (p.tags) for (const t of p.tags) {
        // Skip structured tags that have dedicated filters
        if (t.startsWith("secteur:") || t.startsWith("type:") || t.startsWith("taille:") || t.startsWith("source:")) continue;
        set.add(t);
      }
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
          (p.city && p.city.toLowerCase().includes(term)) ||
          (p.loss_reason && p.loss_reason.toLowerCase().includes(term))
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

    // Filter by department
    if (departmentFilter !== "all") {
      result = result.filter((p) => p.department === departmentFilter);
    }

    // Filter by tag
    if (tagFilter !== "all") {
      result = result.filter((p) => p.tags?.includes(tagFilter));
    }

    // Filter by business type (from tags)
    if (businessTypeFilter !== "all") {
      result = result.filter((p) => p.tags?.includes("type:" + businessTypeFilter));
    }

    // Filter by size tier (from tags)
    if (sizeTierFilter !== "all") {
      result = result.filter((p) => p.tags?.includes("taille:" + sizeTierFilter));
    }

    // Filter by zone touristique
    if (zoneFilter !== "all") {
      result = result.filter((p) => p.tags?.includes("zone:" + zoneFilter));
    }

    // Filter by OTA strategy
    if (otaFilter !== "all") {
      result = result.filter((p) => p.tags?.includes("ota_strat:" + otaFilter));
    }

    // Filter by review quality
    if (reviewFilter !== "all") {
      result = result.filter((p) => p.tags?.includes("avis:" + reviewFilter));
    }

    // Filter by email type
    if (emailTypeFilter !== "all") {
      result = result.filter((p) => p.tags?.includes("email_type:" + emailTypeFilter));
    }

    // Filter by contactable
    if (contactableFilter !== "all") {
      result = result.filter((p) => p.tags?.includes("contactable:" + contactableFilter));
    }

    // Filter by website presence
    if (websiteFilter !== "all") {
      result = result.filter((p) => p.tags?.includes("web:" + websiteFilter));
    }

    // Filter by lead score range
    if (leadScoreFilter !== "all") {
      const range = LEAD_SCORE_RANGES[leadScoreFilter as keyof typeof LEAD_SCORE_RANGES];
      if (range) {
        result = result.filter((p) =>
          p.lead_score !== null && p.lead_score !== undefined &&
          p.lead_score >= range.min && p.lead_score <= range.max
        );
      }
    }

    // Filter by email quality
    if (emailQualityFilter !== "all") {
      if (emailQualityFilter === "real") {
        result = result.filter((p) =>
          p.email &&
          !p.email.endsWith('@crm-import.local') &&
          !p.email.endsWith('@directory-import.local') &&
          !p.email.endsWith('@linkedin-prospect.local')
        );
      } else if (emailQualityFilter === "missing") {
        result = result.filter((p) =>
          !p.email ||
          p.email.endsWith('@crm-import.local') ||
          p.email.endsWith('@directory-import.local') ||
          p.email.endsWith('@linkedin-prospect.local')
        );
      } else if (emailQualityFilter === "verified_high") {
        result = result.filter((p) =>
          p.email_validity_score !== null && p.email_validity_score !== undefined &&
          p.email_validity_score >= 70
        );
      } else if (emailQualityFilter === "verified_low") {
        result = result.filter((p) =>
          p.email_validity_score !== null && p.email_validity_score !== undefined &&
          p.email_validity_score < 70 && p.email_validity_score > 0
        );
      } else if (emailQualityFilter === "not_verified") {
        result = result.filter((p) =>
          p.email &&
          !p.email.endsWith('@crm-import.local') &&
          !p.email.endsWith('@directory-import.local') &&
          !p.email.endsWith('@linkedin-prospect.local') &&
          (p.email_validity_score === null || p.email_validity_score === undefined)
        );
      }
    }

    // Sort — nulls always last regardless of direction
    const numericFields = new Set(["nb_properties", "lead_score", "email_validity_score"]);
    result = [...result].sort((a, b) => {
      const aRaw = a[sortField as keyof Prospect];
      const bRaw = b[sortField as keyof Prospect];
      const aNull = aRaw == null || aRaw === "";
      const bNull = bRaw == null || bRaw === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      let cmp: number;
      if (numericFields.has(sortField)) {
        cmp = Number(aRaw) - Number(bRaw);
      } else {
        cmp = aRaw!.toString().localeCompare(bRaw!.toString(), "fr", { sensitivity: "base" });
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [prospects, search, statusFilter, crmStatusFilter, pipelineFilter, countryFilter, sourceFilter, industryFilter, cityFilter, employeeCountFilter, departmentFilter, tagFilter, leadScoreFilter, emailQualityFilter, businessTypeFilter, sizeTierFilter, zoneFilter, otaFilter, reviewFilter, emailTypeFilter, contactableFilter, websiteFilter, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: prospects.length, active: 0, lost: 0, converted: 0, withEmail: 0 };
    for (const p of prospects) {
      const cf = (p.custom_fields || {}) as CustomFields;
      const crmStatus = cf.crm_status;
      if (crmStatus === 'lost') s.lost++;
      else if (crmStatus === 'converted') s.converted++;
      else s.active++;
      if (!cf.needs_email && p.email && !p.email.endsWith('@crm-import.local') && !p.email.endsWith('@directory-import.local')) s.withEmail++;
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

  const [isVerifying, setIsVerifying] = useState(false);

  async function handleVerifyEmails() {
    if (selectedIds.size === 0) return;
    setIsVerifying(true);
    try {
      const ids = Array.from(selectedIds);
      let totalVerified = 0;
      let totalErrors = 0;
      let lastSummary = { avg_score: 0, high_quality: 0, medium: 0, low: 0, invalid: 0 };

      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const res = await fetch("/api/prospects/verify-emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospectIds: batch }),
        });
        if (res.ok) {
          const data = await res.json();
          totalVerified += data.verified || 0;
          totalErrors += data.errors || 0;
          lastSummary = data.summary;
        } else {
          totalErrors += batch.length;
        }
      }

      toast.success(
        `${totalVerified} email(s) verifie(s) — Score moyen: ${lastSummary.avg_score}% | Fiables: ${lastSummary.high_quality} | Moyens: ${lastSummary.medium} | Faibles: ${lastSummary.low} | Invalides: ${lastSummary.invalid}`
      );
      router.refresh();
    } catch {
      toast.error("Erreur lors de la verification");
    } finally {
      setIsVerifying(false);
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

  function isPlaceholderEmail(email: string | null) {
    return !email || email.endsWith('@crm-import.local') || email.endsWith('@directory-import.local') || email.endsWith('@linkedin-prospect.local');
  }

  function SortableHeader({
    field,
    label,
    className: extraClassName,
  }: {
    field: string;
    label: string;
    className?: string;
  }) {
    const isActive = sortField === field;
    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-slate-50 ${extraClassName || ""}`}
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

  const hasActiveFilters = statusFilter !== "all" || crmStatusFilter !== "all" || pipelineFilter !== "all" || countryFilter !== "all" || sourceFilter !== "all" || industryFilter !== "all" || cityFilter !== "all" || employeeCountFilter !== "all" || departmentFilter !== "all" || tagFilter !== "all" || leadScoreFilter !== "all" || emailQualityFilter !== "all" || businessTypeFilter !== "all" || sizeTierFilter !== "all" || zoneFilter !== "all" || otaFilter !== "all" || reviewFilter !== "all" || emailTypeFilter !== "all" || contactableFilter !== "all" || websiteFilter !== "all" || search.trim() !== "";

  const advancedFilterCount = [
    departmentFilter !== "all",
    countryFilter !== "all",
    industryFilter !== "all",
    cityFilter !== "all",
    employeeCountFilter !== "all",
    tagFilter !== "all",
    leadScoreFilter !== "all",
    emailQualityFilter !== "all",
    businessTypeFilter !== "all",
    sizeTierFilter !== "all",
    zoneFilter !== "all",
    otaFilter !== "all",
    reviewFilter !== "all",
    emailTypeFilter !== "all",
    contactableFilter !== "all",
    websiteFilter !== "all",
  ].filter(Boolean).length;

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

      {/* Filters & Actions */}
      <div className="flex flex-col gap-2">
        {/* Row 1: Search + Primary Filters + Actions */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 w-full sm:min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Nom, email, entreprise, ville..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10 h-9"
            />
          </div>

          {/* Primary filters */}
          <div className="flex gap-2 flex-wrap">
            {/* CRM Status */}
            <Select
              value={crmStatusFilter}
              onValueChange={(value) => { setCrmStatusFilter(value); setPage(1); }}
            >
              <SelectTrigger className="w-full sm:w-[130px] h-9">
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

            {/* Pipeline */}
            <Select
              value={pipelineFilter}
              onValueChange={(value) => { setPipelineFilter(value); setPage(1); }}
            >
              <SelectTrigger className="w-full sm:w-[155px] h-9">
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

            {/* Source */}
            <Select
              value={sourceFilter}
              onValueChange={(value) => { setSourceFilter(value); setPage(1); }}
            >
              <SelectTrigger className="w-full sm:w-[135px] h-9">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sources</SelectItem>
                <SelectItem value="csv_import">CSV Import</SelectItem>
                <SelectItem value="crm_import">CRM Pipedrive</SelectItem>
                <SelectItem value="directory_import">Annuaire</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="google_maps">Google Maps</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>

            {/* Toggle advanced filters */}
            <Button
              variant={showAdvancedFilters ? "secondary" : "outline"}
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <SlidersHorizontal className="size-3.5" />
              Filtres
              {advancedFilterCount > 0 && (
                <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-[10px] bg-blue-100 text-blue-700">
                  {advancedFilterCount}
                </Badge>
              )}
              <ChevronDown className={`size-3.5 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`} />
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 shrink-0 ml-auto">
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link href="/prospects/import">
                <Upload className="size-4" />
                Importer
              </Link>
            </Button>
            <Button size="sm" className="h-9" onClick={() => setAddDialogOpen(true)}>
              <Plus className="size-4" />
              Ajouter
            </Button>
          </div>
        </div>

        {/* Row 2: Advanced Filters (collapsible) */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
            {/* Geographie */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1 w-full sm:w-auto">Geo</span>
              <Select
                value={countryFilter}
                onValueChange={(value) => { setCountryFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
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

              {availableDepartments.length > 0 && (
                <Select
                  value={departmentFilter}
                  onValueChange={(value) => { setDepartmentFilter(value); setPage(1); }}
                >
                  <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Departement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous departements</SelectItem>
                    {availableDepartments.map((dept) => {
                      const config = DEPARTMENTS[dept];
                      return (
                        <SelectItem key={dept} value={dept}>
                          {config?.label || dept}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}

              <Select
                value={zoneFilter}
                onValueChange={(value) => { setZoneFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes zones</SelectItem>
                  {Object.entries(TOURIST_ZONES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={cityFilter}
                onValueChange={(value) => { setCityFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
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
            </div>

            <div className="hidden lg:block w-px h-6 bg-slate-200 self-center mx-1" />

            {/* Segmentation */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1 w-full sm:w-auto">Segment</span>
              <Select
                value={industryFilter}
                onValueChange={(value) => { setIndustryFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Secteur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous secteurs</SelectItem>
                  {availableIndustries.map((ind) => {
                    const config = INDUSTRIES[ind];
                    return (
                      <SelectItem key={ind} value={ind}>
                        {config ? `${config.emoji} ${config.label}` : ind}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select
                value={businessTypeFilter}
                onValueChange={(value) => { setBusinessTypeFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[155px] h-8 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  {Object.entries(BUSINESS_TYPES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${config.color}`} />
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sizeTierFilter}
                onValueChange={(value) => { setSizeTierFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Taille" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes tailles</SelectItem>
                  {Object.entries(SIZE_TIERS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label} ({config.range})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="hidden lg:block w-px h-6 bg-slate-200 self-center mx-1" />

            {/* Qualite */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1 w-full sm:w-auto">Qualite</span>
              <Select
                value={leadScoreFilter}
                onValueChange={(value) => { setLeadScoreFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Score IA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous scores</SelectItem>
                  {Object.entries(LEAD_SCORE_RANGES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${config.color}`} />
                        {config.label} ({config.min}-{config.max})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={emailQualityFilter}
                onValueChange={(value) => { setEmailQualityFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Email" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous emails</SelectItem>
                  <SelectItem value="real">
                    <span className="flex items-center gap-1.5"><Mail className="size-3 text-green-600" /> Avec email</span>
                  </SelectItem>
                  <SelectItem value="missing">
                    <span className="flex items-center gap-1.5"><MailX className="size-3 text-orange-500" /> Sans email</span>
                  </SelectItem>
                  <SelectItem value="verified_high">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="size-3 text-green-600" /> Verifie 70%+</span>
                  </SelectItem>
                  <SelectItem value="verified_low">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="size-3 text-yellow-500" /> Verifie &lt;70%</span>
                  </SelectItem>
                  <SelectItem value="not_verified">
                    <span className="flex items-center gap-1.5"><Target className="size-3 text-slate-400" /> Non verifie</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="hidden lg:block w-px h-6 bg-slate-200 self-center mx-1" />

            {/* OTA & Avis */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1 w-full sm:w-auto">OTA</span>
              <Select
                value={otaFilter}
                onValueChange={(value) => { setOtaFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Strategie OTA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes strategies</SelectItem>
                  {Object.entries(OTA_STRATEGIES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={reviewFilter}
                onValueChange={(value) => { setReviewFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Avis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous avis</SelectItem>
                  {Object.entries(REVIEW_QUALITY).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${config.color}`} />
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="hidden lg:block w-px h-6 bg-slate-200 self-center mx-1" />

            {/* Contactabilite */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1 w-full sm:w-auto">Contact</span>
              <Select
                value={emailTypeFilter}
                onValueChange={(value) => { setEmailTypeFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Type email" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="email_pro">Email pro</SelectItem>
                  <SelectItem value="email_generique">Email generique</SelectItem>
                  <SelectItem value="sans_email">Sans email</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={contactableFilter}
                onValueChange={(value) => { setContactableFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[125px] h-8 text-xs">
                  <SelectValue placeholder="Contactable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="oui">Contactable</SelectItem>
                  <SelectItem value="non">Non contactable</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={websiteFilter}
                onValueChange={(value) => { setWebsiteFilter(value); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Site web" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="oui">Avec site</SelectItem>
                  <SelectItem value="non">Sans site</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags (only if tags exist) */}
            {availableTags.length > 0 && (
              <>
                <div className="hidden lg:block w-px h-6 bg-slate-200 self-center mx-1" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1">Tags</span>
                  <Select
                    value={tagFilter}
                    onValueChange={(value) => { setTagFilter(value); setPage(1); }}
                  >
                    <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs">
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
                </div>
              </>
            )}
          </div>
        )}

        {/* Active filter chips + Results counter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {filteredProspects.length} prospect{filteredProspects.length !== 1 ? "s" : ""}
              {hasActiveFilters && ` sur ${prospects.length}`}
            </span>

            {/* Active filter chips */}
            {crmStatusFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setCrmStatusFilter("all"); setPage(1); }}>
                {CRM_STATUSES[crmStatusFilter as keyof typeof CRM_STATUSES]?.label || crmStatusFilter}
                <X className="size-3" />
              </Badge>
            )}
            {pipelineFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setPipelineFilter("all"); setPage(1); }}>
                {PIPELINE_STAGES[pipelineFilter as keyof typeof PIPELINE_STAGES]?.label || pipelineFilter}
                <X className="size-3" />
              </Badge>
            )}
            {sourceFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setSourceFilter("all"); setPage(1); }}>
                {SOURCE_LABELS[sourceFilter as keyof typeof SOURCE_LABELS]?.label || sourceFilter}
                <X className="size-3" />
              </Badge>
            )}
            {countryFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setCountryFilter("all"); setPage(1); }}>
                {COUNTRIES[countryFilter as keyof typeof COUNTRIES]?.flag} {countryFilter}
                <X className="size-3" />
              </Badge>
            )}
            {departmentFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setDepartmentFilter("all"); setPage(1); }}>
                {DEPARTMENTS[departmentFilter]?.label || departmentFilter}
                <X className="size-3" />
              </Badge>
            )}
            {cityFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setCityFilter("all"); setPage(1); }}>
                {cityFilter}
                <X className="size-3" />
              </Badge>
            )}
            {industryFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setIndustryFilter("all"); setPage(1); }}>
                {INDUSTRIES[industryFilter]?.emoji} {INDUSTRIES[industryFilter]?.label || industryFilter}
                <X className="size-3" />
              </Badge>
            )}
            {businessTypeFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setBusinessTypeFilter("all"); setPage(1); }}>
                <span className={`size-2 rounded-full ${BUSINESS_TYPES[businessTypeFilter]?.color}`} />
                {BUSINESS_TYPES[businessTypeFilter]?.label || businessTypeFilter}
                <X className="size-3" />
              </Badge>
            )}
            {sizeTierFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setSizeTierFilter("all"); setPage(1); }}>
                {SIZE_TIERS[sizeTierFilter]?.label || sizeTierFilter}
                <X className="size-3" />
              </Badge>
            )}
            {employeeCountFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setEmployeeCountFilter("all"); setPage(1); }}>
                {employeeCountFilter} emp.
                <X className="size-3" />
              </Badge>
            )}
            {leadScoreFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setLeadScoreFilter("all"); setPage(1); }}>
                Score: {LEAD_SCORE_RANGES[leadScoreFilter as keyof typeof LEAD_SCORE_RANGES]?.label || leadScoreFilter}
                <X className="size-3" />
              </Badge>
            )}
            {emailQualityFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setEmailQualityFilter("all"); setPage(1); }}>
                Email: {emailQualityFilter === "real" ? "Avec" : emailQualityFilter === "missing" ? "Sans" : emailQualityFilter === "verified_high" ? "70%+" : emailQualityFilter === "verified_low" ? "<70%" : "Non verifie"}
                <X className="size-3" />
              </Badge>
            )}
            {zoneFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setZoneFilter("all"); setPage(1); }}>
                {TOURIST_ZONES[zoneFilter]?.label || zoneFilter}
                <X className="size-3" />
              </Badge>
            )}
            {otaFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setOtaFilter("all"); setPage(1); }}>
                {OTA_STRATEGIES[otaFilter]?.label || otaFilter}
                <X className="size-3" />
              </Badge>
            )}
            {reviewFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setReviewFilter("all"); setPage(1); }}>
                Avis: {REVIEW_QUALITY[reviewFilter]?.label || reviewFilter}
                <X className="size-3" />
              </Badge>
            )}
            {emailTypeFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setEmailTypeFilter("all"); setPage(1); }}>
                {emailTypeFilter === "email_pro" ? "Email pro" : emailTypeFilter === "email_generique" ? "Email generique" : "Sans email"}
                <X className="size-3" />
              </Badge>
            )}
            {contactableFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setContactableFilter("all"); setPage(1); }}>
                {contactableFilter === "oui" ? "Contactable" : "Non contactable"}
                <X className="size-3" />
              </Badge>
            )}
            {websiteFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setWebsiteFilter("all"); setPage(1); }}>
                {websiteFilter === "oui" ? "Avec site" : "Sans site"}
                <X className="size-3" />
              </Badge>
            )}
            {tagFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-slate-200" onClick={() => { setTagFilter("all"); setPage(1); }}>
                #{tagFilter}
                <X className="size-3" />
              </Badge>
            )}
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs shrink-0"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setCrmStatusFilter("all");
                setPipelineFilter("all");
                setCountryFilter("all");
                setSourceFilter("all");
                setIndustryFilter("all");
                setCityFilter("all");
                setDepartmentFilter("all");
                setEmployeeCountFilter("all");
                setTagFilter("all");
                setLeadScoreFilter("all");
                setEmailQualityFilter("all");
                setBusinessTypeFilter("all");
                setSizeTierFilter("all");
                setZoneFilter("all");
                setOtaFilter("all");
                setReviewFilter("all");
                setEmailTypeFilter("all");
                setContactableFilter("all");
                setWebsiteFilter("all");
                setPage(1);
              }}
            >
              <X className="size-3 mr-1" />
              Tout reinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 bg-slate-100 rounded-lg">
          <span className="text-sm font-medium w-full sm:w-auto">
            {selectedIds.size} prospect(s) selectionne(s)
            {hasActiveFilters && ` sur ${filteredProspects.length} filtres`}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={() => setSmartCampaignOpen(true)}
            >
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">Creer campagne IA</span>
              <span className="sm:hidden">Campagne</span>
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
              <span className="hidden sm:inline">{isEnriching ? "Enrichissement..." : "Enrichir avec IA"}</span>
              <span className="sm:hidden">{isEnriching ? "..." : "Enrichir"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
              onClick={handleVerifyEmails}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              <span className="hidden sm:inline">{isVerifying ? "Verification..." : "Verifier emails"}</span>
              <span className="sm:hidden">{isVerifying ? "..." : "Verifier"}</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline">Supprimer</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer {selectedIds.size} prospect(s)</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irreversible. Les prospects selectionnes et leurs donnees associees seront definitivement supprimes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleDeleteSelected}>
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Smart Campaign Dialog */}
      <SmartCampaignDialog
        open={smartCampaignOpen}
        onOpenChange={setSmartCampaignOpen}
        selectedProspects={prospects.filter((p) => selectedIds.has(p.id))}
      />

      {/* Table */}
      <div className="relative border rounded-lg bg-white">
        <p className="text-xs text-muted-foreground px-4 py-1 sm:hidden">
          Glissez pour voir plus de colonnes
        </p>
        <div className="overflow-x-auto">
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
              <SortableHeader field="company" label="Entreprise" className="hidden sm:table-cell" />
              <SortableHeader field="website" label="Site" className="hidden lg:table-cell" />
              <SortableHeader field="nb_properties" label="Biens" className="hidden xl:table-cell" />
              <SortableHeader field="country" label="Pays" className="hidden xl:table-cell" />
              <SortableHeader field="pipeline_stage" label="Pipeline" className="hidden md:table-cell" />
              <SortableHeader field="status" label="Statut" />
              <SortableHeader field="source" label="Source" className="hidden lg:table-cell" />
              <SortableHeader field="lead_score" label="Score IA" className="hidden sm:table-cell" />
              <SortableHeader field="email_validity_score" label="Fiabilité" className="hidden xl:table-cell" />
              <SortableHeader field="email" label="Email" className="hidden md:table-cell" />
              <SortableHeader field="created_at" label="Date" className="hidden xl:table-cell" />
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProspects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="p-0">
                  {prospects.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="Aucun prospect"
                      description="Ajoutez votre premier prospect manuellement ou importez un fichier CSV pour commencer."
                      action={{
                        label: "Importer des prospects",
                        href: "/prospects/import",
                      }}
                    />
                  ) : (
                    <EmptyState
                      icon={SearchX}
                      title="Aucun resultat"
                      description="Aucun prospect ne correspond a vos criteres de recherche. Essayez de modifier vos filtres."
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedProspects.map((prospect) => {
                const cf = (prospect.custom_fields || {}) as CustomFields;
                const hasLossReason = !!prospect.loss_reason;

                return (
                  <TableRow
                    key={prospect.id}
                    className={`cursor-pointer hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cf.crm_status === 'lost' ? 'bg-red-50/30' : cf.crm_status === 'converted' ? 'bg-green-50/30' : ''}`}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button, a, [role="checkbox"], input, [data-radix-collection-item]')) return;
                      router.push(`/prospects/${prospect.id}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/prospects/${prospect.id}`);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
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
                    <TableCell className="hidden sm:table-cell">
                      <span className="inline-flex items-center">
                        {prospect.organization || prospect.company || "-"}
                        {cf.enriched_from_directory && (
                          <span className="inline-flex items-center ml-1.5" title="Enrichi (annuaire)">
                            <span className="size-2 rounded-full bg-teal-500" />
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {prospect.website ? (
                        <a
                          href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline max-w-[160px] truncate"
                          title={prospect.website}
                        >
                          {prospect.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-sm tabular-nums">
                      {prospect.nb_properties ?? "-"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm">
                      {getCountryDisplay(prospect)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{getPipelineBadge(prospect)}</TableCell>
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
                    <TableCell className="hidden lg:table-cell">{getSourceBadge(prospect.source)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
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
                    <TableCell className="hidden xl:table-cell">
                      {prospect.email_validity_score !== null && prospect.email_validity_score !== undefined ? (
                        <Badge
                          variant="secondary"
                          className={`text-xs text-white ${
                            prospect.email_validity_score >= 70 ? "bg-green-500" :
                            prospect.email_validity_score >= 40 ? "bg-yellow-500" :
                            prospect.email_validity_score > 0 ? "bg-orange-500" : "bg-red-500"
                          }`}
                        >
                          {prospect.email_validity_score}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {isPlaceholderEmail(prospect.email) ? (
                        <span className="text-orange-500 text-xs italic">
                          Pas d&apos;email
                        </span>
                      ) : (
                        prospect.email
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                      {formatDate(prospect.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="size-8 p-0" aria-label="Plus d'options">
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
                            onClick={() => setDeleteConfirmId(prospect.id)}
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
        </div>

        {/* Pagination */}
        {filteredProspects.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t gap-2">
            <p className="text-sm text-muted-foreground">
              {(page - 1) * ITEMS_PER_PAGE + 1} -{" "}
              {Math.min(page * ITEMS_PER_PAGE, filteredProspects.length)} sur{" "}
              {filteredProspects.length} prospects
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Precedent"
              >
                <ChevronLeft className="size-4" />
              </Button>
              {totalPages <= 7 ? (
                Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="icon-sm"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                ))
              ) : (
                <>
                  {[1, 2].map((p) => (
                    <Button key={p} variant={p === page ? "default" : "outline"} size="icon-sm" onClick={() => setPage(p)}>{p}</Button>
                  ))}
                  {page > 4 && <span className="px-1 text-muted-foreground text-xs">...</span>}
                  {page > 3 && page < totalPages - 2 && (
                    <Button variant="default" size="icon-sm">{page}</Button>
                  )}
                  {page < totalPages - 3 && <span className="px-1 text-muted-foreground text-xs">...</span>}
                  {[totalPages - 1, totalPages].map((p) => (
                    <Button key={p} variant={p === page ? "default" : "outline"} size="icon-sm" onClick={() => setPage(p)}>{p}</Button>
                  ))}
                </>
              )}
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Suivant"
              >
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

      {/* Single Prospect Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce prospect</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. Le prospect et ses donnees associees seront definitivement supprimes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) {
                  handleDeleteOne(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
