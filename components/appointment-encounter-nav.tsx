"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type EncounterNavView = "recepcao" | "clinico";

export function AppointmentEncounterNav({
  appointmentId,
  activeView,
  className,
}: {
  appointmentId: string;
  activeView: EncounterNavView;
  className?: string;
}) {
  const pathname = usePathname();
  const recepcaoHref = `/dashboard/agenda/consulta/${appointmentId}`;
  const clinicoHref = `/dashboard/agenda/atendimento/${appointmentId}`;

  const tabs: { id: EncounterNavView; label: string; href: string }[] = [
    { id: "recepcao", label: "Recepção", href: recepcaoHref },
    { id: "clinico", label: "Clínico", href: clinicoHref },
  ];

  return (
    <nav
      className={cn(
        "flex gap-0 overflow-x-auto -mb-px",
        className
      )}
      aria-label="Visão do atendimento"
    >
      {tabs.map((tab) => {
        const isActive =
          activeView === tab.id ||
          (tab.id === "recepcao" && pathname.startsWith(recepcaoHref)) ||
          (tab.id === "clinico" && pathname.startsWith(clinicoHref));
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "px-4 py-3 min-h-[44px] text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
