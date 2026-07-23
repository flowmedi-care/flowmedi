"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { type User } from "@supabase/supabase-js";
import { LogOut, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { FlowmediLogo } from "@/components/flowmedi-logo";
import { DashboardNavIcon } from "@/components/dashboard-nav-icons";
import {
  DASHBOARD_TOP_NAV,
  DASHBOARD_UTILITY_NAV,
  DASHBOARD_MIDDLE_NAV_GROUPS,
  DASHBOARD_CONFIG_GROUP,
  DASHBOARD_INSTRUCOES_GROUP,
  DASHBOARD_SERVICOS_VALORES_GROUP,
  filterNavByRole,
  filterTopNavByRole,
  filterGroupChildren,
  getActiveNavGroupId,
  isLinkActive,
  canAccessServicosValoresNav,
  type NavGroupItem,
  type NavLinkItem,
  type NavTopItem,
} from "@/lib/dashboard-nav-config";
import { useDashboardNavigation } from "@/components/dashboard-navigation-context";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  clinic_id: string;
  active?: boolean;
} | null;

function navItemClass(active: boolean, expanded: boolean) {
  return cn(
    "relative flex items-center transition-colors rounded-lg shrink-0",
    expanded ? "w-full gap-3 px-3 h-10 text-sm" : "h-10 w-10 justify-center",
    active
      ? "bg-primary/10 text-primary font-medium"
      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
  );
}

function RailNavItem({
  active,
  pending,
  label,
  onClick,
  href,
  children,
  badge,
  expanded,
}: {
  active: boolean;
  pending?: boolean;
  label: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  badge?: boolean;
  expanded: boolean;
}) {
  const className = cn(
    navItemClass(active, expanded),
    pending && !active && "bg-primary/5 text-primary/80"
  );

  const inner = (
    <>
      {active && expanded && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-5 [&_svg]:w-5">
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
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const router = useRouter();
  const { displayPathname, startNavigation } = useDashboardNavigation();
  const [mobileExpandedGroupId, setMobileExpandedGroupId] = useState<string | null>(null);
  const role = profile?.role ?? "";
  const activeGroupId = getActiveNavGroupId(displayPathname);
  const showConfig =
    !DASHBOARD_CONFIG_GROUP.roles || DASHBOARD_CONFIG_GROUP.roles.includes(role);
  const showServicosValores = canAccessServicosValoresNav(role, servicesPricingMode);

  const showLabels = railExpanded || mobileOpen;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  useEffect(() => {
    if (activeGroupId) {
      setMobileExpandedGroupId(activeGroupId);
    }
  }, [activeGroupId, pathname]);

  useEffect(() => {
    if (!mobileOpen) setMobileExpandedGroupId(null);
  }, [mobileOpen]);

  function handleGroupClick(group: NavGroupItem) {
    const children = filterGroupChildren(group, role);
    if (children.length === 0) return;

    const isMobileDrawer =
      mobileOpen &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;

    if (isMobileDrawer && children.length > 1) {
      setMobileExpandedGroupId((prev) => (prev === group.id ? null : group.id));
      return;
    }

    const preferred =
      children.find((c) => c.href === group.prefix || c.href.startsWith(`${group.prefix}?`) || c.href.startsWith(`${group.prefix}/`)) ??
      children[0];

    router.push(preferred.href);
    startNavigation(preferred.href);
    onMobileOpenChange(false);
  }

  function renderGroupChildLinks(group: NavGroupItem) {
    const children = filterGroupChildren(group, role);
    if (!mobileOpen || mobileExpandedGroupId !== group.id || children.length <= 1) {
      return null;
    }

    return (
      <div className="flex flex-col gap-0.5 pl-3 pb-1 md:hidden">
        {children.map((child) => {
          const active = isLinkActive(displayPathname, child.href, search);
          const pending = displayPathname === child.href && pathname !== child.href;
          return (
            <Link
              key={child.href}
              href={child.href}
              onClick={() => {
                startNavigation(child.href);
                onMobileOpenChange(false);
              }}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : pending
                    ? "bg-primary/5 text-primary/80"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {child.label}
            </Link>
          );
        })}
      </div>
    );
  }

  function toggleRail() {
    onRailExpandedChange(!railExpanded);
  }

  const topNav = filterTopNavByRole(DASHBOARD_TOP_NAV, role);

  const utilityNav = filterNavByRole(DASHBOARD_UTILITY_NAV, role).filter((item) => {
    if (item.href === "/dashboard/auditoria" && !canAccessAudit) return false;
    return true;
  });

  const middleGroups = filterNavByRole(DASHBOARD_MIDDLE_NAV_GROUPS, role);

  function renderLink(item: NavLinkItem) {
    const active = isLinkActive(displayPathname, item.href, search);
    const pending = displayPathname === item.href && pathname !== item.href;

    return (
      <RailNavItem
        key={item.href}
        href={item.href}
        active={active}
        pending={pending}
        label={item.label}
        expanded={showLabels}
        onClick={() => {
          startNavigation(item.href);
          onMobileOpenChange(false);
        }}
      >
        <DashboardNavIcon name={item.icon} />
      </RailNavItem>
    );
  }

  function renderGroup(group: NavGroupItem) {
    const active = activeGroupId === group.id;
    const hasBadge =
      group.badgeKey === "whatsapp" && hasWhatsAppConnected && whatsappUnreadCount > 0;
    const label =
      group.id === "comunicacao" && !canUseWhatsApp
        ? `${group.label} (Pro)`
        : group.label;

    return (
      <div key={group.id} className={showLabels ? "w-full" : "flex flex-col items-center"}>
        <RailNavItem
          active={active}
          label={label}
          badge={hasBadge}
          expanded={showLabels}
          onClick={() => handleGroupClick(group)}
        >
          <DashboardNavIcon name={group.icon} />
        </RailNavItem>
        {renderGroupChildLinks(group)}
      </div>
    );
  }

  function renderTopItem(item: NavTopItem) {
    if (item.type === "link") return renderLink(item);
    return renderGroup(item);
  }

  const dividerClass = cn(
    "bg-border/80 shrink-0",
    showLabels ? "my-1.5 h-px w-full mx-1" : "my-1 h-px w-8"
  );

  return (
    <>
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => onMobileOpenChange(true)}
          className="md:hidden fixed top-3 left-4 z-50 hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-sm"
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
            <button
              type="button"
              onClick={toggleRail}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              aria-label="Expandir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav
          className={cn(
            "flex-1 min-h-0 py-1.5 gap-0.5 overflow-x-hidden flex flex-col",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            showLabels ? "px-2" : "items-center px-1.5",
            "overflow-y-auto"
          )}
        >
          {topNav.map(renderTopItem)}
          {middleGroups.length > 0 && (
            <>
              {showLabels && (
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Módulos
                </p>
              )}
              <div className={dividerClass} aria-hidden />
            </>
          )}
          {middleGroups.map((group) => renderGroup(group))}
          {utilityNav.length > 0 && <div className={dividerClass} aria-hidden />}
          {utilityNav.map(renderLink)}
          {showServicosValores && renderGroup(DASHBOARD_SERVICOS_VALORES_GROUP)}
          {renderGroup(DASHBOARD_INSTRUCOES_GROUP)}
        </nav>

        <div
          className={cn(
            "flex-shrink-0 border-t border-border/60 py-2 gap-1",
            showLabels ? "px-2 flex flex-col" : "flex flex-col items-center px-1.5"
          )}
        >
          {showLabels && profile && (
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 mb-1">
              <Avatar name={profile.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-none">
                  {profile.full_name ?? "Usuário"}
                </p>
                <p className="truncate text-xs text-muted-foreground capitalize mt-0.5">
                  {profile.role}
                </p>
              </div>
            </div>
          )}
          {showConfig && renderGroup(DASHBOARD_CONFIG_GROUP)}
          <RailNavItem active={false} label="Sair" expanded={showLabels} onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </RailNavItem>
        </div>

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
