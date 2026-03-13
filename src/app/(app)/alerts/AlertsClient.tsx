"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Building2,
  UserPlus,
  XCircle,
  Filter,
  RefreshCw,
  AlertTriangle,
  Calendar,
  MapPin,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BusinessAlert {
  id: string;
  alert_type: string;
  company_name: string;
  siren: string | null;
  city: string | null;
  naf_code: string | null;
  source: string;
  data: Record<string, unknown>;
  is_processed: boolean;
  prospect_id: string | null;
  detected_at: string;
  created_at: string;
}

const ALERT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  new_company: { label: "Nouvelle entreprise", color: "bg-green-100 text-green-700" },
  funding: { label: "Levee de fonds", color: "bg-blue-100 text-blue-700" },
  hiring: { label: "Recrutement", color: "bg-purple-100 text-purple-700" },
};

const SOURCE_LABELS: Record<string, string> = {
  bodacc: "BODACC",
  sirene: "SIRENE/INSEE",
  web_watch: "Veille Web",
};

export function AlertsClient() {
  const [alerts, setAlerts] = useState<BusinessAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [converting, setConverting] = useState<string | null>(null);
  const supabase = createClient();

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("business_alerts")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(200);

    if (filter === "unprocessed") {
      query = query.eq("is_processed", false);
    } else if (filter !== "all") {
      query = query.eq("alert_type", filter);
    }

    const { data } = await query;
    setAlerts((data as BusinessAlert[]) || []);
    setLoading(false);
  }, [supabase, filter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const convertToProspect = async (alert: BusinessAlert) => {
    setConverting(alert.id);
    try {
      // Create prospect via API
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: alert.company_name,
          city: alert.city || undefined,
          source: "api",
        }),
      });

      if (!res.ok) throw new Error("Failed to create prospect");

      const { prospect } = await res.json();

      // Update alert as processed
      await supabase
        .from("business_alerts")
        .update({ is_processed: true, prospect_id: prospect.id })
        .eq("id", alert.id);

      toast.success(`Prospect "${alert.company_name}" cree`);
      fetchAlerts();
    } catch {
      toast.error("Erreur lors de la conversion");
    } finally {
      setConverting(null);
    }
  };

  const ignoreAlert = async (alertId: string) => {
    await supabase
      .from("business_alerts")
      .update({ is_processed: true })
      .eq("id", alertId);

    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    toast.success("Alerte ignoree");
  };

  const unprocessedCount = alerts.filter((a) => !a.is_processed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alertes Business</h1>
          <p className="text-muted-foreground text-sm">
            Nouvelles entreprises detectees via BODACC, SIRENE et la veille web
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAlerts}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Rafraichir
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{alerts.length}</div>
            <div className="text-sm text-muted-foreground">Total alertes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">{unprocessedCount}</div>
            <div className="text-sm text-muted-foreground">A traiter</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {alerts.filter((a) => a.prospect_id).length}
            </div>
            <div className="text-sm text-muted-foreground">Convertis en prospects</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les alertes</SelectItem>
            <SelectItem value="unprocessed">Non traitees</SelectItem>
            <SelectItem value="new_company">Nouvelles entreprises</SelectItem>
            <SelectItem value="funding">Levees de fonds</SelectItem>
            <SelectItem value="hiring">Recrutements</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Aucune alerte trouvee</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const typeConfig = ALERT_TYPE_LABELS[alert.alert_type] || {
              label: alert.alert_type,
              color: "bg-gray-100 text-gray-700",
            };

            return (
              <Card key={alert.id} className={alert.is_processed ? "opacity-60" : ""}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {alert.company_name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {alert.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {alert.city}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(alert.detected_at).toLocaleDateString("fr-FR")}
                          </span>
                          {alert.siren && <span>SIREN: {alert.siren}</span>}
                          {alert.naf_code && <span>NAF: {alert.naf_code}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={typeConfig.color}>
                        {typeConfig.label}
                      </Badge>
                      <Badge variant="outline">
                        {SOURCE_LABELS[alert.source] || alert.source}
                      </Badge>

                      {!alert.is_processed && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => convertToProspect(alert)}
                            disabled={converting === alert.id}
                          >
                            <UserPlus className="h-3 w-3 mr-1" />
                            {converting === alert.id ? "..." : "Convertir"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => ignoreAlert(alert.id)}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {alert.prospect_id && (
                        <Badge className="bg-green-100 text-green-700">Converti</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
