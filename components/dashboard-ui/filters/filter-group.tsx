import { cn } from "@/lib/utils";

export function FilterGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-wrap items-center gap-2 min-w-0",
        className
      )}
    >
      {children}
    </div>
  );
}
