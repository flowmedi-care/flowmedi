import { cn } from "@/lib/utils";

/** Labeled control zone for period / status / professional filters — sentence-case, never uppercase. */
export function FilterControlZone({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
