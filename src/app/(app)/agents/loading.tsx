import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-80 bg-slate-100 rounded animate-pulse mt-2" />
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-200 rounded-lg animate-pulse" />
              <div className="space-y-1 flex-1">
                <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
              <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-6 w-16 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="h-10 w-10 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Activity section */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
        <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
        <TableSkeleton rows={5} cols={4} />
      </div>
    </div>
  );
}
