"use client";

import { useState, useEffect } from "react";
import { type User } from "@supabase/supabase-js";
import { DashboardNav } from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const showBackdrop = isMobile && !isCollapsed;

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col md:flex-row overflow-hidden relative bg-muted/30">
      {/* Backdrop: apenas no mobile quando o drawer está aberto */}
      {showBackdrop && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden animate-in fade-in duration-200"
          onClick={toggleCollapse}
        />
      )}
      <DashboardNav
        user={user}
        profile={profile}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      <main
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden",
          "py-4 px-4 sm:py-5 sm:px-5 md:py-6 md:px-6 lg:py-8 lg:px-8",
          "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
          "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        )}
      >
        <div className="w-full max-w-[1600px] mx-auto">{children}</div>
      </main>
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
