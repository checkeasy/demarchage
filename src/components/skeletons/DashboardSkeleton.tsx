import { StatCardSkeleton } from "./StatCardSkeleton";
import { TableSkeleton } from "./TableSkeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-72 bg-slate-100 rounded animate-pulse mt-2" />
      </div>

      {/* Quick Actions row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-white rounded-lg border border-slate-100 animate-pulse" />
        ))}
      </div>

      {/* KPI Cards row */}
      <StatCardSkeleton count={4} />

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="lg:col-span-2 md:col-span-2 bg-white rounded-xl border border-slate-100 p-6 space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-48 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="md:col-span-1 bg-white rounded-xl border border-slate-100 p-6 space-y-4">
          <div className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activities + Top Prospects row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-slate-200 animate-pulse" />
              <div className="w-8 h-8 rounded-md bg-slate-100 animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
              </div>
              <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
              </div>
              <div className="h-3 w-8 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Email Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-6 bg-white rounded-xl border border-slate-100 space-y-3">
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
            <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Recent Deals + Campaign Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-100 p-6 space-y-4">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          <TableSkeleton rows={5} cols={5} />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 bg-white rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse" />
                <div className="space-y-1">
                  <div className="h-7 w-10 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
