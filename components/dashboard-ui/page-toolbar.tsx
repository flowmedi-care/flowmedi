import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

export function PageToolbar({
  className,
  children,
  filters,
}: {
  className?: string;
  children?: React.ReactNode;
  filters?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function PeriodSelect<T extends string>({
  value,
  onChange,
  options,
  label = "Período",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 w-auto min-w-[120px]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
