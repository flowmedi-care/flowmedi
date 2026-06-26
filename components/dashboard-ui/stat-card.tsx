import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendBadge } from "./trend-badge";

const iconColorMap = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-muted text-success-muted-foreground",
  warning: "bg-warning-muted text-warning-muted-foreground",
  info: "bg-info-muted text-info-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
} as const;

export type StatCardIconColor = keyof typeof iconColorMap;

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "primary",
  trend,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: StatCardIconColor;
  trend?: { value: number; label?: string };
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
            {(trend || subtitle) && (
              <div className="flex flex-wrap items-center gap-2">
                {trend && <TrendBadge value={trend.value} label={trend.label} />}
                {subtitle && (
                  <span className="text-xs text-muted-foreground">{subtitle}</span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                iconColorMap[iconColor]
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
