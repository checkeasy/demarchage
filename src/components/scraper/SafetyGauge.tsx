"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  getSafetyStatus,
  resetTracker,
  type SafetyStatus,
  type CategoryStatus,
} from "@/lib/linkedin/safety-tracker";

function getStatusColor(status: SafetyStatus["overall"]): string {
  if (status === "safe") return "text-green-600";
  if (status === "warning") return "text-yellow-600";
  return "text-red-600";
}

function getStatusBg(status: SafetyStatus["overall"]): string {
  if (status === "safe") return "bg-green-50 border-green-200";
  if (status === "warning") return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

function getBarColor(status: CategoryStatus["status"]): string {
  if (status === "safe") return "bg-green-500";
  if (status === "warning") return "bg-yellow-500";
  return "bg-red-500";
}

function getBarBg(status: CategoryStatus["status"]): string {
  if (status === "safe") return "bg-green-100";
  if (status === "warning") return "bg-yellow-100";
  return "bg-red-100";
}

function ShieldIcon({ status }: { status: SafetyStatus["overall"] }) {
  const className = `size-5 ${getStatusColor(status)}`;
  if (status === "safe") return <ShieldCheck className={className} />;
  if (status === "warning") return <ShieldAlert className={className} />;
  return <ShieldAlert className={className} />;
}

function getStatusLabel(status: SafetyStatus["overall"]): string {
  if (status === "safe") return "Zone sure";
  if (status === "warning") return "Attention";
  return "Danger";
}

export function SafetyGauge() {
  const [safety, setSafety] = useState<SafetyStatus | null>(null);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(() => {
    setSafety(getSafetyStatus());
  }, []);

  useEffect(() => {
    const status = getSafetyStatus();
    setSafety(status);
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Écouter les changements de localStorage (quand une action est trackée)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "linkedin_safety_actions") {
        refresh();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  if (!safety) return null;

  const activeCategories = Object.values(safety.categories).filter(
    (c) => c.current > 0
  );

  return (
    <Card className={`border ${getStatusBg(safety.overall)} transition-colors`}>
      <CardContent className="py-3 px-4">
        {/* Header compact */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <ShieldIcon status={safety.overall} />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${getStatusColor(safety.overall)}`}>
                  {getStatusLabel(safety.overall)}
                </span>
                <span className="text-xs text-muted-foreground">
                  LinkedIn Safety Score
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Score circulaire mini */}
            <div className="relative size-10">
              <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={
                    safety.overall === "safe"
                      ? "#22c55e"
                      : safety.overall === "warning"
                      ? "#eab308"
                      : "#ef4444"
                  }
                  strokeWidth="3"
                  strokeDasharray={`${safety.overallScore}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                {safety.overallScore}
              </span>
            </div>

            {expanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Mini bars (always visible if activity) */}
        {!expanded && activeCategories.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {Object.values(safety.categories).map((cat) => (
              <div
                key={cat.label}
                className="flex-1"
                title={`${cat.label}: ${cat.current}/${cat.limit}`}
              >
                <div className={`h-1 rounded-full ${getBarBg(cat.status)}`}>
                  <div
                    className={`h-1 rounded-full transition-all ${getBarColor(cat.status)}`}
                    style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Category bars */}
            <div className="space-y-2.5">
              {Object.values(safety.categories).map((cat) => (
                <div key={cat.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700 font-medium">{cat.label}</span>
                    <span className={`font-semibold ${getStatusColor(cat.status)}`}>
                      {cat.current}/{cat.limit}
                      <span className="text-muted-foreground font-normal ml-1">
                        ({cat.period})
                      </span>
                    </span>
                  </div>
                  <div className={`h-2 rounded-full ${getBarBg(cat.status)}`}>
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${getBarColor(cat.status)}`}
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {safety.recommendations.length > 0 && (
              <div className="p-2.5 bg-white/50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <Info className="size-3" />
                  Recommandations
                </div>
                <ul className="space-y-1">
                  {safety.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="text-muted-foreground mt-0.5">-</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Limites de référence */}
            <div className="p-2.5 bg-white/50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                <Shield className="size-3" />
                Limites de securite LinkedIn
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600">
                <span>Recherches : 30/jour</span>
                <span>Connexions : 20/jour, 80/sem</span>
                <span>Vues profil : 80/jour</span>
                <span>Messages : 40/jour</span>
                <span>Enrichissements : 50/jour</span>
                <span>Delai min : 20-60s entre actions</span>
              </div>
            </div>

            {/* Reset button */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  resetTracker();
                  refresh();
                }}
              >
                <RotateCcw className="size-3" />
                Reinitialiser les compteurs
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
