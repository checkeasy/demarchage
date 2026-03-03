import { StatCardSkeleton } from "./StatCardSkeleton";
import { TableSkeleton } from "./TableSkeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
      <StatCardSkeleton count={6} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <TableSkeleton rows={5} cols={3} />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <TableSkeleton rows={5} cols={3} />
        </div>
      </div>
    </div>
  );
}
