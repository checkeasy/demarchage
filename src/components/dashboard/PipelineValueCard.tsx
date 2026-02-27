"use client";

import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PipelineValueCardProps {
  value: number;
  dealsCount: number;
}

export function PipelineValueCard({ value, dealsCount }: PipelineValueCardProps) {
  const formattedValue = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <Card>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Pipeline
            </p>
            <p className="text-2xl font-bold">{formattedValue}</p>
            <p className="text-xs text-muted-foreground">
              {dealsCount} deal{dealsCount !== 1 ? "s" : ""} en cours
            </p>
          </div>
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50">
            <TrendingUp className="size-5 text-blue-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
