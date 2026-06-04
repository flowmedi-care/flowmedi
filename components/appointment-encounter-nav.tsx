"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type EncounterNavView = "recepcao" | "clinico";

export function AppointmentEncounterNav({
  appointmentId,
  activeView,
}: {
  appointmentId: string;
  activeView: EncounterNavView;
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
      className="flex gap-1 border-b border-border -mb-px overflow-x-auto"
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
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
