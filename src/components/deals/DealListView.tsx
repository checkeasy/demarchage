"use client";

import { useRouter } from "next/navigation";
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

  const stageMap = new Map(stages.map((s) => [s.id, s]));

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
            <TableHead>Deal</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Etape</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead className="hidden sm:table-cell">Probabilite</TableHead>
            <TableHead className="hidden md:table-cell">Cloture prevue</TableHead>
            <TableHead className="hidden md:table-cell">Cree le</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => {
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
