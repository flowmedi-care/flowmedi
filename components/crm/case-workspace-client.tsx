"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspacePayload } from "@/app/dashboard/crm/jornada/case-types";
import {
  clearCasePendingDecision,
  completeCaseTaskAction,
  workspaceAttendanceAction,
} from "@/app/dashboard/crm/jornada/case-actions";
import { cn } from "@/lib/utils";

function formatDue(dueAt: string | null): string | null {
  if (!dueAt) return null;
  try {
    return new Date(dueAt).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dueAt;
  }
}

export function CaseWorkspaceClient({ data }: { data: WorkspacePayload }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { header, case: journeyCase, tasks, timeline, primaryPanels } = data;
  const nextAction = header.nextAction;

  function refresh() {
    router.refresh();
  }

  function completeTask(taskId: string) {
    startTransition(async () => {
      await completeCaseTaskAction(journeyCase.id, taskId);
      refresh();
    });
  }

  function markPendingDone() {
    startTransition(async () => {
      await clearCasePendingDecision(journeyCase.id);
      refresh();
    });
  }

  function attendance(status: "confirmada" | "realizada") {
    const apptId = header.nextAppointmentId;
    if (!apptId) return;
    startTransition(async () => {
      await workspaceAttendanceAction(journeyCase.id, apptId, status);
      refresh();
    });
  }

  const financeColor =
    header.finance.status === "pago"
      ? "text-emerald-700"
      : header.finance.status === "parcial"
        ? "text-amber-700"
        : header.finance.status === "aberto"
          ? "text-orange-700"
          : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Atendimento · {header.processTypeName} · {header.workflowName}
            </p>
            <h1 className="text-xl font-semibold">{header.displayName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Fase: {header.phaseName}
              {header.nextAppointmentLabel ? ` · ${header.nextAppointmentLabel}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge title="Responsável atual">{header.ownerLabel}</Badge>
            {header.quoteBadge && <Badge variant="secondary">{header.quoteBadge}</Badge>}
            {header.openTasksCount > 0 && (
              <Badge variant="secondary">{header.openTasksCount} tasks</Badge>
            )}
          </div>
        </div>

        {nextAction && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Próxima ação
            </p>
            <p className="text-sm font-medium">{nextAction.label}</p>
            <p className="text-xs text-muted-foreground">
              {[
                nextAction.waitingFor ? `Aguarda: ${nextAction.waitingFor}` : null,
                formatDue(nextAction.dueAt) ? `Até ${formatDue(nextAction.dueAt)}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Decisão do atendimento"}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2">
          <span className={cn("text-sm font-medium", financeColor)}>
            Financeiro · {header.finance.label}
          </span>
          <Button size="sm" variant="outline" asChild>
            <Link href={header.finance.href}>Abrir financeiro</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {primaryPanels.includes("next_action") && nextAction && (
          <section className="rounded-xl border bg-card p-4 lg:col-span-2">
            <h2 className="mb-2 text-sm font-semibold">Executar próxima ação</h2>
            <p className="text-sm mb-3">{nextAction.label}</p>
            <div className="flex flex-wrap gap-2">
              {header.nextAppointmentId && (
                <>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => attendance("confirmada")}
                  >
                    Confirmar consulta
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => attendance("realizada")}
                  >
                    Marcar realizada
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link href={header.conversationHref ?? "/dashboard/whatsapp"}>
                  Abrir conversa
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard/agenda">Abrir agenda</Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={markPendingDone}
              >
                Marcar pendência como feita
              </Button>
            </div>
          </section>
        )}

        {primaryPanels.includes("tasks") && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Pendências do atendimento</h2>
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={t.status === "completed"}
                    disabled={t.status !== "open" || pending}
                    onChange={() => t.status === "open" && completeTask(t.id)}
                  />
                  <span
                    className={cn(
                      t.status === "completed" && "line-through text-muted-foreground"
                    )}
                  >
                    {t.title}
                    {t.due_at ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {formatDue(t.due_at)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
              {tasks.length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhuma pendência.</li>
              )}
            </ul>
          </section>
        )}

        {primaryPanels.includes("timeline") && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {timeline.map((e) => (
                <li key={e.id} className="border-b border-border/50 pb-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{e.event_type}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.actor}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {primaryPanels.includes("chat") && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Conversa</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Atalho de contexto — a decisão permanece neste Workspace.
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href={header.conversationHref ?? "/dashboard/whatsapp"}>
                Abrir conversa
              </Link>
            </Button>
          </section>
        )}

        {primaryPanels.includes("agenda") && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Agenda</h2>
            {header.nextAppointmentLabel ? (
              <p className="text-sm mb-3">{header.nextAppointmentLabel}</p>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">
                Nenhuma consulta futura vinculada.
              </p>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/agenda">Abrir agenda</Link>
            </Button>
            {header.nextAppointmentId && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => attendance("confirmada")}
                >
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => attendance("realizada")}
                >
                  Realizada
                </Button>
              </div>
            )}
          </section>
        )}

        {primaryPanels.includes("financeiro") && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Financeiro</h2>
            <p className={cn("text-sm font-medium mb-3", financeColor)}>
              {header.finance.label}
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href={header.finance.href}>Abrir contas a receber</Link>
            </Button>
          </section>
        )}

        {primaryPanels.includes("lead") && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Comercial</h2>
            <p className="text-xs text-muted-foreground mb-2">
              Qualificação via módulo de domínio (próximas iterações).
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/contatos/leads">Abrir leads</Link>
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
