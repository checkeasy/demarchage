"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SIGNAL_TYPES } from "@/lib/constants";
import { Signal, ArrowRight, Flame } from "lucide-react";

interface SignalWithProspect {
  id: string;
  signal_type: string;
  title: string;
  signal_score: number;
  detected_at: string;
  prospect_id: string;
  prospect_name: string;
  prospect_company: string | null;
}

interface SignalsDashboardProps {
  recentSignals: SignalWithProspect[];
  hotProspects: {
    id: string;
    name: string;
    company: string | null;
    signal_count: number;
    total_score: number;
  }[];
}

export function SignalsDashboard({ recentSignals, hotProspects }: SignalsDashboardProps) {
  if (recentSignals.length === 0 && hotProspects.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Recent signals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Signal className="h-4 w-4 text-amber-500" />
            Signaux recents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSignals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun signal detecte</p>
          ) : (
            <div className="space-y-2">
              {recentSignals.slice(0, 8).map((s) => {
                const config = SIGNAL_TYPES[s.signal_type];
                return (
                  <Link
                    key={s.id}
                    href={`/prospects/${s.prospect_id}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-xs shrink-0 ${config?.color || ""}`}>
                        {config?.label || s.signal_type}
                      </Badge>
                      <span className="text-sm truncate">{s.prospect_name}</span>
                      {s.prospect_company && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          {s.prospect_company}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-amber-600">+{s.signal_score}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.detected_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hot prospects (most signals) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-red-500" />
            Prospects les plus chauds
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hotProspects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun prospect avec signaux</p>
          ) : (
            <div className="space-y-2">
              {hotProspects.slice(0, 8).map((p) => {
                const intensity = p.total_score >= 80 ? "bg-red-500" : p.total_score >= 40 ? "bg-orange-500" : "bg-amber-500";
                return (
                  <Link
                    key={p.id}
                    href={`/prospects/${p.id}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${intensity}`} />
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      {p.company && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          {p.company}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {p.signal_count} signal{p.signal_count > 1 ? "s" : ""}
                      </Badge>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded text-white ${intensity}`}>
                        {p.total_score}pts
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
