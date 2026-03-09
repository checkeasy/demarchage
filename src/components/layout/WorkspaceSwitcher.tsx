"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
  isCurrent: boolean;
}

// Generate a consistent color from workspace name
function getWorkspaceColor(name: string): string {
  const colors = [
    "bg-blue-600",
    "bg-emerald-600",
    "bg-violet-600",
    "bg-amber-600",
    "bg-rose-600",
    "bg-cyan-600",
    "bg-indigo-600",
    "bg-pink-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface WorkspaceSwitcherProps {
  collapsed: boolean;
}

export function WorkspaceSwitcher({ collapsed }: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<Workspace | null>(null);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const router = useRouter();

  const current = workspaces.find((w) => w.isCurrent);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/workspaces");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setWorkspaces(data.workspaces || []);
          setIsSuperAdmin(data.isSuperAdmin || false);
        }
      } catch {
        // silent fail on load
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function switchWorkspace(workspaceId: string) {
    if (current?.id === workspaceId) {
      setOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const res = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      if (res.ok) {
        setOpen(false);
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error("Erreur lors du changement d'environnement");
      }
    } catch {
      toast.error("Erreur lors du changement d'environnement");
    }
    setSwitching(false);
  }

  async function deleteWorkspace(ws: Workspace) {
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: ws.id }),
      });

      if (res.ok) {
        toast.success(`Environnement "${ws.name}" supprime`);
        setShowDelete(null);
        setWorkspaces((prev) => prev.filter((w) => w.id !== ws.id));
        if (ws.isCurrent) {
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    }
    setLoading(false);
  }

  async function createWorkspace() {
    if (!newName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (res.ok) {
        toast.success(`Environnement "${newName.trim()}" cree`);
        setShowCreate(false);
        setNewName("");
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la creation");
      }
    } catch {
      toast.error("Erreur lors de la creation");
    }
    setLoading(false);
  }

  const initials = current ? getInitials(current.name) : "..";
  const color = current ? getWorkspaceColor(current.name) : "bg-slate-600";

  // Collapsed: just show the icon with tooltip
  if (collapsed) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 cursor-pointer transition-opacity hover:opacity-80"
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-lg ${color} text-white text-xs font-bold`}
              >
                {initials}
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {current?.name || "Choisir un environnement"}
          </TooltipContent>
        </Tooltip>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <span className="hidden" />
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            className="w-64 p-0"
          >
            <WorkspaceList
              workspaces={workspaces}
              switching={switching}
              isSuperAdmin={isSuperAdmin}
              onSwitch={switchWorkspace}
              onCreate={() => {
                setOpen(false);
                setShowCreate(true);
              }}
              onDelete={(ws) => {
                setOpen(false);
                setShowDelete(ws);
              }}
            />
          </PopoverContent>
        </Popover>

        <CreateDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          newName={newName}
          setNewName={setNewName}
          loading={loading}
          onCreate={createWorkspace}
        />

        <DeleteDialog
          workspace={showDelete}
          onOpenChange={(open) => !open && setShowDelete(null)}
          loading={loading}
          onDelete={deleteWorkspace}
        />
      </>
    );
  }

  // Expanded: full dropdown
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-3 w-full px-4 h-16 border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-lg ${color} text-white text-xs font-bold shrink-0`}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-white truncate">
                {current?.name || "Chargement..."}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {current?.plan === "free" ? "Gratuit" : current?.plan || ""}
              </p>
            </div>
            <ChevronsUpDown className="size-4 text-slate-400 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <WorkspaceList
            workspaces={workspaces}
            switching={switching}
            isSuperAdmin={isSuperAdmin}
            onSwitch={switchWorkspace}
            onCreate={() => {
              setOpen(false);
              setShowCreate(true);
            }}
            onDelete={(ws) => {
              setOpen(false);
              setShowDelete(ws);
            }}
          />
        </PopoverContent>
      </Popover>

      <CreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        newName={newName}
        setNewName={setNewName}
        loading={loading}
        onCreate={createWorkspace}
      />

      <DeleteDialog
        workspace={showDelete}
        onOpenChange={(open) => !open && setShowDelete(null)}
        loading={loading}
        onDelete={deleteWorkspace}
      />
    </>
  );
}

// Shared workspace list component
function WorkspaceList({
  workspaces,
  switching,
  isSuperAdmin,
  onSwitch,
  onCreate,
  onDelete,
}: {
  workspaces: Workspace[];
  switching: boolean;
  isSuperAdmin: boolean;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDelete: (ws: Workspace) => void;
}) {
  return (
    <div className="py-1">
      <div className="px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          Environnements
        </p>
      </div>
      {workspaces.map((ws) => (
        <div
          key={ws.id}
          className="flex items-center gap-0 group"
        >
          <button
            onClick={() => onSwitch(ws.id)}
            disabled={switching}
            className="flex items-center gap-3 flex-1 min-w-0 px-3 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50"
          >
            <div
              className={`flex items-center justify-center w-6 h-6 rounded ${getWorkspaceColor(ws.name)} text-white text-[10px] font-bold shrink-0`}
            >
              {getInitials(ws.name)}
            </div>
            <span className="flex-1 text-left truncate">{ws.name}</span>
            {ws.isCurrent && <Check className="size-4 text-blue-500 shrink-0" />}
          </button>
          {isSuperAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(ws);
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 mr-2 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-all shrink-0"
              title="Supprimer"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      <Separator className="my-1" />
      <button
        onClick={onCreate}
        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Plus className="size-4" />
        <span>Nouvel environnement</span>
      </button>
    </div>
  );
}

// Create workspace dialog
function CreateDialog({
  open,
  onOpenChange,
  newName,
  setNewName,
  loading,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newName: string;
  setNewName: (name: string) => void;
  loading: boolean;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvel environnement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de l&apos;entreprise</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Mon Entreprise, Startup XYZ..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onCreate();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Chaque environnement a ses propres prospects, campagnes et comptes
              email.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              onClick={onCreate}
              disabled={loading || !newName.trim()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Creer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Delete workspace dialog with double confirmation
function DeleteDialog({
  workspace,
  onOpenChange,
  loading,
  onDelete,
}: {
  workspace: Workspace | null;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onDelete: (ws: Workspace) => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const expectedText = workspace?.name || "";
  const isConfirmed = confirmText === expectedText;

  return (
    <Dialog
      open={!!workspace}
      onOpenChange={(open) => {
        if (!open) setConfirmText("");
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2">
            <Trash2 className="size-5" />
            Supprimer l&apos;environnement
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
            <p className="text-sm font-medium text-red-800">
              Cette action est irreversible.
            </p>
            <p className="text-xs text-red-700">
              Toutes les donnees seront definitivement supprimees : prospects,
              campagnes, emails envoyes, deals, activites, comptes email et
              parametres.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">
              Tapez <span className="font-bold">{expectedText}</span> pour
              confirmer
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedText}
              className={
                confirmText.length > 0 && !isConfirmed
                  ? "border-red-300 focus-visible:ring-red-500"
                  : ""
              }
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmText("");
                onOpenChange(false);
              }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => workspace && onDelete(workspace)}
              disabled={loading || !isConfirmed}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer definitivement
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
