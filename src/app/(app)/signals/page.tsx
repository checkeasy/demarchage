export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SIGNAL_TYPES } from "@/lib/constants";
import { Signal, Flame, ArrowRight, TrendingUp } from "lucide-react";

export default async function SignalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;
  if (!workspaceId) redirect("/onboarding");

  // Fetch all active signals with prospect info
  const { data: signals } = await supabase
    .from("prospect_signals")
    .select("id, signal_type, title, description, signal_score, signal_source, detected_at, prospect_id, is_active, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("detected_at", { ascending: false })
    .limit(100);

  // Get prospect names
  const prospectIds = [...new Set((signals || []).map((s: { prospect_id: string }) => s.prospect_id))];
  const { data: prospects } = prospectIds.length > 0
    ? await supabase
        .from("prospects")
        .select("id, first_name, last_name, company, lead_score")
        .in("id", prospectIds)
    : { data: [] };

  const pMap = new Map((prospects || []).map((p: { id: string; first_name: string | null; last_name: string | null; company: string | null; lead_score: number | null }) => [p.id, p]));

  // Aggregate stats
  const signalsByType: Record<string, number> = {};
  let totalScore = 0;
  for (const s of signals || []) {
    const sig = s as { signal_type: string; signal_score: number };
    signalsByType[sig.signal_type] = (signalsByType[sig.signal_type] || 0) + 1;
    totalScore += sig.signal_score;
  }

  // Hot prospects (by total signal score)
  const prospectScores = new Map<string, { count: number; total: number }>();
  for (const s of signals || []) {
    const sig = s as { prospect_id: string; signal_score: number };
    const entry = prospectScores.get(sig.prospect_id) || { count: 0, total: 0 };
    entry.count++;
    entry.total += sig.signal_score;
    prospectScores.set(sig.prospect_id, entry);
  }
  const hotProspects = [...prospectScores.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Signal className="h-6 w-6 text-amber-500" />
          Signaux d&apos;intention
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez les signaux d&apos;achat de vos prospects pour prioriser votre outreach
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{(signals || []).length}</div>
            <p className="text-xs text-muted-foreground">Signaux actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{prospectIds.length}</div>
            <p className="text-xs text-muted-foreground">Prospects avec signaux</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{totalScore}</div>
            <p className="text-xs text-muted-foreground">Score total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">
              {hotProspects.filter(([, v]) => v.total >= 50).length}
            </div>
            <p className="text-xs text-muted-foreground">Prospects chauds (50+ pts)</p>
          </CardContent>
        </Card>
      </div>

      {/* Signal type breakdown */}
      {Object.keys(signalsByType).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Repartition par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(signalsByType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const config = SIGNAL_TYPES[type];
                  return (
                    <Badge key={type} variant="outline" className={`${config?.color || ""}`}>
                      {config?.label || type}: {count}
                    </Badge>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hot prospects */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Top prospects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hotProspects.map(([id, agg]) => {
                const p = pMap.get(id) as { first_name: string | null; last_name: string | null; company: string | null; lead_score: number | null } | undefined;
                const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "Sans nom" : "Sans nom";
                const intensity = agg.total >= 80 ? "bg-red-500" : agg.total >= 40 ? "bg-orange-500" : "bg-amber-500";
                return (
                  <Link
                    key={id}
                    href={`/prospects/${id}`}
                    className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${intensity}`} />
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{name}</span>
                        {p?.company && (
                          <span className="text-xs text-muted-foreground truncate block">{p.company}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded text-white ${intensity}`}>
                        {agg.total}pts
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
              {hotProspects.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun prospect avec signaux</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signal feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fil des signaux</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(signals || []).map((s: { id: string; signal_type: string; title: string; description: string | null; signal_score: number; detected_at: string; prospect_id: string }) => {
                const config = SIGNAL_TYPES[s.signal_type];
                const p = pMap.get(s.prospect_id) as { first_name: string | null; last_name: string | null; company: string | null } | undefined;
                const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "Sans nom" : "Sans nom";
                return (
                  <Link
                    key={s.id}
                    href={`/prospects/${s.prospect_id}`}
                    className="flex items-start gap-3 py-2 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <Badge variant="outline" className={`text-xs shrink-0 mt-0.5 ${config?.color || ""}`}>
                      {config?.label || s.signal_type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{name}</span>
                        {p?.company && (
                          <span className="text-xs text-muted-foreground">@ {p.company}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{s.title}</p>
                      {s.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{s.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-xs font-medium text-amber-600">+{s.signal_score}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.detected_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </Link>
                );
              })}
              {(signals || []).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Signal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun signal detecte</p>
                  <p className="text-xs mt-1">
                    Ajoutez des signaux d&apos;intention depuis la fiche prospect pour prioriser votre outreach
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
