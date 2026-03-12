"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Search, Merge, X, AlertTriangle } from "lucide-react";

interface ProspectRecord {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  organization: string | null;
  website: string | null;
  phone: string | null;
  source: string | null;
  tags: string[];
  created_at: string;
}

interface DuplicateGroup {
  id: string;
  reason: "email" | "website" | "phone" | "company";
  confidence: "high" | "medium";
  prospects: ProspectRecord[];
}

const REASON_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-800",
  phone: "bg-green-100 text-green-800",
  website: "bg-amber-100 text-amber-800",
  company: "bg-purple-100 text-purple-800",
};

const REASON_LABELS: Record<string, string> = {
  email: "Email identique",
  phone: "Telephone identique",
  website: "Site web identique",
  company: "Entreprise similaire",
};

function countFilledFields(p: ProspectRecord): number {
  let count = 0;
  if (p.email) count++;
  if (p.first_name) count++;
  if (p.last_name) count++;
  if (p.company || p.organization) count++;
  if (p.website) count++;
  if (p.phone) count++;
  if (p.source) count++;
  if (p.tags && p.tags.length > 0) count++;
  return count;
}

export default function DeduplicatePage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalAffected, setTotalAffected] = useState(0);
  const [selectedPrimary, setSelectedPrimary] = useState<
    Record<string, string>
  >({});
  const [mergingGroup, setMergingGroup] = useState<string | null>(null);

  async function handleScan() {
    setScanning(true);
    setGroups([]);
    setScanned(false);

    try {
      const res = await fetch("/api/prospects/find-duplicates", {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors du scan");
      }

      const data = await res.json();
      const fetchedGroups: DuplicateGroup[] = data.groups || [];

      setGroups(fetchedGroups);
      setTotalGroups(data.total_groups || 0);
      setTotalAffected(data.total_affected || 0);
      setScanned(true);

      // Pre-select the prospect with the most data as primary for each group
      const defaults: Record<string, string> = {};
      fetchedGroups.forEach((group) => {
        let bestId = group.prospects[0].id;
        let bestScore = countFilledFields(group.prospects[0]);

        group.prospects.forEach((p) => {
          const score = countFilledFields(p);
          if (score > bestScore) {
            bestScore = score;
            bestId = p.id;
          }
        });

        defaults[group.id] = bestId;
      });
      setSelectedPrimary(defaults);

      if (fetchedGroups.length === 0) {
        toast.success("Aucun doublon detecte !");
      } else {
        toast.info(
          `${data.total_groups} groupe(s) de doublons trouves`
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setScanning(false);
    }
  }

  async function handleMerge(group: DuplicateGroup) {
    const primaryId = selectedPrimary[group.id];
    if (!primaryId) {
      toast.error("Selectionnez un prospect principal");
      return;
    }

    const secondaryIds = group.prospects
      .filter((p) => p.id !== primaryId)
      .map((p) => p.id);

    setMergingGroup(group.id);

    try {
      const res = await fetch("/api/prospects/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId, secondaryIds }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la fusion");
      }

      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      setTotalGroups((prev) => prev - 1);
      setTotalAffected((prev) => prev - group.prospects.length);
      toast.success(
        `${secondaryIds.length} doublon(s) fusionnes avec succes`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setMergingGroup(null);
    }
  }

  function handleIgnore(groupId: string, prospectCount: number) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setTotalGroups((prev) => prev - 1);
    setTotalAffected((prev) => prev - prospectCount);
    toast.info("Groupe ignore");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Deduplication des prospects
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Detectez et fusionnez les prospects en doublon dans votre base
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanning}>
          {scanning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          {scanning ? "Scan en cours..." : "Scanner les doublons"}
        </Button>
      </div>

      {scanned && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="font-medium">
                  {totalGroups} groupe(s) de doublons trouves
                </span>
              </div>
              <span className="text-muted-foreground">
                {totalAffected} prospects concernes
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 && scanned && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun doublon restant a traiter.
            </p>
          </CardContent>
        </Card>
      )}

      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  Groupe de doublons
                </CardTitle>
                <Badge
                  variant="outline"
                  className={REASON_COLORS[group.reason]}
                >
                  {REASON_LABELS[group.reason]}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    group.confidence === "high"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }
                >
                  {group.confidence === "high"
                    ? "Confiance elevee"
                    : "Confiance moyenne"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleMerge(group)}
                  disabled={mergingGroup === group.id}
                >
                  {mergingGroup === group.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Merge className="mr-2 h-4 w-4" />
                  )}
                  Fusionner
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    handleIgnore(group.id, group.prospects.length)
                  }
                >
                  <X className="mr-1 h-4 w-4" />
                  Ignorer
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Principal</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Cree le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.prospects.map((prospect) => (
                  <TableRow key={prospect.id}>
                    <TableCell>
                      <input
                        type="radio"
                        name={`primary-${group.id}`}
                        checked={
                          selectedPrimary[group.id] === prospect.id
                        }
                        onChange={() =>
                          setSelectedPrimary((prev) => ({
                            ...prev,
                            [group.id]: prospect.id,
                          }))
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {[prospect.first_name, prospect.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </TableCell>
                    <TableCell>{prospect.email || "—"}</TableCell>
                    <TableCell>
                      {prospect.organization ||
                        prospect.company ||
                        "—"}
                    </TableCell>
                    <TableCell>
                      {prospect.source ? (
                        <Badge variant="secondary">
                          {prospect.source}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(prospect.created_at).toLocaleDateString(
                        "fr-FR"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
