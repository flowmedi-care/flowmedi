"use client";

import { Bell, Menu, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDashboardNavigation } from "@/components/dashboard-navigation-context";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Visão Geral",
  "/dashboard/agenda": "Agenda",
  "/dashboard/consulta": "Consultas",
  "/dashboard/atendimento": "Atendimento",
  "/dashboard/eventos": "Eventos",
  "/dashboard/whatsapp": "Conversas",
  "/dashboard/mensagens": "Mensagens",
  "/dashboard/financeiro": "Financeiro",
  "/dashboard/crm": "CRM",
  "/dashboard/hoje": "Hoje",
  "/dashboard/hoje?focus=pendencias": "Pendências",
  "/dashboard/hoje?focus=atencao": "Hoje",
  "/dashboard/hoje?focus=inbox": "Caixa de entrada",
  "/dashboard/hoje?area=pessoas": "Pessoas",
  "/dashboard/hoje?area=agenda": "Agenda",
  "/dashboard/hoje?area=atendimentos": "Atendimentos",
  "/dashboard/hoje?area=pacientes": "Pacientes",
  "/dashboard/hoje?area=agendamentos": "Agenda",
  "/dashboard/hoje?area=consultas": "Atendimentos",
  "/dashboard/hoje?area=contatos": "Pessoas",
  "/dashboard/crm/jornada": "Jornadas",
  "/dashboard/crm/jornada?view=fluxo": "Jornadas",
  "/dashboard/crm/jornada": "Jornada (legado)",
  "/dashboard/pipeline": "Pendências",
  "/dashboard/contatos": "Contatos",
  "/dashboard/pacientes": "Pacientes",
  "/dashboard/formularios": "Formulários",
  "/dashboard/estoque": "Estoque",
  "/dashboard/configuracoes": "Configurações",
  "/dashboard/auditoria": "Auditoria",
  "/dashboard/onboarding": "Onboarding",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const base = `/${segments[0]}/${segments[1]}`;
    if (PAGE_TITLES[base]) return PAGE_TITLES[base];
  }

  const last = segments[segments.length - 1];
  if (last) {
    return last
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return "Dashboard";
}

type Profile = {
  full_name: string | null;
  role: string;
} | null;

export function DashboardTopbar({
  profile,
  onMenuClick,
  className,
}: {
  profile: Profile;
  onMenuClick?: () => void;
  className?: string;
}) {
  const { displayPathname, isNavigating } = useDashboardNavigation();
  const title = getPageTitle(displayPathname);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-border/60 bg-card/80 px-4 backdrop-blur-md md:px-6",
        className
      )}
    >
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onMenuClick}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <div className="min-w-0 flex-1">
        {isNavigating ? (
          <Skeleton className="h-6 w-36" />
        ) : (
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        )}
      </div>

      <div className="hidden max-w-xs flex-1 lg:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="h-9 pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
            disabled
          />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="hidden sm:flex items-center gap-2.5 pl-1">
          <Avatar name={profile?.full_name} size="sm" />
          <div className="hidden md:block min-w-0">
            <p className="truncate text-sm font-medium leading-none">
              {profile?.full_name ?? "Usuário"}
            </p>
            <p className="truncate text-xs text-muted-foreground capitalize mt-0.5">
              {profile?.role ?? ""}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
