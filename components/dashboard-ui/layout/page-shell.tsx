import { AppPageHeader, type AppPageHeaderProps } from "@/components/app-page-header";
import { cn } from "@/lib/utils";

export function PageShell({
  header,
  children,
  className,
  contentClassName,
  elevated = true,
}: {
  header?: AppPageHeaderProps;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  elevated?: boolean;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {header && <AppPageHeader {...header} />}
      {elevated ? (
        <div className={cn("surface-elevated p-4 sm:p-6", contentClassName)}>
          {children}
        </div>
      ) : (
        <div className={contentClassName}>{children}</div>
      )}
    </div>
  );
}
