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
import type { WorkspacePanel } from "@/lib/case-management";
import { cn } from "@/lib/utils";

const PANEL_LABELS: Record<WorkspacePanel, string> = {
  chat: "Chat",
  lead: "Lead",
  tasks: "Tasks",
  timeline: "Timeline",
  agenda: "Agenda",
  anamnese: "Anamnese",
  prontuario: "Prontuário",
  financeiro: "Financeiro",
  formularios: "Formulários",
  ia: "IA",
};

function PanelShell({
  panel,
  children,
  featured,
}: {
  panel: WorkspacePanel;
  children: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-4",
        featured && "border-primary/30 ring-1 ring-primary/10"
      )}
    >
      <h2 className="mb-3 text-sm font-semibold">{PANEL_LABELS[panel]}</h2>
      {children}
    </section>
  );
}

export function CaseWorkspaceClient({ data }: { data: WorkspacePayload }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { case: journeyCase, context, tasks, timeline } = data;

  const panels = [...context.primaryPanels, ...context.secondaryPanels];

  function refresh() {
    router.refresh();
  }

  function completeTask(taskId: string) {
    startTransition(async () => {
      await completeCaseTaskAction(journeyCase.id, taskId);
      refresh();
    });
  }

  function publish(eventType: string, evidence?: string) {
    startTransition(async () => {
      await publishCaseOutcomeAction({
        caseId: journeyCase.id,
        eventType,
        evidence,
      });
      refresh();
    });
  }

  function renderPanel(panel: WorkspacePanel, featured: boolean) {
    switch (panel) {
      case "chat":
        return (
          <PanelShell key={panel} panel={panel} featured={featured}>
            <p className="text-sm text-muted-foreground mb-3">
              Conversas do contato neste Case.
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/whatsapp">Abrir WhatsApp</Link>
            </Button>
          </PanelShell>
        );
      case "lead":
        return (
          <PanelShell key={panel} panel={panel} featured={featured}>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Contato</dt>
                <dd className="font-medium">{data.displayName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Tipo</dt>
                <dd>{data.journeyTypeLabel}</dd>
              </div>
              {journeyCase.lead_id && (
                <div className="pt-2">
                  <Button size="sm" variant="link" className="h-auto p-0" asChild>
                    <Link href={`/dashboard/contatos/leads`}>Ver no hub de leads</Link>
                  </Button>
                </div>
              )}
            </dl>
          </PanelShell>
        );
      case "tasks":
        return (
          <PanelShell key={panel} panel={panel} featured={featured}>
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={t.status === "completed"}
                    disabled={t.status === "completed" || pending}
                    onChange={() => {
                      if (t.status === "open") completeTask(t.id);
                    }}
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
                <li className="text-sm text-muted-foreground">Nenhuma task aberta.</li>
              )}
            </ul>
          </PanelShell>
        );
      case "timeline":
        return (
          <PanelShell key={panel} panel={panel} featured={featured}>
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {timeline.map((e) => (
                <li key={e.id} className="border-b border-border/50 pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.event_type}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {e.actor}
                    {e.evidence ? ` · ${e.evidence}` : ""}
                  </p>
                </li>
              ))}
              {timeline.length === 0 && (
                <li className="text-muted-foreground">Sem eventos ainda.</li>
              )}
            </ul>
          </PanelShell>
        );
      case "agenda":
        return (
          <PanelShell key={panel} panel={panel} featured={featured}>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/agenda">Abrir Agenda</Link>
            </Button>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => publish("Appointment.Confirmed", "workspace")}
              >
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => publish("Appointment.Completed", "workspace")}
              >
                Realizada
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => publish("Appointment.NoShow", "workspace")}
              >
                Falta
              </Button>
            </div>
          </PanelShell>
        );
      case "anamnese":
      case "formularios":
        return (
          <PanelShell key={panel} panel={panel} featured={featured}>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/crm/captacao">Formulários</Link>
            </Button>
            <Button
              size="sm"
              className="ml-2"
              variant="secondary"
              disabled={pending}
              onClick={() => publish("Form.Completed", "workspace")}
            >
              Marcar form respondido
            </Button>
          </PanelShell>
        );
      case "prontuario":
        return (
          <PanelShell key={panel} panel={panel} featured={featured}>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/agenda">Atendimento / prontuário</Link>
            </Button>
          </PanelShell>
        );
      case "financeiro":
        return (
          <PanelShell key={panel} panel={panel} featured={featured}>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/financeiro/receber">Contas a receber</Link>
            </Button>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => publish("Payment.Paid", "workspace")}
              >
                Pagamento confirmado
              </Button>
            </div>
          </PanelShell>
        );
      case "ia":
        return (
          <PanelShell key={panel} panel={panel} featured={featured}>
            <p className="text-xs text-muted-foreground mb-2">
              Tools liberadas neste contexto:
            </p>
            <div className="flex flex-wrap gap-1">
              {context.aiAllowedTools.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
            <Button
              size="sm"
              className="mt-3"
              disabled={pending}
              onClick={() => publish("Lead.Qualified", "workspace_ia_panel")}
            >
              Publicar Lead.Qualified
            </Button>
          </PanelShell>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Paciente</p>
            <h1 className="text-xl font-semibold">{data.displayName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data.journeyTypeLabel} · Fase: {data.phaseLabel} · Objetivo: {data.objective}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{journeyCase.owner}</Badge>
            {journeyCase.pending_decision && (
              <Badge variant="outline">
                Decide: {journeyCase.pending_decision.actor_role}
                {journeyCase.pending_decision.label
                  ? ` — ${journeyCase.pending_decision.label}`
                  : ""}
              </Badge>
            )}
          </div>
        </div>
        {context.priorityActions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {context.priorityActions.map((a) => (
              <Badge key={a} variant="secondary">
                {a}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {context.primaryPanels.map((p) => renderPanel(p, true))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {context.secondaryPanels.map((p) => renderPanel(p, false))}
      </div>

      {/* ensure all unique panels rendered once */}
      <div className="hidden">{panels.length}</div>
    </div>
  );
}
