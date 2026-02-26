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
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PROSPECT_STATUSES, CRM_STATUSES, PIPELINE_STAGES, COUNTRIES, SOURCE_LABELS } from "@/lib/constants";
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

const ITEMS_PER_PAGE = 25;

type ProspectStatus = keyof typeof PROSPECT_STATUSES;
type CrmStatus = keyof typeof CRM_STATUSES;
type PipelineStage = keyof typeof PIPELINE_STAGES;

interface CustomFields {
  crm_status?: string;
  pipeline_stage?: string;
  country?: string;
  organization?: string;
  nb_properties?: number;
  loss_reason?: string;
  needs_email?: boolean;
  deal_title?: string;
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
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Extract unique countries from data
  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    for (const p of prospects) {
      const cf = (p.custom_fields || {}) as CustomFields;
      if (cf.country) countries.add(cf.country);
    }
    return Array.from(countries).sort();
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
          (((p.custom_fields || {}) as CustomFields).organization &&
            ((p.custom_fields || {}) as CustomFields).organization!.toLowerCase().includes(term))
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
      result = result.filter((p) => {
        const cf = (p.custom_fields || {}) as CustomFields;
        return cf.pipeline_stage === pipelineFilter;
      });
    }

    // Filter by country
    if (countryFilter !== "all") {
      result = result.filter((p) => {
        const cf = (p.custom_fields || {}) as CustomFields;
        return cf.country === countryFilter;
      });
    }

    // Filter by source
    if (sourceFilter !== "all") {
      result = result.filter((p) => p.source === sourceFilter);
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
  }, [prospects, search, statusFilter, crmStatusFilter, pipelineFilter, countryFilter, sourceFilter, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: prospects.length, active: 0, lost: 0, converted: 0, withEmail: 0 };
    for (const p of prospects) {
      const cf = (p.custom_fields || {}) as CustomFields;
      if (cf.crm_status === 'lost') s.lost++;
      else if (cf.crm_status === 'converted') s.converted++;
      else s.active++;
      if (!cf.needs_email) s.withEmail++;
    }
    return s;
  }, [prospects]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProspects.length / ITEMS_PER_PAGE));
  const paginatedProspects = filteredProspects.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Select all on current page
  const allOnPageSelected =
    paginatedProspects.length > 0 &&
    paginatedProspects.every((p) => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allOnPageSelected) {
      const newSet = new Set(selectedIds);
      paginatedProspects.forEach((p) => newSet.delete(p.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      paginatedProspects.forEach((p) => newSet.add(p.id));
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
    const cf = (prospect.custom_fields || {}) as CustomFields;
    const stage = cf.pipeline_stage as PipelineStage;
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
    const cf = (prospect.custom_fields || {}) as CustomFields;
    const country = cf.country;
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
    return email.endsWith('@crm-import.local') || email.endsWith('@linkedin-prospect.local');
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

  const hasActiveFilters = statusFilter !== "all" || crmStatusFilter !== "all" || pipelineFilter !== "all" || countryFilter !== "all" || sourceFilter !== "all" || search.trim() !== "";

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
          </span>
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

      {/* Table */}
      <div className="border rounded-lg bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allOnPageSelected}
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
              <SortableHeader field="email" label="Email" />
              <SortableHeader field="created_at" label="Date" />
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProspects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
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
                const hasLossReason = cf.crm_status === 'lost' && cf.loss_reason;

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
                      {cf.nb_properties && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({cf.nb_properties} biens)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center">
                        {cf.organization || prospect.company || "-"}
                        {(prospect.custom_fields as any)?.enriched_from_directory && (
                          <span className="inline-flex items-center ml-1.5" title="Enrichi (annuaire)">
                            <span className="size-2 rounded-full bg-teal-500" />
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {cf.nb_properties ?? "-"}
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
                            <p className="text-xs max-w-[200px]">Raison : {cf.loss_reason}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        getCrmStatusBadge(prospect)
                      )}
                    </TableCell>
                    <TableCell>{getSourceBadge(prospect.source)}</TableCell>
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
