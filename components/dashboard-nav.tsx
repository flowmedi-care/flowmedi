"use client";

import { usePathname } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { DashboardNavRail } from "@/components/dashboard-nav-rail";
import { DashboardNavSub } from "@/components/dashboard-nav-sub";
import {
  DASHBOARD_NAV_GROUPS,
  filterNavByRole,
  filterGroupChildren,
  getActiveNavGroupId,
} from "@/lib/dashboard-nav-config";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  clinic_id: string;
  active?: boolean;
} | null;

export function DashboardNav({
  user,
  profile,
  hasWhatsAppConnected,
  canAccessAudit,
  canUseWhatsApp,
  servicesPricingMode,
}: {
  user: User;
  profile: Profile;
  hasWhatsAppConnected?: boolean;
  canAccessAudit?: boolean;
  canUseWhatsApp?: boolean;
  servicesPricingMode: "centralizado" | "descentralizado";
}) {
  const pathname = usePathname();
  const [whatsappUnreadCount, setWhatsappUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = profile?.role ?? "";
  const activeGroupId = getActiveNavGroupId(pathname);
  const activeGroup = DASHBOARD_NAV_GROUPS.find((g) => g.id === activeGroupId);
  const visibleGroup =
    activeGroup && filterGroupChildren(activeGroup, role).length > 0
      ? activeGroup
      : null;

  useEffect(() => {
    if (!hasWhatsAppConnected) return;

    const loadUnreadCount = async () => {
      try {
        const res = await fetch("/api/whatsapp/unread-count");
        if (res.ok) {
          const data = await res.json();
          setWhatsappUnreadCount(data.total || 0);
        }
      } catch {
        // ignore
      }
    };

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 10000);
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      setWhatsappUnreadCount(customEvent.detail || 0);
    };
    window.addEventListener("whatsapp-unread-update", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("whatsapp-unread-update", handleUpdate);
    };
  }, [hasWhatsAppConnected]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-full flex-shrink-0">
      <DashboardNavRail
        user={user}
        profile={profile}
        hasWhatsAppConnected={hasWhatsAppConnected}
        canUseWhatsApp={canUseWhatsApp}
        canAccessAudit={canAccessAudit}
        servicesPricingMode={servicesPricingMode}
        whatsappUnreadCount={whatsappUnreadCount}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />
      {visibleGroup && (
        <DashboardNavSub group={visibleGroup} role={role} />
      )}
    </div>
  );
}
