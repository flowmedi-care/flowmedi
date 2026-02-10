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
}: {
  user: User;
  profile: Profile;
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
  ];

  return (
    <aside className="w-full md:w-56 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <Link href="/dashboard" className="font-semibold text-foreground">
          FlowMedi
        </Link>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const show = !item.roles || item.roles.includes(profile?.role ?? "");
          if (!show) return null;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={cn("w-full justify-start", pathname === item.href && "bg-primary/10 text-primary")}
              >
                {item.icon}
                {item.label}
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
                className="w-full justify-start"
              >
                <Users className="h-4 w-4" />
                Meu Perfil
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
                className="w-full justify-start"
              >
                <UserPlus className="h-4 w-4" />
                Equipe
              </Button>
            </Link>
            <Link href="/dashboard/campos-pacientes">
              <Button
                variant={pathname === "/dashboard/campos-pacientes" ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <FileEdit className="h-4 w-4" />
                Campos de Pacientes
              </Button>
            </Link>
            <Link href="/dashboard/configuracoes">
              <Button
                variant={pathname === "/dashboard/configuracoes" ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Settings className="h-4 w-4" />
                Configurações
              </Button>
            </Link>
            <Link href="/dashboard/plano">
              <Button
                variant={pathname === "/dashboard/plano" ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <CreditCard className="h-4 w-4" />
                Plano e pagamento
              </Button>
            </Link>
          </>
        )}
      </nav>
      <div className="p-2 border-t border-border">
        <p className="text-xs text-muted-foreground px-2 truncate" title={user.email}>
          {user.email}
        </p>
        {profile && (
          <p className="text-xs text-muted-foreground px-2 capitalize">
            {profile.role}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start mt-2"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
