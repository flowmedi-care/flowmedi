"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { LogOut, Menu, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { FlowmediLogo } from "@/components/flowmedi-logo";
import { DashboardNavIcon } from "@/components/dashboard-nav-icons";
import {
  DASHBOARD_TOP_NAV,
  DASHBOARD_UTILITY_NAV,
  DASHBOARD_MIDDLE_NAV_GROUPS,
  DASHBOARD_CONFIG_GROUP,
  filterNavByRole,
  filterGroupChildren,
  getActiveNavGroupId,
  isLinkActive,
  type NavGroupItem,
  type NavLinkItem,
} from "@/lib/dashboard-nav-config";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  clinic_id: string;
  active?: boolean;
} | null;

function navItemClass(active: boolean, expanded: boolean) {
  return cn(
    "relative flex items-center transition-colors rounded-lg",
    expanded ? "w-full gap-3 px-3 h-10 text-sm" : "h-11 w-11 justify-center",
    active
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
  );
}

function RailNavItem({
  active,
  label,
  onClick,
  href,
  children,
  badge,
  expanded,
}: {
  active: boolean;
  label: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  badge?: boolean;
  expanded: boolean;
}) {
  const className = navItemClass(active, expanded);

  const inner = (
    <>
      <span className="relative flex shrink-0 items-center justify-center">
        {children}
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        )}
      </span>
      {expanded && (
        <span className="truncate flex-1 text-left leading-none">{label}</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} title={expanded ? undefined : label} className={className} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" title={expanded ? undefined : label} onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export function DashboardNavRail({
  profile,
  hasWhatsAppConnected,
  canUseWhatsApp,
  canAccessAudit,
  servicesPricingMode,
  whatsappUnreadCount,
  mobileOpen,
  onMobileOpenChange,
  railExpanded,
  onRailExpandedChange,
  subPanelOpen,
  onSubPanelToggle,
  hasSubPanel,
}: {
  user: User;
  profile: Profile;
  hasWhatsAppConnected?: boolean;
  canUseWhatsApp?: boolean;
  canAccessAudit?: boolean;
  servicesPricingMode: "centralizado" | "descentralizado";
  whatsappUnreadCount: number;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  railExpanded: boolean;
  onRailExpandedChange: (expanded: boolean) => void;
  subPanelOpen: boolean;
  onSubPanelToggle: () => void;
  hasSubPanel: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const role = profile?.role ?? "";
  const isMedico = role === "medico";
  const activeGroupId = getActiveNavGroupId(pathname);
  const showConfig =
    !DASHBOARD_CONFIG_GROUP.roles || DASHBOARD_CONFIG_GROUP.roles.includes(role);

  const showLabels = railExpanded || mobileOpen;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  function handleGroupClick(group: NavGroupItem) {
    const children = filterGroupChildren(group, role);
    if (children.length > 0) {
      router.push(children[0].href);
    }
    onMobileOpenChange(false);
  }

  function toggleRail() {
    onRailExpandedChange(!railExpanded);
  }

  const topNav = filterNavByRole(DASHBOARD_TOP_NAV, role);

  const utilityNav = filterNavByRole(DASHBOARD_UTILITY_NAV, role).filter((item) => {
    if (item.href === "/dashboard/auditoria" && !canAccessAudit) return false;
    if (
      item.href === "/dashboard/servicos-valores" &&
      isMedico &&
      servicesPricingMode !== "descentralizado"
    ) {
      return false;
    }
    if (item.href === "/dashboard/servicos-valores" && !isMedico && role !== "admin") {
      return false;
    }
    return true;
  });

  const middleGroups = filterNavByRole(DASHBOARD_MIDDLE_NAV_GROUPS, role);

  function renderLink(item: NavLinkItem) {
    const isWhatsapp = item.href === "/dashboard/whatsapp";
    const label = isWhatsapp && !canUseWhatsApp ? "WhatsApp (Pro)" : item.label;
    const hasBadge = isWhatsapp && hasWhatsAppConnected && whatsappUnreadCount > 0;
    const active = isLinkActive(pathname, item.href);

    return (
      <RailNavItem
        key={item.href}
        href={item.href}
        active={active}
        label={label}
        badge={hasBadge}
        expanded={showLabels}
        onClick={() => onMobileOpenChange(false)}
      >
        <DashboardNavIcon name={item.icon} className="h-5 w-5 shrink-0" />
      </RailNavItem>
    );
  }

  function renderGroup(group: NavGroupItem) {
    const active = activeGroupId === group.id;
    return (
      <RailNavItem
        key={group.id}
        active={active}
        label={group.label}
        expanded={showLabels}
        onClick={() => handleGroupClick(group)}
      >
        <DashboardNavIcon name={group.icon} className="h-5 w-5 shrink-0" />
      </RailNavItem>
    );
  }

  const dividerClass = cn(
    "bg-border/80 shrink-0",
    showLabels ? "my-2 h-px w-full mx-1" : "my-2 h-px w-7"
  );

  return (
    <>
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => onMobileOpenChange(true)}
          className="md:hidden fixed top-3 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-sm"
          aria-label="Abrir navegação"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <aside
        className={cn(
          "relative h-screen md:h-full flex flex-col flex-shrink-0 z-40 bg-card border-r border-border/80 transition-[width,transform] duration-200 ease-out",
          showLabels ? "w-[220px]" : "w-[60px]",
          "fixed md:relative inset-y-0 left-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div
          className={cn(
            "flex-shrink-0 border-b border-border/60",
            showLabels ? "px-3 py-3" : "flex flex-col items-center py-3 gap-2"
          )}
        >
          {showLabels ? (
            <div className="flex items-center justify-between gap-2">
              <FlowmediLogo href="/dashboard" showText size="sm" />
              <button
                type="button"
                onClick={() => {
                  toggleRail();
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    onMobileOpenChange(false);
                  }
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                aria-label={railExpanded ? "Recolher menu" : "Expandir menu"}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleRail}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                aria-label="Expandir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link href="/dashboard" className="flex items-center justify-center" title="Flowmedi">
                <FlowmediLogo href="/dashboard" showText={false} size="sm" />
              </Link>
            </>
          )}
        </div>

        <nav
          className={cn(
            "flex-1 py-2 gap-0.5 overflow-y-auto overflow-x-hidden",
            showLabels ? "px-2 flex flex-col" : "flex flex-col items-center px-1"
          )}
        >
          {topNav.map(renderLink)}
          {middleGroups.length > 0 && <div className={dividerClass} aria-hidden />}
          {middleGroups.map(renderGroup)}
          {utilityNav.length > 0 && <div className={dividerClass} aria-hidden />}
          {utilityNav.map(renderLink)}
        </nav>

        <div
          className={cn(
            "flex-shrink-0 border-t border-border/60 py-2 gap-0.5",
            showLabels ? "px-2 flex flex-col" : "flex flex-col items-center px-1"
          )}
        >
          {showConfig && renderGroup(DASHBOARD_CONFIG_GROUP)}
          <RailNavItem active={false} label="Sair" expanded={showLabels} onClick={handleSignOut}>
            <LogOut className="h-5 w-5 shrink-0" />
          </RailNavItem>
        </div>

        {hasSubPanel && (
          <button
            type="button"
            onClick={onSubPanelToggle}
            className={cn(
              "hidden md:flex absolute -right-3 top-1/2 z-50 h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-sm text-muted-foreground hover:text-foreground transition-transform",
              !subPanelOpen && "rotate-180"
            )}
            aria-label={subPanelOpen ? "Recolher submenu" : "Expandir submenu"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          aria-label="Fechar menu"
          onClick={() => onMobileOpenChange(false)}
        />
      )}
    </>
  );
}
