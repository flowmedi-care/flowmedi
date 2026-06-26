"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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
  onToggle,
}: {
  group: NavGroupItem;
  role: string;
  open: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const children = filterGroupChildren(group, role);

  if (!open) {
    return (
      <div className="hidden md:flex relative h-full w-0 flex-shrink-0 bg-card">
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-0 top-1/2 z-50 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-elevated text-muted-foreground hover:text-foreground"
          aria-label="Expandir submenu"
        >
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <aside className="relative hidden md:flex w-52 flex-col border-r border-border bg-card shadow-[1px_0_0_0_hsl(var(--border))] h-full flex-shrink-0">
      <div className="px-4 py-3.5 border-b border-border/60 pr-6">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Módulo
        </p>
        <h2 className="text-sm font-semibold text-foreground mt-0.5">{group.label}</h2>
      </div>
      <nav className="flex-1 min-h-0 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {children.map((child) => {
          const active = isLinkActive(pathname, child.href);
          return (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "relative flex items-center rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
              {child.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={onToggle}
        className="absolute -right-3 top-1/2 z-50 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-elevated text-muted-foreground hover:text-foreground"
        aria-label="Recolher submenu"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </aside>
  );
}
