"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Loader2,
  Building2,
  Globe,
  MapPin,
  Users,
  Pencil,
  Check,
  XIcon,
  Unlink,
  Plus,
  Search,
  Factory,
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
}

interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  status: string | null;
  last_contacted_at: string | null;
  organization_id: string | null;
}

export default function OrganizationDetailPage() {
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    website: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  // Link prospect modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<Prospect[]>([]);
  const [searchingLink, setSearchingLink] = useState(false);

  const fetchData = useCallback(async () => {
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

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .eq("workspace_id", profile.current_workspace_id)
        .single();

      if (orgError || !orgData) {
        toast.error("Organisation introuvable");
        return;
      }

      setOrg(orgData);
      setEditForm({
        name: orgData.name || "",
        website: orgData.website || "",
        description: orgData.description || "",
      });

      const { data: prospectData } = await supabase
        .from("prospects")
        .select(
          "id, first_name, last_name, email, job_title, status, last_contacted_at, organization_id"
        )
        .eq("organization_id", orgId)
        .order("last_name");

      setProspects(prospectData || []);
    } catch {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSaveEdit() {
    if (!editForm.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          website: editForm.website.trim() || null,
          description: editForm.description.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }

      const data = await res.json();
      setOrg(data.organization);
      setEditing(false);
      toast.success("Organisation mise a jour");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink(prospectId: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("prospects")
        .update({ organization_id: null })
        .eq("id", prospectId);

      if (error) throw error;

      setProspects((prev) => prev.filter((p) => p.id !== prospectId));
      toast.success("Contact delie de l'organisation");
    } catch {
      toast.error("Erreur lors du deliement");
    }
  }

  async function handleSearchProspects() {
    if (!linkSearch.trim()) return;

    setSearchingLink(true);
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

      const sanitized = linkSearch.replace(/[%,.*()]/g, '');
      const { data } = await supabase
        .from("prospects")
        .select(
          "id, first_name, last_name, email, job_title, status, last_contacted_at, organization_id"
        )
        .eq("workspace_id", profile.current_workspace_id)
        .is("organization_id", null)
        .or(
          `first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`
        )
        .limit(10);

      setLinkResults(data || []);
    } catch {
      toast.error("Erreur lors de la recherche");
    } finally {
      setSearchingLink(false);
    }
  }

  async function handleLinkProspect(prospectId: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("prospects")
        .update({ organization_id: orgId })
        .eq("id", prospectId);

      if (error) throw error;

      const linked = linkResults.find((p) => p.id === prospectId);
      if (linked) {
        setProspects((prev) => [...prev, { ...linked, organization_id: orgId }]);
        setLinkResults((prev) => prev.filter((p) => p.id !== prospectId));
      }
      toast.success("Contact lie a l'organisation");
    } catch {
      toast.error("Erreur lors de la liaison");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Organisation introuvable
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-3">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              {editing ? (
                <div className="space-y-2">
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Nom de l'organisation"
                    className="font-bold text-lg"
                  />
                  <Input
                    value={editForm.website}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, website: e.target.value }))
                    }
                    placeholder="Site web"
                  />
                  <Input
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Description"
                  />
                </div>
              ) : (
                <div>
                  <CardTitle className="text-xl">{org.name}</CardTitle>
                  {org.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {org.description}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-4 w-4" />
                    )}
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setEditForm({
                        name: org.name || "",
                        website: org.website || "",
                        description: org.description || "",
                      });
                    }}
                  >
                    <XIcon className="mr-1 h-4 w-4" />
                    Annuler
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  Modifier
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            {org.website && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <a
                  href={
                    org.website.startsWith("http")
                      ? org.website
                      : `https://${org.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {org.domain || org.website}
                </a>
              </span>
            )}
            {org.industry && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Factory className="h-4 w-4" />
                {org.industry}
              </span>
            )}
            {org.city && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {org.city}
                {org.country ? `, ${org.country}` : ""}
              </span>
            )}
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              {prospects.length} contact(s)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Contacts</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowLinkModal(!showLinkModal);
                setLinkSearch("");
                setLinkResults([]);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Ajouter un contact
            </Button>
          </div>
        </CardHeader>

        {showLinkModal && (
          <CardContent className="border-b pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un prospect a lier..."
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearchProspects();
                  }}
                  className="pl-10"
                />
              </div>
              <Button
                size="sm"
                onClick={handleSearchProspects}
                disabled={searchingLink}
              >
                {searchingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Chercher"
                )}
              </Button>
            </div>
            {linkResults.length > 0 && (
              <div className="space-y-1">
                {linkResults.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {[p.first_name, p.last_name]
                          .filter(Boolean)
                          .join(" ") || "Sans nom"}
                      </span>
                      {p.email && (
                        <span className="text-muted-foreground ml-2">
                          {p.email}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleLinkProspect(p.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {linkResults.length === 0 && linkSearch && !searchingLink && (
              <p className="text-sm text-muted-foreground">
                Aucun prospect non-lie trouve.
              </p>
            )}
          </CardContent>
        )}

        <CardContent className="p-0">
          {prospects.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Aucun contact lie a cette organisation.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Poste</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernier contact</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/prospects/${p.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {[p.first_name, p.last_name]
                          .filter(Boolean)
                          .join(" ") || "Sans nom"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.email || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.job_title || "—"}
                    </TableCell>
                    <TableCell>
                      {p.status ? (
                        <Badge variant="secondary">{p.status}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.last_contacted_at
                        ? new Date(p.last_contacted_at).toLocaleDateString(
                            "fr-FR"
                          )
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleUnlink(p.id)}
                        title="Delier le contact"
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
