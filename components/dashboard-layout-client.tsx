"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { DashboardNav } from "./dashboard-nav";
import { DashboardTopbar } from "./dashboard-topbar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  DashboardNavigationProvider,
  useDashboardNavigation,
} from "./dashboard-navigation-context";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  clinic_id: string;
  active?: boolean;
} | null;

interface DashboardLayoutClientProps {
  user: User;
  profile: Profile;
  children: React.ReactNode;
  canAccessAudit: boolean;
  canUseWhatsApp: boolean;
  servicesPricingMode: "centralizado" | "descentralizado";
}

export function DashboardLayoutClient({
  user,
  profile,
  children,
  canAccessAudit,
  canUseWhatsApp,
  servicesPricingMode,
}: DashboardLayoutClientProps) {
  return (
    <DashboardNavigationProvider>
      <DashboardLayoutInner
        user={user}
        profile={profile}
        canAccessAudit={canAccessAudit}
        canUseWhatsApp={canUseWhatsApp}
        servicesPricingMode={servicesPricingMode}
      >
        {children}
      </DashboardLayoutInner>
    </DashboardNavigationProvider>
  );
}

function DashboardLayoutInner({
  user,
  profile,
  children,
  canAccessAudit,
  canUseWhatsApp,
  servicesPricingMode,
}: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const { isNavigating } = useDashboardNavigation();
  const [hasWhatsAppConnected, setHasWhatsAppConnected] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isWhatsAppPage = pathname === "/dashboard/whatsapp";
  const isInstrucoesPage = pathname?.startsWith("/dashboard/instrucoes") ?? false;

  useEffect(() => {
    async function checkWhatsAppIntegration() {
      if (!profile?.clinic_id) return;

      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("clinic_integrations")
          .select("id")
          .eq("clinic_id", profile.clinic_id)
          .eq("integration_type", "whatsapp_meta")
          .eq("status", "connected")
          .limit(1);

        setHasWhatsAppConnected((data?.length ?? 0) > 0);
      } catch {
        // ignore
      }
    }

    checkWhatsAppIntegration();
  }, [profile?.clinic_id]);

  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardNav
        user={user}
        profile={profile}
        hasWhatsAppConnected={hasWhatsAppConnected}
        canAccessAudit={canAccessAudit}
        canUseWhatsApp={canUseWhatsApp}
        servicesPricingMode={servicesPricingMode}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background relative">
        {isNavigating && (
          <div
            className="absolute top-0 left-0 right-0 z-30 h-0.5 bg-primary animate-pulse"
            aria-hidden
          />
        )}
        {isWhatsAppPage ? (
          <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
            {children}
          </div>
        ) : (
          <>
            <DashboardTopbar
              profile={profile}
              onMenuClick={() => setMobileNavOpen(true)}
            />
            <div
              className={cn(
                "flex-1 min-h-0 overflow-y-auto overscroll-contain w-full",
                isInstrucoesPage ? "p-0" : "p-4 md:p-6 lg:p-8"
              )}
            >
              <div className={cn("w-full", !isInstrucoesPage && "mx-auto max-w-7xl")}>
                {children}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
