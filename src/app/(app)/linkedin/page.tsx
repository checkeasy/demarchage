"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Linkedin,
  UserPlus,
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  SkipForward,
  Clock,
} from "lucide-react";

interface LinkedInTask {
  id: string;
  task_type: string;
  message: string | null;
  status: string;
  priority: number;
  due_at: string | null;
  created_at: string;
  prospects: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    company: string | null;
    linkedin_url: string | null;
  };
}

const taskTypeConfig: Record<
  string,
  { label: string; icon: typeof UserPlus; color: string }
> = {
  connect: {
    label: "Demande de connexion",
    icon: UserPlus,
    color: "text-blue-600",
  },
  message: {
    label: "Envoyer un message",
    icon: MessageSquare,
    color: "text-purple-600",
  },
  view_profile: {
    label: "Visiter le profil",
    icon: ExternalLink,
    color: "text-green-600",
  },
};

export default function LinkedInPage() {
  const [tasks, setTasks] = useState<LinkedInTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
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

    const { data } = await supabase
      .from("linkedin_tasks")
      .select("*, prospects(first_name, last_name, email, company, linkedin_url)")
      .eq("workspace_id", profile.current_workspace_id)
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true });

    setTasks((data as LinkedInTask[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_workspace_id")
        .eq("id", user.id)
        .single();

      if (!profile?.current_workspace_id || cancelled) return;

      const { data } = await supabase
        .from("linkedin_tasks")
        .select("*, prospects(first_name, last_name, email, company, linkedin_url)")
        .eq("workspace_id", profile.current_workspace_id)
        .order("priority", { ascending: false })
        .order("due_at", { ascending: true });

      if (!cancelled) {
        setTasks((data as LinkedInTask[]) || []);
        setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  async function markAsDone(taskId: string) {
    try {
      const response = await fetch(`/api/linkedin/tasks/${taskId}/done`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Erreur lors de la completion");
        return;
      }

      toast.success("Tache marquee comme terminee");
      loadTasks();
    } catch {
      toast.error("Erreur reseau");
    }
  }

  async function skipTask(taskId: string) {
    const supabase = createClient();
    await supabase
      .from("linkedin_tasks")
      .update({ status: "skipped" })
      .eq("id", taskId);

    toast.success("Tache passee");
    loadTasks();
  }

  function copyMessage(message: string, taskId: string) {
    navigator.clipboard.writeText(message);
    setCopiedId(taskId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Message copie dans le presse-papiers");
  }

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const skippedTasks = tasks.filter((t) => t.status === "skipped");

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Taches LinkedIn</h1>
          <p className="text-muted-foreground">
            {pendingTasks.length} tache(s) en attente
          </p>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            En attente ({pendingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Terminees ({completedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="skipped">
            Passees ({skippedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Linkedin className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Aucune tache en attente</h2>
                <p className="text-muted-foreground">
                  Les actions LinkedIn de vos campagnes apparaitront ici.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/campaigns">Voir les campagnes</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            pendingTasks.map((task) => {
              const config = taskTypeConfig[task.task_type];
              const Icon = config?.icon || Linkedin;

              return (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${
                          config?.color || ""
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">
                            {task.prospects?.first_name}{" "}
                            {task.prospects?.last_name}
                          </h3>
                          <Badge variant="outline">
                            {config?.label || task.task_type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {task.prospects?.company} -{" "}
                          {task.prospects?.email}
                        </p>

                        {task.message && (
                          <div className="mt-3 rounded-lg bg-muted p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">
                                Message a envoyer :
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  copyMessage(task.message!, task.id)
                                }
                              >
                                {copiedId === task.id ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="mt-1 text-sm whitespace-pre-wrap">
                              {task.message}
                            </p>
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-2">
                          {task.prospects?.linkedin_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  task.prospects?.linkedin_url ?? "",
                                  "_blank"
                                )
                              }
                            >
                              <ExternalLink className="mr-1 h-4 w-4" />
                              Ouvrir LinkedIn
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => markAsDone(task.id)}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Fait
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => skipTask(task.id)}
                          >
                            <SkipForward className="mr-1 h-4 w-4" />
                            Passer
                          </Button>
                        </div>
                      </div>

                      {task.due_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(task.due_at).toLocaleDateString("fr-FR")}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedTasks.map((task) => (
            <Card key={task.id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">
                      {task.prospects?.first_name} {task.prospects?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {taskTypeConfig[task.task_type]?.label} - Termine
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="skipped" className="space-y-4">
          {skippedTasks.map((task) => (
            <Card key={task.id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <SkipForward className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {task.prospects?.first_name} {task.prospects?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {taskTypeConfig[task.task_type]?.label} - Passe
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
