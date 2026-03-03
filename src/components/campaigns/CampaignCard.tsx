"use client";

import { useRouter } from "next/navigation";
import { Mail, Eye, Reply, Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CampaignStatusBadge } from "./CampaignStatusBadge";
import type { Campaign } from "@/lib/types/database";

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const router = useRouter();

  const openRate =
    campaign.total_sent > 0
      ? Math.round((campaign.total_opened / campaign.total_sent) * 100)
      : 0;
  const replyRate =
    campaign.total_sent > 0
      ? Math.round((campaign.total_replied / campaign.total_sent) * 100)
      : 0;
  const progress =
    campaign.total_prospects > 0
      ? Math.round((campaign.total_sent / campaign.total_prospects) * 100)
      : 0;

  const createdDate = new Date(campaign.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
      onClick={() => router.push(`/campaigns/${campaign.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base truncate">
              {campaign.name}
            </CardTitle>
            {campaign.description && (
              <CardDescription className="line-clamp-2">
                {campaign.description}
              </CardDescription>
            )}
          </div>
          <CampaignStatusBadge status={campaign.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="size-3.5" />
            <span className="font-medium text-foreground">
              {campaign.total_sent}
            </span>
            <span className="text-xs">envoy.</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="size-3.5" />
            <span className="font-medium text-foreground">{openRate}%</span>
            <span className="text-xs">ouvert.</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Reply className="size-3.5" />
            <span className="font-medium text-foreground">{replyRate}%</span>
            <span className="text-xs">rep.</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progression</span>
            <span>
              {campaign.total_sent} / {campaign.total_prospects} prospects
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Created date */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t">
          <Calendar className="size-3" />
          <span>Creee le {createdDate}</span>
        </div>
      </CardContent>
    </Card>
  );
}
