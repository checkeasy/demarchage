"use client";

import { useState } from "react";
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
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune campagne dans cette categorie.
          </p>
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
