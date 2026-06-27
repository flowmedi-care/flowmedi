"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClinicalNavItem } from "./clinical-nav-item";
import type { AppointmentFichaInstance, FichaHistoryAppointment } from "@/lib/clinical-ficha-types";
import { Copy, ExternalLink } from "lucide-react";

function formatConsultaDate(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FichaNavRow({
  ficha,
  index,
  active,
  onSelect,
  onCopySingle,
  showCopyAction,
}: {
  ficha: AppointmentFichaInstance;
  index: number;
  active: boolean;
  onSelect: () => void;
  onCopySingle?: () => void;
  showCopyAction?: boolean;
}) {
  return (
    <div className="group relative">
      <ClinicalNavItem active={active} onClick={onSelect}>
        <div className="flex items-center justify-between gap-2 pl-1 pr-6">
          <span className="truncate">
            {String(index + 1).padStart(2, "0")}. {ficha.template.name}
          </span>
          {ficha.status === "concluida" && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              OK
            </Badge>
          )}
        </div>
      </ClinicalNavItem>
      {showCopyAction && onCopySingle && ficha.template.ficha_type === "fields" && (
        <button
          type="button"
          title="Copiar desta ficha da consulta anterior"
          onClick={(e) => {
            e.stopPropagation();
            onCopySingle();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity"
        >
          <Copy className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function FichaHistorySidebar({
  currentFichas,
  previousAppointments,
  activeFichaId,
  onSelectFicha,
  onCopySingleFicha,
  canCopy,
}: {
  currentFichas: AppointmentFichaInstance[];
  previousAppointments: FichaHistoryAppointment[];
  activeFichaId: string | null;
  onSelectFicha: (fichaId: string, scope: "current" | "history") => void;
  onCopySingleFicha?: (templateId: string) => void;
  canCopy: boolean;
}) {
  return (
    <>
      {currentFichas.length > 0 && (
        <>
          <p className="text-[10px] text-muted-foreground px-2 pt-0.5">Esta consulta</p>
          {currentFichas.map((f, idx) => (
            <FichaNavRow
              key={f.id}
              ficha={f}
              index={idx}
              active={activeFichaId === f.id}
              onSelect={() => onSelectFicha(f.id, "current")}
              showCopyAction={canCopy}
              onCopySingle={
                onCopySingleFicha
                  ? () => onCopySingleFicha(f.ficha_template_id)
                  : undefined
              }
            />
          ))}
        </>
      )}

      {previousAppointments.length > 0 && (
        <>
          <p className="text-[10px] text-muted-foreground px-2 pt-2">Consultas anteriores</p>
          {previousAppointments.map((appt) => (
            <div key={appt.appointment_id} className="mb-2">
              <div className="px-2 py-1 flex items-center justify-between gap-1">
                <p className="text-[10px] font-medium text-muted-foreground truncate">
                  {formatConsultaDate(appt.scheduled_at)}
                  {appt.doctor_name ? ` · ${appt.doctor_name}` : ""}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  asChild
                  title="Abrir atendimento completo"
                >
                  <Link href={`/dashboard/agenda/atendimento/${appt.appointment_id}`}>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
              {appt.fichas.map((f, idx) => (
                <FichaNavRow
                  key={f.id}
                  ficha={f}
                  index={idx}
                  active={activeFichaId === f.id}
                  onSelect={() => onSelectFicha(f.id, "history")}
                />
              ))}
            </div>
          ))}
        </>
      )}
    </>
  );
}
