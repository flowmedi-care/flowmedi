import * as React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
  }
>(({ className, variant = "default", ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
      variant === "default" && "bg-primary text-primary-foreground",
      variant === "secondary" && "bg-secondary text-secondary-foreground",
      variant === "outline" && "border border-input bg-background",
      variant === "success" && "bg-green-600 text-white",
      variant === "warning" && "bg-amber-500 text-white",
      variant === "destructive" && "bg-red-600 text-white",
      className
    )}
    {...props}
  />
));
Badge.displayName = "Badge";

export { Badge };
