import { Skeleton } from "@/components/ui/skeleton";
import { TableRowsSkeleton } from "./table-page-skeleton";

export function PageShellSkeleton({ withTable = true }: { withTable?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="surface-elevated overflow-hidden">
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border/60">
          <Skeleton className="h-7 w-44 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="px-4 sm:px-6 py-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md ml-auto" />
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-5">
          {withTable ? (
            <TableRowsSkeleton count={6} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
