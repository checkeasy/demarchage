import { StatCardSkeleton } from "@/components/skeletons/StatCardSkeleton";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="h-8 w-36 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-72 bg-slate-100 rounded animate-pulse mt-2" />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white border rounded-lg p-3 text-center space-y-2">
            <div className="h-8 w-12 bg-slate-200 rounded animate-pulse mx-auto" />
            <div className="h-3 w-16 bg-slate-100 rounded animate-pulse mx-auto" />
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="h-9 w-full sm:max-w-xs bg-slate-100 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-[130px] bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-[155px] bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-[135px] bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-[80px] bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex gap-2 ml-auto">
          <div className="h-9 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden bg-white">
        <TableSkeleton rows={10} cols={7} />
      </div>
    </div>
  );
}
