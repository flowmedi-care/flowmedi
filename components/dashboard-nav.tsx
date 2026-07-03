"use client";

import { usePathname } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { DashboardNavRail } from "@/components/dashboard-nav-rail";
import { DashboardNavSub } from "@/components/dashboard-nav-sub";
import {
  filterGroupChildren,
  getActiveNavGroupId,
  getNavGroupById,
} from "@/lib/dashboard-nav-config";
import { useDashboardNavigation } from "@/components/dashboard-navigation-context";

const SIDEBAR_EXPANDED_KEY = "flowmedi-sidebar-expanded";

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
  mobileOpen: controlledMobileOpen,
  onMobileOpenChange: controlledOnMobileOpenChange,
}: {
  user: User;
  profile: Profile;
  hasWhatsAppConnected?: boolean;
  canAccessAudit?: boolean;
  canUseWhatsApp?: boolean;
  servicesPricingMode: "centralizado" | "descentralizado";
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { displayPathname } = useDashboardNavigation();
  const [whatsappUnreadCount, setWhatsappUnreadCount] = useState(0);
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileOpen = controlledMobileOpen ?? internalMobileOpen;
  const setMobileOpen = controlledOnMobileOpenChange ?? setInternalMobileOpen;
  const [railExpanded, setRailExpanded] = useState(false);
  const [subPanelOpen, setSubPanelOpen] = useState(true);
  const role = profile?.role ?? "";
  const activeGroupId = getActiveNavGroupId(displayPathname);
  const activeGroup = activeGroupId ? getNavGroupById(activeGroupId) : undefined;
  const hasSubPanel =
    !!activeGroup && filterGroupChildren(activeGroup, role).length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (stored === "true") setRailExpanded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(railExpanded));
  }, [railExpanded]);

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

  useEffect(() => {
    if (hasSubPanel) setSubPanelOpen(true);
  }, [activeGroupId, hasSubPanel]);

  return (
    <div className="flex h-full flex-shrink-0 bg-card border-r border-border/60">
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
        railExpanded={railExpanded}
        onRailExpandedChange={setRailExpanded}
      />
      {activeGroup && hasSubPanel && (
        <DashboardNavSub
          group={activeGroup}
          role={role}
          open={subPanelOpen}
          onToggle={() => setSubPanelOpen((v) => !v)}
        />
      )}
    </div>
  );
}
