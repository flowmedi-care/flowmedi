import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type AppPageBreadcrumb = { label: string; href?: string };

export type AppPageHeaderProps = {
  breadcrumbs: AppPageBreadcrumb[];
  backHref?: string;
  onBack?: () => void;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  variant?: "default" | "contained";
};

function BreadcrumbPill({ breadcrumbs }: { breadcrumbs: AppPageBreadcrumb[] }) {
  const last = breadcrumbs[breadcrumbs.length - 1];
  const parent = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground shrink-0">
      {parent?.href ? (
        <Link href={parent.href} className="hover:text-foreground transition-colors">
          <Home className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <Home className="h-3.5 w-3.5" />
      )}
      <span className="opacity-50">/</span>
      <span className="font-medium text-foreground">{last?.label}</span>
    </div>
  );
}

export function AppPageHeader({
  breadcrumbs,
  backHref,
  onBack,
  title,
  description,
  actions,
  className,
  variant = "default",
}: AppPageHeaderProps) {
  const displayTitle = title ?? breadcrumbs[breadcrumbs.length - 1]?.label;
  const hasBack = backHref != null || onBack != null;
  const showTitleBlock =
    displayTitle != null || description != null || actions != null || hasBack;

  if (variant === "contained") {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
          className
        )}
      >
        <div className="min-w-0">
          {displayTitle != null && (
            <h1 className="text-xl font-semibold sm:text-2xl tracking-tight">{displayTitle}</h1>
          )}
          {description != null && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {breadcrumbs.length > 0 && <BreadcrumbPill breadcrumbs={breadcrumbs} />}
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
                <BreadcrumbItem>
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage className="truncate max-w-[200px] sm:max-w-none font-medium">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {showTitleBlock && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {onBack != null ? (
              <Button variant="ghost" size="icon" type="button" onClick={onBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : backHref != null ? (
              <Button variant="ghost" size="icon" asChild>
                <Link href={backHref}>
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {(displayTitle != null || description != null) && (
              <div className="min-w-0">
                {displayTitle != null && (
                  <h1 className="text-xl font-semibold sm:text-2xl truncate">{displayTitle}</h1>
                )}
                {description != null && (
                  <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                )}
              </div>
            )}
          </div>
          {actions != null && <div className="flex gap-2 shrink-0">{actions}</div>}
        </div>
      )}
    </div>
  );
}
