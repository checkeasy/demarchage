"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Deal, PipelineStageConfig } from "@/lib/types/crm";

interface DealListViewProps {
  stages: PipelineStageConfig[];
  deals: Deal[];
}

function formatCurrency(value: number | null, currency: string) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function DealListView({ stages, deals }: DealListViewProps) {
  const router = useRouter();

  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  type SortCol = "deal" | "contact" | "stage" | "amount" | "probability" | "close_date" | "created";
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sortedDeals = useMemo(() => {
    if (!sortCol) return deals;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...deals].sort((a, b) => {
      switch (sortCol) {
        case "deal": return a.title.localeCompare(b.title) * dir;
        case "contact": {
          const na = a.prospect ? `${a.prospect.first_name || ""} ${a.prospect.last_name || ""}`.trim() : "";
          const nb = b.prospect ? `${b.prospect.first_name || ""} ${b.prospect.last_name || ""}`.trim() : "";
          return na.localeCompare(nb) * dir;
        }
        case "stage": {
          const sa = stageMap.get(a.stage_id)?.name || "";
          const sb = stageMap.get(b.stage_id)?.name || "";
          return sa.localeCompare(sb) * dir;
        }
        case "amount": return ((a.value ?? 0) - (b.value ?? 0)) * dir;
        case "probability": return (a.probability - b.probability) * dir;
        case "close_date": return (a.expected_close_date || "").localeCompare(b.expected_close_date || "") * dir;
        case "created": return a.created_at.localeCompare(b.created_at) * dir;
        default: return 0;
      }
    });
  }, [deals, sortCol, sortDir, stageMap]);

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <p>Aucun deal dans le pipeline</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {([
              { key: "deal" as SortCol, label: "Deal", className: "" },
              { key: "contact" as SortCol, label: "Contact", className: "" },
              { key: "stage" as SortCol, label: "Etape", className: "" },
              { key: "amount" as SortCol, label: "Montant", className: "text-right" },
              { key: "probability" as SortCol, label: "Probabilite", className: "hidden sm:table-cell" },
              { key: "close_date" as SortCol, label: "Cloture prevue", className: "hidden md:table-cell" },
              { key: "created" as SortCol, label: "Cree le", className: "hidden md:table-cell" },
            ]).map((col) => {
              const Icon = sortCol === col.key ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <TableHead
                  key={col.key}
                  className={`${col.className} cursor-pointer select-none hover:bg-muted/50`}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <Icon className={`size-3 ${sortCol === col.key ? "text-foreground" : "text-muted-foreground/50"}`} />
                  </span>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedDeals.map((deal) => {
            const stage = stageMap.get(deal.stage_id);
            const prospectName = deal.prospect
              ? `${deal.prospect.first_name || ""} ${deal.prospect.last_name || ""}`.trim()
              : null;

            return (
              <TableRow
                key={deal.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/deals/${deal.id}`)}
              >
                <TableCell>
                  <p className="font-medium text-sm">{deal.title}</p>
                  {deal.status !== "open" && (
                    <Badge
                      variant={deal.status === "won" ? "default" : "destructive"}
                      className="mt-0.5 text-[10px]"
                    >
                      {deal.status === "won" ? "Gagne" : "Perdu"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="text-sm truncate">{prospectName || "-"}</p>
                    {deal.prospect?.company && (
                      <p className="text-xs text-muted-foreground truncate">
                        {deal.prospect.company}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {stage ? (
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: stage.color,
                        color: stage.color,
                      }}
                    >
                      {stage.name}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right font-medium text-sm">
                  {formatCurrency(deal.value, deal.currency)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {deal.probability}%
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(deal.expected_close_date)}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(deal.created_at)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
