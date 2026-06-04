"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { FlowmediLogo } from "@/components/flowmedi-logo";
import { DashboardNavIcon } from "@/components/dashboard-nav-icons";
import {
  DASHBOARD_TOP_NAV,
  DASHBOARD_UTILITY_NAV,
  DASHBOARD_NAV_GROUPS,
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

export function DashboardNavRail({
  user,
  profile,
  hasWhatsAppConnected,
  canUseWhatsApp,
  canAccessAudit,
  servicesPricingMode,
  whatsappUnreadCount,
  mobileOpen,
  onMobileOpenChange,
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
}) {
  const pathname = usePathname();
  const router = useRouter();
  const role = profile?.role ?? "";
  const isMedico = role === "medico";
  const activeGroupId = getActiveNavGroupId(pathname);

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
    if (item.href === "/dashboard/whatsapp") {
      if (!canUseWhatsApp && !hasWhatsAppConnected) return true;
      if (canUseWhatsApp && hasWhatsAppConnected) return true;
      if (canUseWhatsApp && !hasWhatsAppConnected) return true;
      return false;
    }
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

  const groups = filterNavByRole(DASHBOARD_NAV_GROUPS, role);

  function renderLink(item: NavLinkItem) {
    const isWhatsapp = item.href === "/dashboard/whatsapp";
    const label =
      isWhatsapp && !canUseWhatsApp
        ? "WhatsApp (Pro)"
        : isWhatsapp && canUseWhatsApp && !hasWhatsAppConnected
          ? "WhatsApp"
          : item.label;
    const hasBadge = isWhatsapp && hasWhatsAppConnected && whatsappUnreadCount > 0;
    const active = isLinkActive(pathname, item.href);

    return (
      <Link key={item.href} href={item.href} onClick={() => onMobileOpenChange(false)}>
        <Button
          variant={active ? "secondary" : "ghost"}
          size="icon"
          className={cn(
            "h-10 w-10 relative",
            active && "bg-primary/10 text-primary"
          )}
          title={label}
        >
          <DashboardNavIcon name={item.icon} />
          {hasBadge && (
            <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-[#25D366] border border-background" />
          )}
        </Button>
      </Link>
    );
  }

  function renderGroup(group: NavGroupItem) {
    const active = activeGroupId === group.id;
    return (
      <Button
        key={group.id}
        type="button"
        variant={active ? "secondary" : "ghost"}
        size="icon"
        className={cn("h-10 w-10", active && "bg-primary/10 text-primary")}
        title={group.label}
        onClick={() => handleGroupClick(group)}
      >
        <DashboardNavIcon name={group.icon} />
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={() => onMobileOpenChange(!mobileOpen)}
        className="md:hidden fixed top-3 left-4 z-50 h-10 w-10 rounded-full bg-background/95 shadow-sm"
        aria-label="Abrir navegação"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <aside
        className={cn(
          "h-screen md:h-full border-b md:border-b-0 md:border-r border-border bg-card flex flex-col overflow-hidden flex-shrink-0 z-40 transition-transform duration-300",
          "w-16",
          "fixed md:relative inset-y-0 left-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-2 border-b border-border flex-shrink-0 flex justify-center">
          <FlowmediLogo href="/dashboard" showText={false} size="sm" />
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto flex flex-col items-center">
          {topNav.map(renderLink)}
          <div className="my-1 w-8 border-t border-border" />
          {groups.map(renderGroup)}
          <div className="my-1 w-8 border-t border-border" />
          {utilityNav.map(renderLink)}
        </nav>

        <div className="p-2 border-t border-border flex-shrink-0 flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={handleSignOut}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
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
