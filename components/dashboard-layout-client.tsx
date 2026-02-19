"use client";

import { useState, useEffect } from "react";
import { type User } from "@supabase/supabase-js";
import { DashboardNav } from "@/components/dashboard-nav";
import { WhatsAppChatSidebar } from "@/components/whatsapp-chat-sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  clinic_id: string;
  active?: boolean;
} | null;

export function DashboardLayoutClient({
  user,
  profile,
  children,
}: {
  user: User;
  profile: Profile;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hasWhatsAppSimple, setHasWhatsAppSimple] = useState(false);

  // Verificar se há integração WhatsApp simples conectada
  useEffect(() => {
    async function checkWhatsApp() {
      const supabase = createClient();
      const { data } = await supabase
        .from("clinic_integrations")
        .select("id")
        .eq("integration_type", "whatsapp_simple")
        .eq("status", "connected")
        .limit(1);
      setHasWhatsAppSimple((data?.length || 0) > 0);
    }
    if (profile?.clinic_id) {
      checkWhatsApp();
    }
  }, [profile?.clinic_id]);

  // Detectar mobile para backdrop e comportamento do drawer
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Carregar estado do localStorage na inicialização (apenas desktop)
  useEffect(() => {
    if (typeof window === "undefined" || isMobile) return;
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null) {
      setIsCollapsed(savedState === "true");
    }
  }, [isMobile]);

  // Salvar estado no localStorage quando mudar (apenas desktop)
  useEffect(() => {
    if (typeof window === "undefined" || isMobile) return;
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed, isMobile]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  // No mobile: sidebar empurra o conteúdo (não sobrepõe). Largura do drawer quando aberto.
  const mobileSidebarWidth = 260;

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col md:flex-row overflow-hidden relative bg-muted/30">
      <DashboardNav
        user={user}
        profile={profile}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
        mobileSidebarWidth={mobileSidebarWidth}
      />
      <main
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden transition-[margin] duration-300 ease-out",
          "py-4 px-4 sm:py-5 sm:px-5 md:py-6 md:px-6 lg:py-8 lg:px-8",
          "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
          "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          // No mobile, quando a sidebar está aberta, dá margem à esquerda para o conteúdo não ficar embaixo
          isMobile && !isCollapsed && "md:ml-0"
        )}
        style={
          isMobile && !isCollapsed
            ? { marginLeft: mobileSidebarWidth }
            : undefined
        }
      >
        <div className="w-full max-w-[1600px] mx-auto">{children}</div>
      </main>
      {/* Chat WhatsApp na sidebar direita */}
      {hasWhatsAppSimple && <WhatsAppChatSidebar />}
      {/* Botão flutuante para abrir menu no mobile (safe area) */}
      {isCollapsed && (
        <Button
          variant="default"
          size="icon"
          className={cn(
            "fixed z-50 h-12 w-12 min-h-[44px] min-w-[44px] rounded-full shadow-lg touch-manipulation md:hidden",
            "left-[max(1rem,env(safe-area-inset-left))] bottom-[max(1rem,env(safe-area-inset-bottom))]"
          )}
          onClick={toggleCollapse}
          title="Abrir menu"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
