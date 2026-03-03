function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-muted rounded ${className || ""}`} />;
}

export default function InboxLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 animate-pulse">
      {/* Thread list panel */}
      <div className="w-1/3 border-r">
        {/* Search + filters */}
        <div className="p-4 space-y-3">
          <Skeleton className="h-9 w-full" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="border-t" />
        {/* Thread items */}
        <div className="space-y-0 divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Message detail panel */}
      <div className="flex-1 flex flex-col">
        {/* Thread header */}
        <div className="border-b p-4 space-y-2">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
        {/* Messages */}
        <div className="flex-1 p-4 space-y-4">
          {/* Inbound message */}
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-lg p-3 bg-muted space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          {/* Outbound message */}
          <div className="flex justify-end">
            <div className="max-w-[70%] rounded-lg p-3 bg-muted/50 space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          {/* Another inbound */}
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-lg p-3 bg-muted space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
