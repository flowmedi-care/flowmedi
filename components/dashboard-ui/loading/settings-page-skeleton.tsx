import { Skeleton } from "@/components/ui/skeleton";

export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6 min-w-0 max-w-3xl">
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="surface-elevated overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border/60">
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="px-4 sm:px-6 py-5 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
