"use client";

import React from "react";
import { Bot, Headphones, Clock, Calendar, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OperationsSnapshot } from "@/lib/ops";
import Link from "next/link";

type CasePanelProps = {
  snapshot: OperationsSnapshot;
  onClaim: () => void;
  onReactivateAi: (brief: string) => void;
  onSaveNotes: (notes: string) => void;
  claiming?: boolean;
  reactivating?: boolean;
  className?: string;
};

function OwnerIcon({ owner }: { owner: OperationsSnapshot["owner"] }) {
  if (owner === "ai") return <Bot className="h-3.5 w-3.5" />;
  if (owner === "system") return <Clock className="h-3.5 w-3.5" />;
  if (owner === "patient_waiting") return <User className="h-3.5 w-3.5" />;
  return <Headphones className="h-3.5 w-3.5" />;
}

function ownerBadgeClass(owner: OperationsSnapshot["owner"]) {
  switch (owner) {
    case "ai":
      return "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-200";
    case "human":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200";
    case "system":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200";
    case "patient_waiting":
      return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-200";
    default:
      return "";
  }
}

/** Princípio Zero: levar ao lugar certo — Workspace do Atendimento ou Agenda. */
function actionHref(kind: string, snapshot: OperationsSnapshot): string {
  const workspaceHref = snapshot.journeyCaseId
    ? `/dashboard/crm/jornada/${snapshot.journeyCaseId}`
    : snapshot.phoneNumber
      ? `/dashboard/crm/jornada?phone=${encodeURIComponent(
          snapshot.phoneNumber.replace(/\D/g, "")
        )}`
      : "/dashboard/crm/jornada";

  switch (kind) {
    case "schedule_appointment":
    case "open_agenda":
      return "/dashboard/agenda";
    case "navigate_crm":
    case "navigate":
      return workspaceHref;
    case "contact":
      return `/dashboard/whatsapp?c=${encodeURIComponent(snapshot.conversationId)}`;
    default:
      return snapshot.appointment ? "/dashboard/agenda" : workspaceHref;
  }
}

function humanizeOwnershipReason(reason?: string | null): string | null {
  if (!reason || reason === "current") return null;
  const map: Record<string, string> = {
    claim: "Assumiu o atendimento",
    reactivate_ai: "Devolveu à IA",
    handoff: "Transferiu para humano",
    handoff_timeout: "IA reassumiu (tempo sem resposta)",
    bot_loop: "Transferiu por loop da IA",
    tool_failures: "Transferiu após falhas da IA",
    patient_waiting: "Aguardando resposta do paciente",
    system_reminder_due: "Lembrete do sistema",
    assign: "Atribuição manual",
    human_reply: "Resposta humana",
  };
  return map[reason] ?? reason.replace(/_/g, " ");
}

export function CasePanel({
  snapshot,
  onClaim,
  onReactivateAi,
  onSaveNotes,
  claiming,
  reactivating,
  className,
}: CasePanelProps) {
  const [notes, setNotes] = React.useState(snapshot.operatorNotes ?? "");
  const [brief, setBrief] = React.useState("");
  const [showBrief, setShowBrief] = React.useState(false);

  React.useEffect(() => {
    setNotes(snapshot.operatorNotes ?? "");
  }, [snapshot.conversationId, snapshot.operatorNotes]);

  const history = snapshot.ownershipHistory.slice(-8).reverse();
  const workspaceHref = snapshot.journeyCaseId
    ? `/dashboard/crm/jornada/${snapshot.journeyCaseId}`
    : snapshot.phoneNumber
      ? `/dashboard/crm/jornada?phone=${encodeURIComponent(
          snapshot.phoneNumber.replace(/\D/g, "")
        )}`
      : "/dashboard/crm/jornada";

  return (
    <aside
      className={cn(
        "flex flex-col border-l border-border bg-background w-full max-w-[320px] min-w-[280px] h-full overflow-hidden",
        className
      )}
    >
      <div className="px-4 py-3 border-b border-border space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Atendimento
        </p>
        {snapshot.caseLoadWarning && (
          <p className="text-[11px] rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-800 dark:text-amber-200">
            Atendimento temporariamente indisponível — usando projeção de emergência.
          </p>
        )}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn("gap-1 font-medium", ownerBadgeClass(snapshot.owner))}
          >
            <OwnerIcon owner={snapshot.owner} />
            {snapshot.ownerLabel}
          </Badge>
          {snapshot.sla.breached && (
            <Badge variant="destructive" className="text-[10px]">
              SLA
            </Badge>
          )}
        </div>
        {snapshot.sla.dueAt && !snapshot.sla.breached && (
          <p className="text-[11px] text-muted-foreground">
            SLA: {Math.max(0, Math.round((snapshot.sla.secondsRemaining ?? 0) / 60))} min
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Próxima ação</h3>
          {snapshot.pendingDecision ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium">{snapshot.pendingDecision.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {[
                  snapshot.pendingDecision.owner
                    ? `Responsável: ${snapshot.pendingDecision.owner === "human" ? "equipe" : snapshot.pendingDecision.owner}`
                    : null,
                  snapshot.pendingDecision.dueAt
                    ? `Até ${new Date(snapshot.pendingDecision.dueAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Pendência do atendimento"}
              </p>
              {snapshot.pendingDecision.actions[0] && (
                <Button size="sm" variant="secondary" className="h-7 text-xs w-full" asChild>
                  <Link
                    href={actionHref(
                      snapshot.pendingDecision.actions[0].kind,
                      snapshot
                    )}
                  >
                    {snapshot.pendingDecision.actions[0].label}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs w-full" asChild>
                <Link href={workspaceHref}>
                  Abrir Workspace
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Nenhuma decisão pendente.</p>
              <Button size="sm" variant="outline" className="h-7 text-xs w-full" asChild>
                <Link href={workspaceHref}>Abrir Workspace</Link>
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground">Agenda</h3>
          <p className="text-sm">{snapshot.stage || "—"}</p>
          {snapshot.patient && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {snapshot.patient.name}
            </p>
          )}
          {snapshot.appointment && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(snapshot.appointment.scheduledAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {snapshot.appointment.status}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/dashboard/agenda"
              className="text-xs text-primary hover:underline"
            >
              Abrir agenda
            </Link>
            <Link href={workspaceHref} className="text-xs text-primary hover:underline">
              Abrir atendimento
            </Link>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Responsabilidade</h3>
          <ul className="space-y-1.5">
            {history.map((h, i) => {
              const reasonLabel = humanizeOwnershipReason(h.reason);
              return (
                <li key={`${h.at}-${i}`} className="flex gap-2 text-xs">
                  <span className="text-muted-foreground tabular-nums shrink-0 w-12">
                    {new Date(h.at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>
                    <span className="font-medium">{h.ownerLabel}</span>
                    {reasonLabel ? (
                      <span className="block text-muted-foreground">{reasonLabel}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Notas operacionais</h3>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações visíveis para a equipe e a IA…"
            className="min-h-[72px] text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => onSaveNotes(notes)}
          >
            Salvar notas
          </Button>
        </section>

        {snapshot.brief && (
          <section className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground">Brief atual</h3>
            <p className="text-xs rounded-md bg-muted p-2">{snapshot.brief}</p>
          </section>
        )}
      </div>

      <div className="border-t border-border p-3 space-y-2">
        {snapshot.owner !== "human" || !snapshot.canCompose ? (
          <Button className="w-full" size="sm" onClick={onClaim} disabled={claiming}>
            Assumir atendimento
          </Button>
        ) : null}

        {snapshot.owner === "human" && snapshot.canCompose && (
          <>
            {!showBrief ? (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setShowBrief(true)}
              >
                Devolver à IA
              </Button>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="O que você fez / o que a IA deve saber…"
                  className="min-h-[64px] text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowBrief(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={!brief.trim() || reactivating}
                    onClick={() => onReactivateAi(brief.trim())}
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={async () => {
            const res = await fetch("/api/whatsapp/ops/reminder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId: snapshot.conversationId,
                label: "Retornar contato (me chama amanhã)",
              }),
            });
            if (res.ok) {
              window.location.reload();
            }
          }}
        >
          Lembrar amanhã (Sistema)
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          disabled
          title="Em breve"
        >
          Enviar observação (em breve)
        </Button>
      </div>
    </aside>
  );
}
