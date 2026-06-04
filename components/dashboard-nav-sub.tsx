"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  type NavGroupItem,
  filterGroupChildren,
  isLinkActive,
} from "@/lib/dashboard-nav-config";

export function DashboardNavSub({
  group,
  role,
  open,
}: {
  group: NavGroupItem;
  role: string;
  open: boolean;
}) {
  const pathname = usePathname();
  const children = filterGroupChildren(group, role);

  if (!open) return null;

  return (
    <aside className="hidden md:flex w-52 flex-col border-r border-border/80 bg-muted/30 h-full flex-shrink-0">
      <div className="px-4 py-3.5 border-b border-border/60">
        <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
      </div>
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {children.map((child) => {
          const active = isLinkActive(pathname, child.href);
          return (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "flex items-center rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
              )}
            >
              {child.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
