"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CampaignCard } from "./CampaignCard";
import type { Campaign } from "@/lib/types/database";

interface CampaignListClientProps {
  campaigns: Campaign[];
}

const TABS = [
  { value: "all", label: "Toutes" },
  { value: "draft", label: "Brouillons" },
  { value: "active", label: "Actives" },
  { value: "paused", label: "En pause" },
  { value: "completed", label: "Terminees" },
] as const;

export function CampaignListClient({ campaigns }: CampaignListClientProps) {
  const [activeTab, setActiveTab] = useState("all");

  const filtered =
    activeTab === "all"
      ? campaigns
      : campaigns.filter((c) => c.status === activeTab);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        {TABS.map((tab) => {
          const count =
            tab.value === "all"
              ? campaigns.length
              : campaigns.filter((c) => c.status === tab.value).length;
          return (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {count > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({count})
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value={activeTab} className="mt-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Send className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-slate-900">Aucune campagne</p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "all" ? "Creez votre premiere campagne pour commencer." : "Aucune campagne dans cette categorie."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
