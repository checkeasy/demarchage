"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  UserPlus,
  Pencil,
  Ban,
  CheckCircle2,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role?: string;
}

interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  role: "super_admin" | "user";
  is_active: boolean;
  created_at: string;
  workspaces: WorkspaceInfo[];
}

export function AdminView() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createWsIds, setCreateWsIds] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editName, setEditName] = useState("");
  const [editWsIds, setEditWsIds] = useState<string[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Erreur chargement");
      const data = await res.json();
      setUsers(data.users);
      setWorkspaces(data.workspaces);
    } catch {
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Invite user
  const handleCreate = async () => {
    if (!createEmail.trim()) {
      toast.error("L'email est requis");
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail,
          full_name: createName || undefined,
          workspace_ids: createWsIds.length > 0 ? createWsIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(`Invitation envoyee a ${createEmail}`);
      setCreateOpen(false);
      setCreateEmail("");
      setCreateName("");
      setCreateWsIds([]);
      fetchUsers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'invitation"
      );
    } finally {
      setCreateLoading(false);
    }
  };

  // Edit user
  const openEdit = (user: UserData) => {
    setEditUser(user);
    setEditName(user.full_name || "");
    setEditWsIds(user.workspaces.map((w) => w.id));
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editName,
          workspace_ids: editWsIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Utilisateur mis a jour");
      setEditOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la mise a jour"
      );
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (user: UserData) => {
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(
        user.is_active ? "Utilisateur desactive" : "Utilisateur reactive"
      );
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleWsId = (
    ids: string[],
    setIds: (ids: string[]) => void,
    wsId: string
  ) => {
    setIds(
      ids.includes(wsId) ? ids.filter((id) => id !== wsId) : [...ids, wsId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total utilisateurs</CardDescription>
            <CardTitle className="text-3xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Utilisateurs actifs</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {users.filter((u) => u.is_active).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workspaces</CardDescription>
            <CardTitle className="text-3xl">{workspaces.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* User table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" />
              Utilisateurs
            </CardTitle>
            <CardDescription>
              {users.length} utilisateur{users.length > 1 ? "s" : ""}{" "}
              enregistre{users.length > 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <UserPlus className="size-4" />
            Inviter
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Workspaces</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className={!user.is_active ? "opacity-50" : ""}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {user.full_name || "—"}
                      {user.role === "super_admin" && (
                        <Shield className="size-4 text-amber-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.role === "super_admin" ? "default" : "secondary"
                      }
                      className={
                        user.role === "super_admin"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : ""
                      }
                    >
                      {user.role === "super_admin" ? "Super Admin" : "Utilisateur"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.workspaces.length > 0 ? (
                        user.workspaces.map((ws) => (
                          <Badge
                            key={ws.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {ws.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Aucun
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.is_active ? "default" : "secondary"}
                      className={
                        user.is_active
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-red-100 text-red-800 border-red-200"
                      }
                    >
                      {user.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role !== "super_admin" && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEdit(user)}
                          title="Modifier"
                          aria-label="Modifier"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleToggleActive(user)}
                          disabled={actionLoading === user.id}
                          title={
                            user.is_active ? "Desactiver" : "Reactiver"
                          }
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : user.is_active ? (
                            <Ban className="size-3.5 text-red-500" />
                          ) : (
                            <CheckCircle2 className="size-3.5 text-green-500" />
                          )}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Invite Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un utilisateur</DialogTitle>
            <DialogDescription>
              Un email d&apos;invitation sera envoye avec un lien de connexion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="utilisateur@exemple.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nom complet</Label>
              <Input
                id="invite-name"
                placeholder="Prenom Nom"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            {workspaces.length > 0 && (
              <div className="space-y-2">
                <Label>Workspaces</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-3">
                  {workspaces.map((ws) => (
                    <div key={ws.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`create-ws-${ws.id}`}
                        checked={createWsIds.includes(ws.id)}
                        onCheckedChange={() =>
                          toggleWsId(createWsIds, setCreateWsIds, ws.id)
                        }
                      />
                      <label
                        htmlFor={`create-ws-${ws.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {ws.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createLoading}
            >
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {createLoading ? "Envoi..." : "Inviter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l&apos;utilisateur</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom complet</Label>
              <Input
                id="edit-name"
                placeholder="Prenom Nom"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            {workspaces.length > 0 && (
              <div className="space-y-2">
                <Label>Workspaces</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-3">
                  {workspaces.map((ws) => {
                    const isOwner = editUser?.workspaces.some(
                      (uw) => uw.id === ws.id && uw.role === "owner"
                    );
                    return (
                      <div key={ws.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-ws-${ws.id}`}
                          checked={editWsIds.includes(ws.id)}
                          onCheckedChange={() =>
                            toggleWsId(editWsIds, setEditWsIds, ws.id)
                          }
                          disabled={isOwner}
                        />
                        <label
                          htmlFor={`edit-ws-${ws.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {ws.name}
                          {isOwner && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (owner)
                            </span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editLoading}
            >
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Pencil className="size-4" />
              )}
              {editLoading ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
