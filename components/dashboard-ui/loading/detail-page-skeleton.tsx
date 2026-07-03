import { Skeleton } from "@/components/ui/skeleton";

export function DetailPageSkeleton() {
  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="surface-elevated overflow-hidden">
        <div className="px-4 sm:px-6 py-6 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-28 rounded-md shrink-0" />
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 border-b border-border/60 flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
