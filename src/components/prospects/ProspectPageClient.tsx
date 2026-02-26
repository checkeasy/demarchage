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
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PROSPECT_STATUSES } from "@/lib/constants";
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
import { AddProspectDialog } from "@/components/prospects/AddProspectDialog";

const ITEMS_PER_PAGE = 25;

type ProspectStatus = keyof typeof PROSPECT_STATUSES;

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Client-side filtering
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
          (p.company && p.company.toLowerCase().includes(term))
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    return result;
  }, [prospects, search, statusFilter]);

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

  function getStatusBadge(status: ProspectStatus) {
    const config = PROSPECT_STATUSES[status];
    if (!config) return null;
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={`size-1.5 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <>
      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email, entreprise..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>

          {/* Status filter */}
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {(
                Object.entries(PROSPECT_STATUSES) as [
                  ProspectStatus,
                  (typeof PROSPECT_STATUSES)[ProspectStatus]
                ][]
              ).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/prospects/import">
              <Upload className="size-4" />
              Importer CSV
            </Link>
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="size-4" />
            Ajouter un prospect
          </Button>
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
      <div className="border rounded-lg bg-white">
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
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernier contact</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProspects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  {prospects.length === 0
                    ? "Aucun prospect. Ajoutez votre premier prospect ou importez un fichier CSV."
                    : "Aucun prospect ne correspond a votre recherche."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedProspects.map((prospect) => (
                <TableRow key={prospect.id}>
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
                  <TableCell className="text-muted-foreground">
                    {prospect.email}
                  </TableCell>
                  <TableCell>{prospect.company || "-"}</TableCell>
                  <TableCell>{prospect.job_title || "-"}</TableCell>
                  <TableCell>
                    {getStatusBadge(prospect.status as ProspectStatus)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(prospect.last_contacted_at)}
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
              ))
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
    </>
  );
}
