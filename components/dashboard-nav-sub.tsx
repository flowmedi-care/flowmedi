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
    <aside className="hidden md:flex w-56 flex-col border-r border-border/80 bg-background h-full flex-shrink-0">
      <div className="px-4 py-4 border-b border-border/60">
        <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
          {group.label}
        </h2>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {children.map((child) => {
          const active = isLinkActive(pathname, child.href);
          return (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-violet-50 text-violet-700 font-medium dark:bg-violet-950/40 dark:text-violet-300"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
