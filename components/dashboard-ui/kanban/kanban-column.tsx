import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function KanbanColumnShell({
  title,
  count,
  accentClassName,
  headerExtra,
  children,
  className,
  bodyRef,
}: {
  title: string;
  count: number;
  accentClassName?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      className={cn(
        "flex flex-col w-[260px] sm:w-[280px] shrink-0 surface-elevated overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {accentClassName && (
            <span className={cn("h-2 w-2 rounded-full shrink-0", accentClassName)} />
          )}
          <h3 className="text-sm font-semibold truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          <Badge variant="secondary">{count}</Badge>
        </div>
      </div>
      <div
        ref={bodyRef}
        className="flex-1 min-h-[200px] sm:min-h-[240px] bg-muted/20 p-3 space-y-2"
      >
        {children}
      </div>
    </div>
  );
}
