export default function Loading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-72 bg-slate-100 rounded animate-pulse mt-2" />
      </div>

      {/* View toggle bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-9 w-36 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, colIdx) => (
          <div
            key={colIdx}
            className="min-w-[280px] flex-1 rounded-lg border bg-slate-50/50 p-3 space-y-3"
          >
            {/* Column header */}
            <div className="flex items-center justify-between">
              <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-5 w-8 bg-slate-100 rounded-full animate-pulse" />
            </div>

            {/* Deal cards */}
            {Array.from({ length: colIdx === 0 ? 3 : colIdx === 1 ? 2 : 1 }).map(
              (_, cardIdx) => (
                <div key={cardIdx} className="bg-white rounded-lg border p-3 space-y-2">
                  <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                  <div className="flex items-center justify-between pt-1">
                    <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                    <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
                  </div>
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
