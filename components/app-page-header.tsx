import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
};

export function AppPageHeader({
  breadcrumbs,
  backHref,
  onBack,
  title,
  description,
  actions,
  className,
}: AppPageHeaderProps) {
  const hasTitleRow = backHref != null || onBack != null;

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

      {hasTitleRow && (
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
            {(title != null || description != null) && (
              <div className="min-w-0">
                {title != null && (
                  <h1 className="text-xl font-semibold sm:text-2xl truncate">{title}</h1>
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
