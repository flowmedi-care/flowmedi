import { AppPageHeader, type AppPageHeaderProps } from "@/components/app-page-header";
import { cn } from "@/lib/utils";

export function PageShell({
  header,
  toolbar,
  tabs,
  children,
  className,
  contentClassName,
  variant = "contained",
  /** @deprecated Use variant="split" instead */
  elevated,
}: {
  header?: AppPageHeaderProps;
  toolbar?: React.ReactNode;
  tabs?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: "contained" | "split";
  elevated?: boolean;
}) {
  const useSplit = variant === "split" || elevated === true;

  if (useSplit) {
    return (
      <div className={cn("space-y-6", className)}>
        {header && <AppPageHeader {...header} />}
        <div className={cn("surface-elevated p-4 sm:p-6", contentClassName)}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="surface-elevated overflow-hidden">
        {header && (
          <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border/60">
            <AppPageHeader {...header} variant="contained" />
          </div>
        )}

        {toolbar && (
          <div className="px-4 sm:px-6 py-3 border-b border-border/60 bg-muted/20">
            {toolbar}
          </div>
        )}

        {tabs && (
          <div className="px-4 sm:px-6 py-3 border-b border-border/60 bg-card">{tabs}</div>
        )}

        <div className={cn("px-4 sm:px-6 py-4 sm:py-5", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
