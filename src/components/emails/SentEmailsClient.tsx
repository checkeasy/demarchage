"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { sanitizeHtml } from "@/lib/utils";
import {
  Mail,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  MousePointerClick,
  MessageSquare,
  AlertTriangle,
  Send,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SentEmail {
  id: string;
  from_email: string;
  to_email: string;
  subject: string | null;
  body_html: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  error_message: string | null;
  created_at: string;
  prospect_name: string | null;
  prospect_company: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Mail }
> = {
  queued: { label: "En attente", variant: "outline", icon: Clock },
  sending: { label: "Envoi...", variant: "outline", icon: Send },
  sent: { label: "Envoye", variant: "secondary", icon: Send },
  delivered: { label: "Livre", variant: "default", icon: CheckCircle2 },
  opened: { label: "Ouvert", variant: "default", icon: Eye },
  clicked: { label: "Clique", variant: "default", icon: MousePointerClick },
  replied: { label: "Repondu", variant: "default", icon: MessageSquare },
  bounced: { label: "Bounce", variant: "destructive", icon: XCircle },
  failed: { label: "Echec", variant: "destructive", icon: AlertTriangle },
  complained: { label: "Spam", variant: "destructive", icon: AlertTriangle },
};

const ITEMS_PER_PAGE = 25;

interface SentEmailsClientProps {
  emails: SentEmail[];
}

export function SentEmailsClient({ emails }: SentEmailsClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [previewEmail, setPreviewEmail] = useState<SentEmail | null>(null);

  const filtered = useMemo(() => {
    let result = emails;

    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          (e.to_email || "").toLowerCase().includes(q) ||
          (e.subject || "").toLowerCase().includes(q) ||
          (e.prospect_name || "").toLowerCase().includes(q) ||
          (e.prospect_company || "").toLowerCase().includes(q) ||
          (e.campaign_name || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [emails, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Mail className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Aucun email envoye</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Les emails envoyes depuis vos campagnes apparaitront ici.
          Commencez par creer une campagne et lancer un envoi.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par email, objet, nom, campagne..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="sent">Envoye</SelectItem>
            <SelectItem value="delivered">Livre</SelectItem>
            <SelectItem value="opened">Ouvert</SelectItem>
            <SelectItem value="clicked">Clique</SelectItem>
            <SelectItem value="replied">Repondu</SelectItem>
            <SelectItem value="bounced">Bounce</SelectItem>
            <SelectItem value="failed">Echec</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats summary */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{filtered.length} email(s)</span>
        <span>-</span>
        <span>{emails.filter((e) => e.status === "delivered").length} livres</span>
        <span>-</span>
        <span>{emails.filter((e) => e.status === "opened").length} ouverts</span>
        <span>-</span>
        <span>{emails.filter((e) => e.status === "replied").length} repondus</span>
        <span>-</span>
        <span>{emails.filter((e) => e.status === "bounced" || e.status === "failed").length} echecs</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinataire</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead className="hidden md:table-cell">Campagne</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((email) => {
              const config = STATUS_CONFIG[email.status] || STATUS_CONFIG.sent;
              const StatusIcon = config.icon;

              return (
                <TableRow key={email.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {email.prospect_name || email.to_email}
                      </p>
                      {email.prospect_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {email.to_email}
                        </p>
                      )}
                      {email.prospect_company && (
                        <p className="text-xs text-muted-foreground truncate">
                          {email.prospect_company}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm truncate max-w-[200px]">
                      {email.subject || "(sans objet)"}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {email.campaign_id ? (
                      <Link
                        href={`/campaigns/${email.campaign_id}`}
                        className="text-sm text-blue-600 hover:underline truncate max-w-[150px] block"
                      >
                        {email.campaign_name || "Campagne"}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {email.campaign_name || "-"}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={config.variant} className="gap-1 text-xs">
                      <StatusIcon className="size-3" />
                      {config.label}
                    </Badge>
                    {email.error_message && (
                      <p className="text-[10px] text-red-500 mt-0.5 truncate max-w-[120px]">
                        {email.error_message}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(email.sent_at || email.created_at)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewEmail(email)}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * ITEMS_PER_PAGE + 1} -{" "}
            {Math.min(page * ITEMS_PER_PAGE, filtered.length)} sur{" "}
            {filtered.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Precedent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Email preview dialog */}
      <Dialog
        open={!!previewEmail}
        onOpenChange={(open) => !open && setPreviewEmail(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {previewEmail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  {previewEmail.subject || "(sans objet)"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">De : </span>
                    {previewEmail.from_email}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">A : </span>
                    {previewEmail.to_email}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Campagne : </span>
                    {previewEmail.campaign_id ? (
                      <Link
                        href={`/campaigns/${previewEmail.campaign_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {previewEmail.campaign_name || "Campagne"}
                      </Link>
                    ) : (
                      previewEmail.campaign_name || "-"
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Statut : </span>
                    {STATUS_CONFIG[previewEmail.status]?.label || previewEmail.status}
                  </div>
                </div>

                {/* Timeline */}
                <div className="flex flex-wrap gap-3 text-xs border rounded-lg p-3 bg-muted/30">
                  {previewEmail.sent_at && (
                    <div>
                      <span className="text-muted-foreground">Envoye : </span>
                      {formatDate(previewEmail.sent_at)}
                    </div>
                  )}
                  {previewEmail.delivered_at && (
                    <div>
                      <span className="text-muted-foreground">Livre : </span>
                      {formatDate(previewEmail.delivered_at)}
                    </div>
                  )}
                  {previewEmail.opened_at && (
                    <div>
                      <span className="text-muted-foreground">Ouvert : </span>
                      {formatDate(previewEmail.opened_at)}
                    </div>
                  )}
                  {previewEmail.clicked_at && (
                    <div>
                      <span className="text-muted-foreground">Clique : </span>
                      {formatDate(previewEmail.clicked_at)}
                    </div>
                  )}
                  {previewEmail.replied_at && (
                    <div>
                      <span className="text-muted-foreground">Repondu : </span>
                      {formatDate(previewEmail.replied_at)}
                    </div>
                  )}
                  {previewEmail.bounced_at && (
                    <div className="text-red-500">
                      <span>Bounce : </span>
                      {formatDate(previewEmail.bounced_at)}
                    </div>
                  )}
                </div>

                {previewEmail.error_message && (
                  <div className="text-sm text-red-500 bg-red-50 rounded-lg p-3">
                    {previewEmail.error_message}
                  </div>
                )}

                {/* Email body */}
                <div className="border rounded-lg p-4 bg-white">
                  {previewEmail.body_html ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(previewEmail.body_html),
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground italic">
                      Aucun contenu disponible
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
