"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type NavGroupItem,
  filterGroupChildren,
  isLinkActive,
} from "@/lib/dashboard-nav-config";

export function DashboardNavSub({
  group,
  role,
}: {
  group: NavGroupItem;
  role: string;
}) {
  const pathname = usePathname();
  const children = filterGroupChildren(group, role);

  return (
    <aside className="hidden md:flex w-52 flex-col border-r border-border bg-card/50 h-full flex-shrink-0">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {children.map((child) => {
          const active = isLinkActive(pathname, child.href);
          return (
            <Link key={child.href} href={child.href}>
              <Button
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start font-normal",
                  active && "bg-primary/10 text-primary"
                )}
              >
                {child.label}
              </Button>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
