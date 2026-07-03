import { Skeleton } from "@/components/ui/skeleton";

export function CalendarPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      <div className="surface-elevated overflow-hidden rounded-xl">
        <div className="flex border-b border-border/60">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-border/40 p-3 last:border-r-0">
              <Skeleton className="h-4 w-8 mx-auto mb-1" />
              <Skeleton className="h-3 w-6 mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[480px]">
          {Array.from({ length: 7 }).map((_, col) => (
            <div key={col} className="border-r border-border/40 p-2 space-y-2 last:border-r-0">
              {col % 2 === 0 && <Skeleton className="h-14 w-full rounded-md" />}
              {col % 3 === 0 && <Skeleton className="h-10 w-full rounded-md" />}
              {col % 2 === 1 && <Skeleton className="h-16 w-full rounded-md" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
