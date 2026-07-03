import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TableRowsSkeleton({
  count = 7,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border/60", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 px-1">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-2/3 max-w-xs" />
            <Skeleton className="h-3 w-1/3 max-w-[10rem]" />
          </div>
          <Skeleton className="h-4 w-20 shrink-0 hidden sm:block" />
          <Skeleton className="h-8 w-8 rounded-md shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function TablePageSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="min-w-0">
      <div className="surface-elevated overflow-hidden">
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border/60">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="px-4 sm:px-6 py-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 flex-1 min-w-[12rem] max-w-sm rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <TableRowsSkeleton count={rows} />
        </div>
      </div>
    </div>
  );
}
