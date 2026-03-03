"use client";

import dynamic from "next/dynamic";

const DealsWonLostChart = dynamic(
  () =>
    import("@/components/dashboard/DealsWonLostChart").then(
      (mod) => mod.DealsWonLostChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse bg-muted rounded-lg" />
    ),
  }
);

interface DealsWonLostChartLazyProps {
  data: { month: string; won: number; lost: number }[];
}

export function DealsWonLostChartLazy({ data }: DealsWonLostChartLazyProps) {
  return <DealsWonLostChart data={data} />;
}
