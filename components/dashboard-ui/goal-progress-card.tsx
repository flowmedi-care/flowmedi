import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type GoalItem = {
  label: string;
  current: number;
  target: number;
  formattedCurrent?: string;
  formattedTarget?: string;
  color?: "primary" | "success" | "warning" | "info";
};

const indicatorColors = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
};

export function GoalProgressCard({
  title,
  subtitle,
  goals,
  className,
}: {
  title: string;
  subtitle?: string;
  goals: GoalItem[];
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-5">
        {goals.map((goal) => {
          const pct = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
          const color = goal.color ?? "primary";
          return (
            <div key={goal.label} className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{goal.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {goal.formattedCurrent ?? goal.current}
                  {goal.formattedTarget != null || goal.target != null
                    ? ` / ${goal.formattedTarget ?? goal.target}`
                    : ""}
                  <span className="ml-1.5 font-medium text-foreground">
                    {Math.round(pct)}%
                  </span>
                </span>
              </div>
              <Progress
                value={pct}
                max={100}
                indicatorClassName={indicatorColors[color]}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
