"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Loader2,
  Building2,
  Search,
  RefreshCw,
  Globe,
  MapPin,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  description: string | null;
  workspace_id: string;
  created_at: string;
  contact_count?: number;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [relinking, setRelinking] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_workspace_id")
        .eq("id", user.id)
        .single();

      if (!profile?.current_workspace_id) return;

      const workspaceId = profile.current_workspace_id;

      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name");

      if (error) {
        toast.error("Erreur lors du chargement des organisations");
        return;
      }

      // Count contacts per organization
      const { data: contactCounts } = await supabase
        .from("prospects")
        .select("organization_id")
        .eq("workspace_id", workspaceId)
        .not("organization_id", "is", null);

      const countMap: Record<string, number> = {};
      if (contactCounts) {
        contactCounts.forEach((row: { organization_id: string }) => {
          const orgId = row.organization_id;
          countMap[orgId] = (countMap[orgId] || 0) + 1;
        });
      }

      const orgsWithCounts = (orgs || []).map((org) => ({
        ...org,
        contact_count: countMap[org.id] || 0,
      }));

      setOrganizations(orgsWithCounts);
    } catch {
      toast.error("Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  async function handleRelink() {
    setRelinking(true);
    try {
      const res = await fetch("/api/organizations/autolink", {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors du re-scan");
      }

      const data = await res.json();
      toast.success(`${data.linked} prospect(s) lies a des organisations`);
      await fetchOrganizations();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setRelinking(false);
    }
  }

  const filtered = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Organisations</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerez les entreprises associees a vos prospects
          </p>
        </div>
        <Button onClick={handleRelink} disabled={relinking} variant="outline">
          {relinking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Re-scanner
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une organisation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery
                ? "Aucune organisation ne correspond a votre recherche."
                : "Aucune organisation trouvee. Lancez le re-scan pour lier automatiquement vos prospects."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Site web</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Industrie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <Link
                        href={`/organizations/${org.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {org.website ? (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          {org.domain || org.website}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {org.city ? (
                        <span className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {org.city}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {org.contact_count || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {org.industry || "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
