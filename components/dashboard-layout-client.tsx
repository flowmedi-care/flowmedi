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
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Carregar estado do localStorage na inicialização
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null) {
      setIsCollapsed(savedState === "true");
    }
  }, []);

  // Salvar estado no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden relative">
      <DashboardNav
        user={user}
        profile={profile}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      <main className="flex-1 p-4 md:p-6 bg-muted/30 overflow-y-auto">{children}</main>
      {/* Botão flutuante para abrir sidebar no mobile quando colapsada */}
      {isCollapsed && (
        <Button
          variant="default"
          size="icon"
          className={cn(
            "fixed bottom-4 left-4 z-50 h-12 w-12 rounded-full shadow-lg md:hidden",
            "bg-primary hover:bg-primary/90"
          )}
          onClick={toggleCollapse}
          title="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
