"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Inbox,
  Search,
  Mail,
  Send,
  Loader2,
  Sparkles,
  CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/utils";

interface Thread {
  id: string;
  subject: string | null;
  status: string;
  last_message_at: string;
  message_count: number;
  prospect_id: string | null;
  campaign_id: string | null;
  email_account_id: string | null;
  prospects?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    company: string | null;
  } | null;
}

interface Message {
  id: string;
  direction: string;
  from_email: string;
  to_email: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  is_read: boolean;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Ouvert", variant: "default" },
  replied: { label: "Repondu", variant: "secondary" },
  closed: { label: "Ferme", variant: "outline" },
  snoozed: { label: "Reporte", variant: "outline" },
};

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestingResponse, setSuggestingResponse] = useState(false);
  const [suggestingMeeting, setSuggestingMeeting] = useState(false);
  const supabase = createClient();

  const loadThreads = useCallback(async () => {
    setLoading(true);
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
      .from("inbox_threads")
      .select(
        "*, prospects(first_name, last_name, email, company)"
      )
      .eq("workspace_id", profile.current_workspace_id)
      .order("last_message_at", { ascending: false });

    setThreads((data as Thread[]) || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  async function loadMessages(threadId: string) {
    const { data } = await supabase
      .from("inbox_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    setMessages((data as Message[]) || []);
  }

  function selectThread(thread: Thread) {
    setSelectedThread(thread);
    setReplyText("");
    loadMessages(thread.id);
  }

  async function handleReply() {
    if (!replyText.trim() || !selectedThread?.prospects?.email) return;
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedThread.prospects.email,
          subject: `Re: ${selectedThread.subject || ""}`,
          body: replyText.replace(/\n/g, "<br />"),
          campaignId: selectedThread.campaign_id || undefined,
          prospectId: selectedThread.prospect_id || undefined,
          threadId: selectedThread.id,
        }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de l'envoi");
        return;
      }
      toast.success("Reponse envoyee");
      setReplyText("");
      loadMessages(selectedThread.id);
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSending(false);
    }
  }

  async function handleSuggestResponse() {
    if (!selectedThread?.prospect_id) return;
    // Find the last inbound message for context
    const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
    if (!lastInbound) {
      toast.error("Aucun message entrant trouve");
      return;
    }
    setSuggestingResponse(true);
    try {
      const res = await fetch("/api/agents/value-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: selectedThread.prospect_id,
          replyText: lastInbound.body_text || lastInbound.body_html || "",
          replyAnalysis: {},
        }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de la generation");
        return;
      }
      const data = await res.json();
      const content = data.result?.content;
      const suggested = content?.full_response || content?.message || "";
      if (suggested) {
        setReplyText(suggested);
        toast.success("Reponse suggeree generee");
      } else {
        toast.error("Reponse vide de l'IA");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSuggestingResponse(false);
    }
  }

  async function handleSuggestMeeting() {
    if (!selectedThread?.prospect_id) return;
    setSuggestingMeeting(true);
    try {
      const res = await fetch("/api/agents/meeting-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: selectedThread.prospect_id,
          channel: "email",
        }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de la generation");
        return;
      }
      const data = await res.json();
      const content = data.result?.content;
      const suggested = content?.message || content?.full_response || "";
      if (suggested) {
        setReplyText(suggested);
        toast.success("Message meeting genere");
      } else {
        toast.error("Reponse vide de l'IA");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSuggestingMeeting(false);
    }
  }

  const filteredThreads = threads.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      const name =
        `${t.prospects?.first_name || ""} ${t.prospects?.last_name || ""}`.toLowerCase();
      return (
        name.includes(searchLower) ||
        (t.subject || "").toLowerCase().includes(searchLower) ||
        (t.prospects?.email || "").toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Boite de reception vide</h2>
        <p className="text-muted-foreground">
          Les reponses a vos campagnes apparaitront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem-2rem)] gap-0 -m-4 md:-m-6 lg:-m-8">
      {/* Thread list */}
      <div className="w-1/3 border-r">
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            {["all", "open", "replied", "closed"].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {s === "all"
                  ? "Tous"
                  : statusConfig[s]?.label || s}
              </Button>
            ))}
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-[calc(100%-8rem)]">
          {filteredThreads.map((thread) => (
            <div
              key={thread.id}
              className={`cursor-pointer border-b p-4 hover:bg-muted/50 ${
                selectedThread?.id === thread.id ? "bg-muted" : ""
              }`}
              onClick={() => selectThread(thread)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {thread.prospects?.first_name}{" "}
                    {thread.prospects?.last_name}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {thread.prospects?.email}
                  </p>
                </div>
                <Badge variant={statusConfig[thread.status]?.variant || "outline"}>
                  {statusConfig[thread.status]?.label || thread.status}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm">{thread.subject}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(thread.last_message_at).toLocaleDateString("fr-FR")}
                {" - "}
                {thread.message_count} message(s)
              </p>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Thread detail */}
      <div className="flex-1">
        {selectedThread ? (
          <div className="flex h-full flex-col">
            <div className="border-b p-4">
              <h2 className="font-semibold">
                {selectedThread.subject || "Sans objet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedThread.prospects?.first_name}{" "}
                {selectedThread.prospects?.last_name} -{" "}
                {selectedThread.prospects?.company}
              </p>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.direction === "outbound"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.direction === "outbound"
                          ? "bg-blue-50 text-blue-900"
                          : "bg-muted"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {msg.direction === "outbound" ? (
                          <Send className="h-3 w-3" />
                        ) : (
                          <Mail className="h-3 w-3" />
                        )}
                        {msg.from_email}
                        <span>
                          {new Date(msg.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      {msg.body_text ? (
                        <p className="whitespace-pre-wrap text-sm">
                          {msg.body_text}
                        </p>
                      ) : msg.body_html ? (
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.body_html) }}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* AI suggestion buttons */}
            {messages.length > 0 && messages[messages.length - 1]?.direction === "inbound" && (
              <div className="border-t px-3 pt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestResponse}
                  disabled={suggestingResponse || suggestingMeeting}
                >
                  {suggestingResponse ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3 w-3" />
                  )}
                  Suggerer une reponse
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestMeeting}
                  disabled={suggestingResponse || suggestingMeeting}
                >
                  {suggestingMeeting ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <CalendarCheck className="mr-2 h-3 w-3" />
                  )}
                  Message meeting
                </Button>
              </div>
            )}

            {/* Reply input */}
            <div className="border-t p-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Ecrire une reponse..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={2}
                  className="resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleReply();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={handleReply}
                  disabled={!replyText.trim() || sending}
                  className="shrink-0 self-end"
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Ctrl+Entree pour envoyer
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Mail className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-2">
                Selectionnez une conversation
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
