"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Eye, Plus, Trash2, RefreshCw, ExternalLink, Clock, Globe,
  Newspaper, ArrowRight, X, Loader2, Signal,
} from "lucide-react";

interface Watch {
  id: string;
  topic: string;
  keywords: string[];
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

interface WatchResult {
  id: string;
  watch_id: string;
  title: string;
  url: string | null;
  snippet: string | null;
  source: string;
  relevance_score: number;
  prospect_id: string | null;
  is_read: boolean;
  detected_at: string;
  web_watches?: { topic: string };
}

export function WebWatchClient() {
  const router = useRouter();
  const [watches, setWatches] = useState<Watch[]>([]);
  const [results, setResults] = useState<WatchResult[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // New watch form
  const [showForm, setShowForm] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/web-watch");
      const data = await res.json();
      setWatches(data.watches || []);
      setResults(data.results || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAddWatch() {
    if (!newTopic.trim()) return;
    setAdding(true);
    try {
      const keywords = newKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch("/api/web-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: newTopic, keywords }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur");
        return;
      }

      toast.success("Sujet de veille ajoute");
      setNewTopic("");
      setNewKeywords("");
      setShowForm(false);
      loadData();
    } catch {
      toast.error("Erreur");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteWatch(watchId: string) {
    try {
      await fetch("/api/web-watch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watch_id: watchId }),
      });
      toast.success("Sujet supprime");
      loadData();
    } catch {
      toast.error("Erreur");
    }
  }

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/web-watch/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success(
        `Scan termine: ${data.results} resultats trouves sur ${data.scanned} sujets`
      );
      loadData();
      router.refresh();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group results by date
  const resultsByDate = new Map<string, WatchResult[]>();
  for (const r of results) {
    const date = new Date(r.detected_at).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const arr = resultsByDate.get(date) || [];
    arr.push(r);
    resultsByDate.set(date, arr);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Eye className="h-6 w-6 text-indigo-500" />
            Veille Web
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Surveillance quotidienne du web sur vos sujets strategiques
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge className="bg-red-500">{unreadCount} nouveau{unreadCount > 1 ? "x" : ""}</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleScan}
            disabled={scanning || watches.length === 0}
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {scanning ? "Scan en cours..." : "Lancer le scan"}
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter un sujet
          </Button>
        </div>
      </div>

      {/* Add watch form */}
      {showForm && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardContent className="pt-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Nouveau sujet de veille</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-2">
                <Label>Sujet</Label>
                <Input
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="Ex: Location saisonniere reglementation France"
                />
              </div>
              <div className="grid gap-2">
                <Label>Mots-cles de recherche (separes par des virgules)</Label>
                <Input
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  placeholder="Ex: conciergerie levee de fonds, PMS location vacances, reglementation airbnb"
                />
                <p className="text-xs text-muted-foreground">
                  Si vide, le sujet sera utilise directement comme requete de recherche
                </p>
              </div>
              <Button onClick={handleAddWatch} disabled={adding || !newTopic.trim()}>
                {adding ? "Ajout..." : "Ajouter le sujet"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active watches */}
      {watches.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {watches.map((w) => (
            <Card key={w.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-sm truncate">{w.topic}</h4>
                    {w.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {w.keywords.slice(0, 3).map((k, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {k}
                          </Badge>
                        ))}
                        {w.keywords.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{w.keywords.length - 3}</Badge>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {w.last_run_at
                        ? `Dernier scan: ${new Date(w.last_run_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : "Jamais scanne"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteWatch(w.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {watches.length === 0 && !showForm && (
        <Card>
          <CardHeader className="text-center py-12">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mx-auto mb-3">
              <Eye className="h-8 w-8 text-indigo-500" />
            </div>
            <CardTitle>Configurez votre veille</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Ajoutez des sujets a surveiller et recevez chaque jour un recap des actualites
              pertinentes pour votre prospection.
            </CardDescription>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter votre premier sujet
            </Button>
          </CardHeader>
        </Card>
      )}

      {/* Results by date */}
      {results.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            Resultats recents
          </h3>

          {[...resultsByDate.entries()].map(([date, dayResults]) => (
            <div key={date}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 capitalize">{date}</h4>
              <div className="space-y-2">
                {dayResults.map((r) => {
                  const relevanceColor =
                    r.relevance_score >= 80
                      ? "border-l-red-500 bg-red-50/30"
                      : r.relevance_score >= 60
                      ? "border-l-orange-500 bg-orange-50/30"
                      : "border-l-blue-500 bg-blue-50/30";

                  return (
                    <div
                      key={r.id}
                      className={`border-l-4 rounded-r-lg p-3 ${relevanceColor}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs shrink-0">
                              {r.web_watches?.topic || "Veille"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs shrink-0 ${
                                r.source === "google_news"
                                  ? "border-green-300 text-green-700"
                                  : "border-blue-300 text-blue-700"
                              }`}
                            >
                              {r.source === "google_news" ? (
                                <><Newspaper className="h-3 w-3 mr-0.5" /> News</>
                              ) : (
                                <><Globe className="h-3 w-3 mr-0.5" /> Web</>
                              )}
                            </Badge>
                            <span className="text-xs font-medium text-amber-600">
                              {r.relevance_score}% pertinent
                            </span>
                          </div>
                          <h5 className="text-sm font-medium">{r.title}</h5>
                          {r.snippet && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {r.snippet}
                            </p>
                          )}
                          {r.prospect_id && (
                            <Link
                              href={`/prospects/${r.prospect_id}`}
                              className="flex items-center gap-1 text-xs text-indigo-600 mt-1.5 hover:underline"
                            >
                              <Signal className="h-3 w-3" />
                              Prospect lie — voir la fiche
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-1.5 rounded hover:bg-white/60"
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
