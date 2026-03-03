export default function Loading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-72 bg-slate-100 rounded animate-pulse mt-2" />
        </div>
        <div className="h-9 w-40 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* Campaign cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
              <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
            </div>
            <div className="h-3 w-56 bg-slate-100 rounded animate-pulse" />
            <div className="flex gap-4">
              <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
