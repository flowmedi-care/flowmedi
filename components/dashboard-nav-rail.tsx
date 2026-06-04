"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { LogOut, Menu, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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

const RAIL_ACTIVE =
  "bg-violet-600 text-white shadow-md shadow-violet-600/25 hover:bg-violet-600 hover:text-white";
const RAIL_IDLE =
  "text-muted-foreground hover:bg-muted/80 hover:text-foreground";

function RailIconButton({
  active,
  title,
  onClick,
  href,
  children,
  badge,
}: {
  active: boolean;
  title: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  badge?: boolean;
}) {
  const className = cn(
    "relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
    active ? RAIL_ACTIVE : RAIL_IDLE
  );

  const inner = (
    <>
      {children}
      {badge && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background" />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} title={title} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" title={title} onClick={onClick} className={className}>
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

  const topNav = filterNavByRole(DASHBOARD_TOP_NAV, role).filter((item) => {
    if (item.href === "/dashboard/whatsapp") return true;
    return true;
  });

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
    const label =
      isWhatsapp && !canUseWhatsApp
        ? "WhatsApp (Pro)"
        : item.label;
    const hasBadge = isWhatsapp && hasWhatsAppConnected && whatsappUnreadCount > 0;
    const active = isLinkActive(pathname, item.href);

    return (
      <RailIconButton
        key={item.href}
        href={item.href}
        active={active}
        title={label}
        badge={hasBadge}
        onClick={() => onMobileOpenChange(false)}
      >
        <DashboardNavIcon name={item.icon} className="h-5 w-5" />
      </RailIconButton>
    );
  }

  function renderGroup(group: NavGroupItem) {
    const active = activeGroupId === group.id;
    return (
      <RailIconButton
        key={group.id}
        active={active}
        title={group.label}
        onClick={() => handleGroupClick(group)}
      >
        <DashboardNavIcon name={group.icon} className="h-5 w-5" />
      </RailIconButton>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onMobileOpenChange(!mobileOpen)}
        className="md:hidden fixed top-3 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-sm"
        aria-label="Abrir navegação"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={cn(
          "relative h-screen md:h-full flex flex-col flex-shrink-0 z-40 bg-background border-r border-border/80 transition-transform duration-300",
          "w-[60px]",
          "fixed md:relative inset-y-0 left-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex flex-col items-center pt-3 pb-2 gap-1 border-b border-border/60">
          <button
            type="button"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/80 md:hidden"
            )}
            onClick={() => onMobileOpenChange(false)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 flex flex-col items-center py-3 gap-1 overflow-y-auto overflow-x-hidden">
          {topNav.map(renderLink)}
          {middleGroups.length > 0 && (
            <div className="my-2 h-px w-7 bg-border/80" aria-hidden />
          )}
          {middleGroups.map(renderGroup)}
          {utilityNav.length > 0 && (
            <div className="my-2 h-px w-7 bg-border/80" aria-hidden />
          )}
          {utilityNav.map(renderLink)}
        </nav>

        <div className="flex flex-col items-center py-3 gap-1 border-t border-border/60">
          {showConfig && renderGroup(DASHBOARD_CONFIG_GROUP)}
          <RailIconButton active={false} title="Sair" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </RailIconButton>
        </div>

        {hasSubPanel && (
          <button
            type="button"
            onClick={onSubPanelToggle}
            className={cn(
              "hidden md:flex absolute -right-3 top-1/2 z-50 h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-md text-muted-foreground hover:text-foreground transition-transform",
              !subPanelOpen && "rotate-180"
            )}
            aria-label={subPanelOpen ? "Recolher menu" : "Expandir menu"}
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
