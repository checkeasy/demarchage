"use client";

import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type CampaignStatus = keyof typeof CAMPAIGN_STATUSES;

interface CampaignStatusBadgeProps {
  status: CampaignStatus;
  className?: string;
}

export function CampaignStatusBadge({
  status,
  className,
}: CampaignStatusBadgeProps) {
  const config = CAMPAIGN_STATUSES[status];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", className)}
    >
      <span className={cn("size-2 rounded-full", config.color)} />
      {config.label}
    </Badge>
  );
}
