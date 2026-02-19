"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FlowmediLogo } from "@/components/flowmedi-logo";
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
  PanelLeft,
  ChevronLeft,
  Mail,
  Bell,
  ClipboardList,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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
  mobileSidebarWidth = 260,
  hasWhatsAppSimple = false,
}: {
  user: User;
  profile: Profile;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileSidebarWidth?: number;
  hasWhatsAppSimple?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = profile?.role === "admin";
  const isMedico = profile?.role === "medico";
  const isSecretaria = profile?.role === "secretaria";

  // Debug: log do profile para verificar se está sendo carregado corretamente
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("[DashboardNav] Profile:", profile);
    console.log("[DashboardNav] isAdmin:", isAdmin);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  const navItems: { href: string; label: string; icon: React.ReactNode; roles?: string[] }[] = [
    { href: "/dashboard", label: "Início", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/dashboard/agenda", label: "Agenda", icon: <Calendar className="h-4 w-4" /> },
    { href: "/dashboard/consulta", label: "Consulta", icon: <ClipboardList className="h-4 w-4" /> },
    { href: "/dashboard/pacientes", label: "Pacientes", icon: <Users className="h-4 w-4" /> },
    { href: "/dashboard/formularios", label: "Formulários", icon: <FileText className="h-4 w-4" /> },
    { href: "/dashboard/eventos", label: "Eventos", icon: <Bell className="h-4 w-4" />, roles: ["admin", "secretaria"] },
    ...(hasWhatsAppSimple ? [{ href: "/dashboard/whatsapp", label: "WhatsApp", icon: <MessageSquare className="h-4 w-4" /> }] : []),
  ];

  return (
    <aside
      className={cn(
        "flex flex-col overflow-hidden transition-[width,transform] duration-300 ease-out flex-shrink-0",
        "border-border bg-card",
        "md:relative md:h-full md:border-b-0 md:border-r",
        "h-screen border-b",
        // Mobile: empurra o conteúdo (não sobrepõe). Largura fixa quando aberto, 0 quando fechado.
        "fixed inset-y-0 left-0 z-40 md:relative md:inset-auto md:z-auto",
        "md:h-full md:w-56 md:max-w-none",
        isCollapsed
          ? "w-0 -translate-x-full md:translate-x-0 md:w-16 md:min-w-[4rem]"
          : "translate-x-0 shadow-lg md:shadow-none max-md:w-[260px]"
      )}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        className={cn(
          "p-3 sm:p-4 border-b border-border flex-shrink-0 flex",
          isCollapsed ? "flex-col items-center gap-2 px-2" : "items-center justify-between"
        )}
      >
        {isCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onToggleCollapse}
            title="Expandir sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <FlowmediLogo href="/dashboard" size="sm" showText className="shrink-0" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 ml-auto"
              onClick={onToggleCollapse}
              title="Colapsar sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      <nav className={cn("flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden", isCollapsed && "px-1")}>
        {navItems.map((item) => {
          const show = !item.roles || item.roles.includes(profile?.role ?? "");
          if (!show) return null;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start min-h-[44px] sm:min-h-9 touch-manipulation",
                  pathname === item.href && "bg-primary/10 text-primary",
                  isCollapsed && "justify-center px-0 md:min-h-8"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!isCollapsed && <span className="ml-2 truncate">{item.label}</span>}
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
                className={cn("w-full justify-start min-h-[44px] sm:min-h-9 touch-manipulation", isCollapsed && "justify-center px-0 md:min-h-8")}
                title={isCollapsed ? "Meu Perfil" : undefined}
              >
                <Users className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2 truncate">Meu Perfil</span>}
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
                className={cn("w-full justify-start min-h-[44px] sm:min-h-9 touch-manipulation", isCollapsed && "justify-center px-0 md:min-h-8")}
                title={isCollapsed ? "Equipe" : undefined}
              >
                <UserPlus className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2 truncate">Equipe</span>}
              </Button>
            </Link>
            <Link href="/dashboard/campos-pacientes">
              <Button
                variant={pathname === "/dashboard/campos-pacientes" ? "secondary" : "ghost"}
                className={cn("w-full justify-start min-h-[44px] sm:min-h-9 touch-manipulation", isCollapsed && "justify-center px-0 md:min-h-8")}
                title={isCollapsed ? "Campos" : undefined}
              >
                <FileEdit className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2 truncate">Campos</span>}
              </Button>
            </Link>
            <Link href="/dashboard/configuracoes">
              <Button
                variant={pathname === "/dashboard/configuracoes" ? "secondary" : "ghost"}
                className={cn("w-full justify-start min-h-[44px] sm:min-h-9 touch-manipulation", isCollapsed && "justify-center px-0 md:min-h-8")}
                title={isCollapsed ? "Configurações" : undefined}
              >
                <Settings className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2 truncate">Configurações</span>}
              </Button>
            </Link>
            <Link href="/dashboard/plano">
              <Button
                variant={pathname === "/dashboard/plano" ? "secondary" : "ghost"}
                className={cn("w-full justify-start min-h-[44px] sm:min-h-9 touch-manipulation", isCollapsed && "justify-center px-0 md:min-h-8")}
                title={isCollapsed ? "Plano e pagamento" : undefined}
              >
                <CreditCard className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2 truncate">Plano e pagamento</span>}
              </Button>
            </Link>
            <Link href="/dashboard/mensagens">
              <Button
                variant={pathname === "/dashboard/mensagens" ? "secondary" : "ghost"}
                className={cn("w-full justify-start min-h-[44px] sm:min-h-9 touch-manipulation", isCollapsed && "justify-center px-0 md:min-h-8")}
                title={isCollapsed ? "Mensagens" : undefined}
              >
                <Mail className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2 truncate">Mensagens</span>}
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
          className={cn("w-full justify-start mt-2 min-h-[44px] sm:min-h-8 touch-manipulation", isCollapsed && "justify-center px-0 md:min-h-8")}
          onClick={handleSignOut}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2 truncate">Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
