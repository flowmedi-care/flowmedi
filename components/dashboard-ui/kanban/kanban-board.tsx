import { cn } from "@/lib/utils";

export function KanbanBoard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-4 overflow-x-auto pb-2 min-w-0 -mx-1 px-1", className)}>
      {children}
    </div>
  );
}
