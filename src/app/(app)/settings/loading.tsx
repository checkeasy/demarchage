export default function Loading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="h-8 w-36 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-64 bg-slate-100 rounded animate-pulse mt-2" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 bg-slate-100 rounded animate-pulse" style={{ width: `${[112, 96, 80, 112, 112][i]}px` }} />
        ))}
      </div>

      {/* Settings form card */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-6">
        <div className="space-y-1">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-64 bg-slate-100 rounded animate-pulse mt-1" />
        </div>
        {/* Form fields */}
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-full bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-9 w-full bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
          <div className="h-24 w-full bg-slate-100 rounded animate-pulse" />
        </div>
        {/* Toggle rows */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-1">
            <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-6 w-10 bg-slate-200 rounded-full animate-pulse" />
        </div>
        <div className="flex items-center justify-between py-2">
          <div className="space-y-1">
            <div className="h-4 w-44 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-56 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-6 w-10 bg-slate-200 rounded-full animate-pulse" />
        </div>
        <div className="h-9 w-36 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* Email accounts card */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
        <div className="space-y-1">
          <div className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-56 bg-slate-100 rounded animate-pulse mt-1" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-slate-100 rounded-lg animate-pulse" />
              <div className="space-y-1">
                <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
              <div className="h-8 w-8 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
        <div className="h-9 w-44 bg-slate-100 rounded animate-pulse" />
      </div>
    </div>
  );
}
