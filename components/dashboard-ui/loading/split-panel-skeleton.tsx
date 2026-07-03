import { Skeleton } from "@/components/ui/skeleton";

export function SplitPanelSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[32rem] -m-4 sm:-m-6 border border-border rounded-xl overflow-hidden bg-card">
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-md" />
            <Skeleton className="h-8 flex-1 rounded-md" />
            <Skeleton className="h-8 flex-1 rounded-md" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-2 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={i % 2 === 0 ? "flex justify-start" : "flex justify-end"}
            >
              <Skeleton
                className={`h-12 rounded-2xl ${i % 2 === 0 ? "w-2/3 max-w-sm" : "w-1/2 max-w-xs"}`}
              />
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
