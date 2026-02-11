"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserPlus,
  FileText,
  Settings,
  CreditCard,
  LogOut,
  FileEdit,
  Menu,
  ChevronLeft,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

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
  isCollapsed,
  onToggleCollapse,
}: {
  user: User;
  profile: Profile;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = profile?.role === "admin";
  const isMedico = profile?.role === "medico";
  const isSecretaria = profile?.role === "secretaria";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  const navItems: { href: string; label: string; icon: React.ReactNode; roles?: string[] }[] = [
    { href: "/dashboard", label: "Início", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/dashboard/agenda", label: "Agenda", icon: <Calendar className="h-4 w-4" /> },
    { href: "/dashboard/pacientes", label: "Pacientes", icon: <Users className="h-4 w-4" /> },
    { href: "/dashboard/formularios", label: "Formulários", icon: <FileText className="h-4 w-4" /> },
    { href: "/dashboard/mensagens", label: "Mensagens", icon: <Mail className="h-4 w-4" />, roles: ["admin"] },
  ];

  return (
    <aside
      className={cn(
        "h-screen md:h-full border-b md:border-b-0 md:border-r border-border bg-card flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
        isCollapsed ? "w-0 md:w-16" : "w-full md:w-56"
      )}
    >
      <div className={cn("p-4 border-b border-border flex-shrink-0 flex items-center gap-2", isCollapsed ? "justify-center px-2" : "justify-between")}>
        {!isCollapsed && (
          <Link href="/dashboard" className="font-semibold text-foreground whitespace-nowrap">
            FlowMedi
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 flex-shrink-0", !isCollapsed && "ml-auto")}
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {isCollapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
      <nav className={cn("flex-1 p-2 space-y-1 overflow-y-auto", isCollapsed && "px-1")}>
        {navItems.map((item) => {
          const show = !item.roles || item.roles.includes(profile?.role ?? "");
          if (!show) return null;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  pathname === item.href && "bg-primary/10 text-primary",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!isCollapsed && <span className="ml-2">{item.label}</span>}
              </Button>
            </Link>
          );
        })}
        {isMedico && (
          <>
            <div className="my-2 border-t border-border" />
            <Link href="/dashboard/perfil">
              <Button
                variant={pathname === "/dashboard/perfil" ? "secondary" : "ghost"}
                className={cn("w-full justify-start", isCollapsed && "justify-center px-0")}
                title={isCollapsed ? "Meu Perfil" : undefined}
              >
                <Users className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Meu Perfil</span>}
              </Button>
            </Link>
          </>
        )}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-border" />
            <Link href="/dashboard/equipe">
              <Button
                variant={pathname === "/dashboard/equipe" ? "secondary" : "ghost"}
                className={cn("w-full justify-start", isCollapsed && "justify-center px-0")}
                title={isCollapsed ? "Equipe" : undefined}
              >
                <UserPlus className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Equipe</span>}
              </Button>
            </Link>
            <Link href="/dashboard/campos-pacientes">
              <Button
                variant={pathname === "/dashboard/campos-pacientes" ? "secondary" : "ghost"}
                className={cn("w-full justify-start", isCollapsed && "justify-center px-0")}
                title={isCollapsed ? "Campos de Pacientes" : undefined}
              >
                <FileEdit className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Campos de Pacientes</span>}
              </Button>
            </Link>
            <Link href="/dashboard/templates">
              <Button
                variant={pathname === "/dashboard/templates" ? "secondary" : "ghost"}
                className={cn("w-full justify-start", isCollapsed && "justify-center px-0")}
                title={isCollapsed ? "Templates" : undefined}
              >
                <Mail className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Templates</span>}
              </Button>
            </Link>
            <Link href="/dashboard/configuracoes">
              <Button
                variant={pathname === "/dashboard/configuracoes" ? "secondary" : "ghost"}
                className={cn("w-full justify-start", isCollapsed && "justify-center px-0")}
                title={isCollapsed ? "Configurações" : undefined}
              >
                <Settings className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Configurações</span>}
              </Button>
            </Link>
            <Link href="/dashboard/plano">
              <Button
                variant={pathname === "/dashboard/plano" ? "secondary" : "ghost"}
                className={cn("w-full justify-start", isCollapsed && "justify-center px-0")}
                title={isCollapsed ? "Plano e pagamento" : undefined}
              >
                <CreditCard className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Plano e pagamento</span>}
              </Button>
            </Link>
          </>
        )}
      </nav>
      <div className={cn("p-2 border-t border-border flex-shrink-0", isCollapsed && "px-1")}>
        {!isCollapsed && (
          <>
            <p className="text-xs text-muted-foreground px-2 truncate" title={user.email}>
              {user.email}
            </p>
            {profile && (
              <p className="text-xs text-muted-foreground px-2 capitalize">
                {profile.role}
              </p>
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full justify-start mt-2", isCollapsed && "justify-center px-0")}
          onClick={handleSignOut}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
