import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ToolbarFilters } from "./toolbar-filters";
import { ToolbarActions } from "./toolbar-actions";
import { ToolbarMeta } from "./toolbar-meta";

function isSlot(child: ReactElement, slot: React.ElementType) {
  return child.type === slot;
}

function PageToolbarRoot({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  let filters: ReactNode = null;
  let actions: ReactNode = null;
  let meta: ReactNode = null;
  const loose: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      if (child != null && child !== false) loose.push(child);
      return;
    }
    if (isSlot(child, ToolbarFilters)) filters = child;
    else if (isSlot(child, ToolbarActions)) actions = child;
    else if (isSlot(child, ToolbarMeta)) meta = child;
    else loose.push(child);
  });

  if (!actions && loose.length > 0) {
    actions = <ToolbarActions>{loose}</ToolbarActions>;
  }

  if (!filters && !actions && !meta) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/20 p-3.5 sm:p-4",
        className
      )}
    >
      {(filters || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {filters}
          {actions}
        </div>
      )}
      {meta}
    </div>
  );
}

export const PageToolbar = Object.assign(PageToolbarRoot, {
  Filters: ToolbarFilters,
  Actions: ToolbarActions,
  Meta: ToolbarMeta,
});
