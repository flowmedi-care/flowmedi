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
        "flex flex-1 flex-wrap items-start gap-x-8 gap-y-3 min-w-0",
        className
      )}
    >
      {children}
    </div>
  );
}
