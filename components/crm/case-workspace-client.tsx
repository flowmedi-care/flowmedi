"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspacePayload } from "@/app/dashboard/crm/jornada/case-types";
import {
  completeCaseTaskAction,
  publishCaseOutcomeAction,
} from "@/app/dashboard/crm/jornada/case-actions";
import { cn } from "@/lib/utils";

export function CaseWorkspaceClient({ data }: { data: WorkspacePayload }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { header, case: journeyCase, tasks, timeline, primaryPanels } = data;

  function refresh() {
    router.refresh();
  }

  function completeTask(taskId: string) {
    startTransition(async () => {
      await completeCaseTaskAction(journeyCase.id, taskId);
      refresh();
    });
  }

  function publish(eventType: string) {
    startTransition(async () => {
      await publishCaseOutcomeAction({ caseId: journeyCase.id, eventType });
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
              {header.processTypeName} · {header.workflowName}
            </p>
            <h1 className="text-xl font-semibold">{header.displayName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Fase: {header.phaseName}
              {header.nextAppointmentLabel ? ` · ${header.nextAppointmentLabel}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{header.ownerLabel}</Badge>
            {header.quoteBadge && <Badge variant="secondary">{header.quoteBadge}</Badge>}
            {header.pendingDecision && (
              <Badge variant="outline">
                Decide: {header.pendingDecision.waiting_for}
                {header.pendingDecision.label
                  ? ` — ${header.pendingDecision.label}`
                  : ` (${header.pendingDecision.type})`}
              </Badge>
            )}
            {header.openTasksCount > 0 && (
              <Badge variant="secondary">{header.openTasksCount} tasks</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2">
          <span className={cn("text-sm font-medium", financeColor)}>
            Financeiro · {header.finance.label}
          </span>
          <Button size="sm" variant="outline" asChild>
            <Link href={header.finance.href}>Abrir módulo</Link>
          </Button>
        </div>

        {header.executionContext && (
          <p className="text-xs text-muted-foreground">
            Execução: {header.executionContext.operation}
            {header.executionContext.tool ? ` / ${header.executionContext.tool}` : ""}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {primaryPanels.includes("tasks") && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Tasks</h2>
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
                  </span>
                </li>
              ))}
              {tasks.length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhuma task.</li>
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
            <h2 className="mb-3 text-sm font-semibold">Chat</h2>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/whatsapp">Abrir WhatsApp</Link>
            </Button>
          </section>
        )}

        {primaryPanels.includes("agenda") && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Agenda</h2>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/agenda">Abrir Agenda</Link>
            </Button>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => publish("Appointment.Confirmed")}
              >
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => publish("Appointment.Completed")}
              >
                Realizada
              </Button>
            </div>
          </section>
        )}

        {primaryPanels.includes("lead") && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Lead</h2>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => publish("Lead.Qualified")}
            >
              Qualificar (Lead.Qualified)
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
