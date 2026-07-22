"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  changeAttendanceStatus,
  requestCasePhaseOverride,
} from "@/app/dashboard/crm/jornada/case-actions";
import type {
  AttendanceCard,
  BoardPayload,
  BoardView,
  PipelineCard,
} from "@/app/dashboard/crm/jornada/case-types";

const VIEWS: { id: BoardView; label: string; hint: string }[] = [
  { id: "pendencias", label: "Pendências", hint: "O que exige decisão agora?" },
  { id: "fluxo", label: "Fluxo", hint: "Onde cada atendimento está no processo?" },
  { id: "comparecimento", label: "Comparecimento", hint: "Consultas que precisam de ação" },
  {
    id: "ia",
    label: "Atendimento automático",
    hint: "Atendimentos sob responsabilidade da IA",
  },
];

function CaseCard({ card }: { card: PipelineCard }) {
  return (
    <Link
      href={`/dashboard/crm/jornada/${card.case.id}`}
      className="block rounded-lg border bg-card p-3 shadow-sm transition hover:border-primary/40"
    >
      <p className="text-sm font-medium truncate">{card.displayName}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{card.phaseName}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {card.ownerLabel && (
          <Badge variant="secondary" className="text-[10px]">
            {card.ownerLabel}
          </Badge>
        )}
        {card.nextActionLabel && (
          <Badge variant="outline" className="text-[10px]">
            {card.nextActionLabel}
          </Badge>
        )}
        {card.quoteBadge && (
          <Badge variant="secondary" className="text-[10px]">
            {card.quoteBadge}
          </Badge>
        )}
        {card.openTaskCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {card.openTaskCount} pendência{card.openTaskCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
    </Link>
  );
}

function AttendanceCardUi({
  card,
  onDropStatus,
}: {
  card: AttendanceCard;
  onDropStatus?: boolean;
}) {
  const href = card.caseId
    ? `/dashboard/crm/jornada/${card.caseId}`
    : "/dashboard/agenda";
  return (
    <div
      draggable={!!onDropStatus}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/appointment-id", card.appointmentId);
      }}
      className="rounded-lg border bg-card p-3 shadow-sm"
    >
      <Link href={href} className="text-sm font-medium hover:underline">
        {card.displayName}
      </Link>
      <p className="text-xs text-muted-foreground mt-0.5">
        {card.scheduledAt
          ? new Date(card.scheduledAt).toLocaleString("pt-BR")
          : "—"}
        {card.doctorName ? ` · ${card.doctorName}` : ""}
      </p>
    </div>
  );
}

export function CaseBoardClient({
  initial,
  initialView,
}: {
  initial: BoardPayload;
  initialView: BoardView;
}) {
  const router = useRouter();
  const [view, setView] = useState<BoardView>(initialView);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function navigate(next: BoardView, versionId?: string | null) {
    setView(next);
    const v = versionId ?? initial.workflowVersionId;
    const q = new URLSearchParams({ view: next });
    if (v && next === "fluxo") q.set("workflow", v);
    router.push(`/dashboard/crm/jornada?${q.toString()}`);
  }

  function onFluxoDrop(caseId: string, phaseId: string) {
    startTransition(async () => {
      setError(null);
      const res = await requestCasePhaseOverride(caseId, phaseId, "fluxo_dnd");
      if (!res.ok) setError(res.error ?? "Falha ao mover");
      else router.refresh();
    });
  }

  function onAttendanceDrop(
    appointmentId: string,
    status: "agendada" | "confirmada" | "realizada" | "falta" | "cancelada"
  ) {
    startTransition(async () => {
      setError(null);
      const res = await changeAttendanceStatus(appointmentId, status);
      if (!res.ok) setError(res.error ?? "Falha ao atualizar");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Button
            key={v.id}
            size="sm"
            variant={view === v.id ? "default" : "outline"}
            title={v.hint}
            onClick={() => navigate(v.id)}
          >
            {v.label}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {VIEWS.find((v) => v.id === view)?.hint}
      </p>

      {view === "fluxo" && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Workflow:</span>
          {initial.workflows.map((w) => (
            <Button
              key={w.version_id}
              size="sm"
              variant={
                initial.workflowVersionId === w.version_id ? "secondary" : "ghost"
              }
              onClick={() => navigate("fluxo", w.version_id)}
            >
              {w.name}
              <span className="ml-1 text-[10px] opacity-70">
                ({w.process_type_name})
              </span>
            </Button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {pending && <p className="text-xs text-muted-foreground">Atualizando…</p>}

      {view === "pendencias" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {initial.pendingQueue.cards.map((card) => (
            <CaseCard key={card.case.id} card={card} />
          ))}
          {initial.pendingQueue.cards.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm font-medium">Nada exige decisão agora</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Quando houver pendências no atendimento, elas aparecem aqui.
              </p>
            </div>
          )}
        </div>
      )}

      {view === "fluxo" && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {initial.fluxo.columns.map((col) => (
            <div
              key={col.phaseId}
              className="min-w-[220px] flex-1 rounded-xl border bg-muted/30 p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const caseId = e.dataTransfer.getData("text/case-id");
                if (caseId) onFluxoDrop(caseId, col.phaseId);
              }}
            >
              <div className="mb-2 flex justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground">{col.cards.length}</span>
              </div>
              <div className="space-y-2">
                {col.cards.map((card) => (
                  <div
                    key={card.case.id}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/case-id", card.case.id)
                    }
                  >
                    <CaseCard card={card} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "comparecimento" && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {initial.comparecimento.columns.map((col) => (
            <div
              key={col.status}
              className="min-w-[220px] flex-1 rounded-xl border bg-muted/30 p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/appointment-id");
                if (id) {
                  onAttendanceDrop(
                    id,
                    col.status as
                      | "agendada"
                      | "confirmada"
                      | "realizada"
                      | "falta"
                      | "cancelada"
                  );
                }
              }}
            >
              <div className="mb-2 flex justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground">{col.cards.length}</span>
              </div>
              <div className="space-y-2">
                {col.cards.map((card) => (
                  <AttendanceCardUi key={card.appointmentId} card={card} onDropStatus />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "ia" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {initial.aiQueue.cards.map((card) => (
            <CaseCard key={card.case.id} card={card} />
          ))}
          {initial.aiQueue.cards.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum caso em atendimento automático.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
