"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { DashboardNav } from "./dashboard-nav";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

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
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasWhatsAppConnected, setHasWhatsAppConnected] = useState(false);
  const isWhatsAppPage = pathname === "/dashboard/whatsapp";

  useEffect(() => {
    async function checkWhatsAppIntegration() {
      if (!profile?.clinic_id) return;
      
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("clinic_integrations")
          .select("id")
          .eq("clinic_id", profile.clinic_id)
          .in("integration_type", ["whatsapp_meta", "whatsapp_simple"])
          .eq("status", "connected")
          .limit(1);
        
        setHasWhatsAppConnected((data?.length ?? 0) > 0);
      } catch (error) {
        // Ignorar erro
      }
    }

    checkWhatsAppIntegration();
  }, [profile?.clinic_id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    }
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      {isCollapsed && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setIsCollapsed(false)}
          className="md:hidden fixed top-3 left-3 z-50 h-10 w-10 rounded-full shadow-sm"
          aria-label="Abrir navegação"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
      <DashboardNav
        user={user}
        profile={profile}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        hasWhatsAppConnected={hasWhatsAppConnected}
        canAccessAudit={canAccessAudit}
        canUseWhatsApp={canUseWhatsApp}
        servicesPricingMode={servicesPricingMode}
      />
      <main className={`flex-1 flex flex-col min-h-0 overflow-hidden bg-background ${!isWhatsAppPage ? "overflow-y-auto" : ""}`}>
        {isWhatsAppPage ? (
          <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 max-w-7xl flex-1">
            {children}
          </div>
        )}
      </main>
    </div>
  );
}
