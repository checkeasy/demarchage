import { Card, CardContent } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-muted rounded ${className || ""}`} />;
}

export default function DealsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>

      {/* View toggle bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, colIdx) => (
          <div
            key={colIdx}
            className="min-w-[280px] flex-1 rounded-lg border bg-muted/30 p-3 space-y-3"
          >
            {/* Column header */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>

            {/* Deal cards */}
            {Array.from({ length: colIdx === 0 ? 3 : colIdx === 1 ? 2 : 1 }).map(
              (_, cardIdx) => (
                <Card key={cardIdx}>
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-24" />
                    <div className="flex items-center justify-between pt-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
