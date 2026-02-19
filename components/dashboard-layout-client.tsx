"use client";

import { useState, useEffect } from "react";
import { type User } from "@supabase/supabase-js";
import { DashboardNav } from "./dashboard-nav";
import { createClient } from "@/lib/supabase/client";

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
}

export function DashboardLayoutClient({ user, profile, children }: DashboardLayoutClientProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasWhatsAppSimple, setHasWhatsAppSimple] = useState(false);

  useEffect(() => {
    async function checkWhatsAppIntegration() {
      if (!profile?.clinic_id) return;
      
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("clinic_integrations")
          .select("id")
          .eq("clinic_id", profile.clinic_id)
          .eq("integration_type", "whatsapp_simple")
          .eq("status", "connected")
          .maybeSingle();
        
        setHasWhatsAppSimple(!!data);
      } catch (error) {
        // Ignorar erro
      }
    }

    checkWhatsAppIntegration();
  }, [profile?.clinic_id]);

  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardNav
        user={user}
        profile={profile}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        hasWhatsAppSimple={hasWhatsAppSimple}
      />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
