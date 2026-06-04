// FINANCEIRO FASE 1 — ITEM 1: card de métrica

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  subtitle,
  value,
  lens,
  variant = "default",
}: {
  title: string;
  subtitle?: string;
  value: string;
  lens?: string;
  variant?: "default" | "positive" | "negative" | "warning";
}) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          {lens && (
            <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground shrink-0">
              {lens}
            </span>
          )}
        </div>
        <p
          className={cn(
            "text-xl font-semibold",
            variant === "positive" && "text-green-700 dark:text-green-400",
            variant === "negative" && "text-destructive",
            variant === "warning" && "text-amber-700 dark:text-amber-400"
          )}
        >
          {value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground leading-snug">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
