"use client";

import Link from "next/link";
import type { OperationalProjection, OpsBoardStage, CaseProjectionItem } from "@/lib/operational-journey";
import { BOARD_STAGE_LABELS } from "@/lib/operational-journey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HojeDashboardClient({
  projection,
  firstName,
}: {
  projection: OperationalProjection;
  firstName?: string | null;
}) {
  const { workToday, panorama } = projection;
  const name = firstName?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {greeting()}
            {name ? `, ${name}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            O que precisa ser feito hoje?
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <StatPill
            tone="urgent"
            label="Urgentes"
            value={workToday.urgentCount}
            href="/dashboard/pendencias?filter=urgent"
          />
          <StatPill
            tone="pending"
            label="Pendências"
            value={workToday.pendingCount}
            href="/dashboard/pendencias"
          />
          <StatPill
            tone="ok"
            label="Consultas hoje"
            value={workToday.consultationsTodayCount}
            href="/dashboard/hoje/consultas?stage=hoje"
          />
          {workToday.aiCount > 0 && (
            <StatPill
              tone="ai"
              label="IA"
              value={workToday.aiCount}
              href="/dashboard/pendencias?filter=ai"
            />
          )}
        </div>

        {workToday.byAction.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Continuar trabalho
            </p>
            <div className="flex flex-wrap gap-2">
              {workToday.byAction.slice(0, 6).map((g) => (
                <Button key={g.action} variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/pendencias?action=${encodeURIComponent(g.action)}`}>
                    {g.label}
                    <Badge variant="secondary" className="ml-2">
                      {g.count}
                    </Badge>
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma pendência aberta agora. Bom sinal.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Visão da operação</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PanoramaCard
            title="Contatos"
            href="/dashboard/contatos/leads"
            rows={[
              { label: "Novo", count: panorama.contatos.novo },
              { label: "Qualificação", count: panorama.contatos.qualificacao },
              { label: "Qualificado", count: panorama.contatos.qualificado },
              { label: "Perdido", count: panorama.contatos.perdido },
            ]}
          />
          <PanoramaCard
            title="Agendamentos"
            href="/dashboard/hoje/agendamentos"
            rows={[
              { label: "Agendar", count: panorama.agendamentos.agendar },
              { label: "Reagendar", count: panorama.agendamentos.reagendar },
            ]}
          />
          <PanoramaCard
            title="Consultas"
            href="/dashboard/hoje/consultas"
            rows={[
              { label: "Confirmar", count: panorama.consultas.confirmar },
              { label: "Hoje", count: panorama.consultas.hoje },
              { label: "Em atendimento", count: panorama.consultas.em_atendimento },
              { label: "Realizada", count: panorama.consultas.realizada },
              { label: "Falta", count: panorama.consultas.falta },
            ]}
          />
          <PanoramaCard
            title="Pacientes"
            href="/dashboard/hoje/pacientes"
            rows={[
              { label: "Pós-consulta", count: panorama.pacientes.pos_consulta },
              { label: "Tratamentos", count: panorama.pacientes.tratamento },
              { label: "Retornos", count: panorama.pacientes.retorno },
              { label: "Reativações", count: panorama.pacientes.reativacao },
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function StatPill({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "urgent" | "pending" | "ok" | "ai";
}) {
  const toneClass =
    tone === "urgent"
      ? "border-red-200 bg-red-50 text-red-900"
      : tone === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : tone === "ai"
          ? "border-sky-200 bg-sky-50 text-sky-950"
          : "border-emerald-200 bg-emerald-50 text-emerald-950";
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:opacity-90",
        toneClass
      )}
    >
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="opacity-80">{label}</span>
    </Link>
  );
}

function PanoramaCard({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: { label: string; count: number }[];
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/40"
    >
      <p className="text-sm font-semibold text-foreground mb-3">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium tabular-nums text-foreground">{r.count}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

export function OpsBoardClient({
  title,
  description,
  columns,
  items,
}: {
  title: string;
  description?: string;
  columns: OpsBoardStage[];
  items: CaseProjectionItem[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((stage) => {
          const cards = items.filter((i) => i.boardStage === stage);
          return (
            <div
              key={stage}
              className="w-64 shrink-0 rounded-lg border border-border bg-muted/20 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">{BOARD_STAGE_LABELS[stage]}</span>
                <Badge variant="secondary">{cards.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {cards.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1">Nenhum item</p>
                )}
                {cards.map((c) => (
                  <Link
                    key={c.caseId}
                    href={c.href}
                    className="block rounded-md border border-border bg-background p-3 hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium truncate">{c.displayName}</p>
                    {c.nextDecision && (
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            c.nextDecision.urgent ? "bg-red-500" : "bg-amber-500"
                          )}
                        />
                        {c.nextDecision.label}
                        {c.decider === "ai" && (
                          <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                            IA
                          </Badge>
                        )}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PendenciasClient({
  items,
  actionFilter,
  filter,
}: {
  items: CaseProjectionItem[];
  actionFilter?: string | null;
  filter?: string | null;
}) {
  let list = items;
  if (filter === "urgent") list = list.filter((i) => i.nextDecision?.urgent);
  if (filter === "ai") list = list.filter((i) => i.decider === "ai" || i.ownerType === "ai");
  if (actionFilter) list = list.filter((i) => i.nextDecision?.action === actionFilter);

  const byAction = new Map<string, CaseProjectionItem[]>();
  for (const item of list) {
    const action = item.nextDecision?.action ?? "outro";
    const arr = byAction.get(action) ?? [];
    arr.push(item);
    byAction.set(action, arr);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Tudo que alguém precisa fazer agora — por pessoa.
      </p>

      {list.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma pendência no momento.
        </p>
      )}

      {[...byAction.entries()].map(([action, people]) => (
        <section key={action} className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {people[0]?.nextDecision?.label ?? action}
            <span className="ml-2 text-muted-foreground font-normal">({people.length})</span>
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {people.map((p) => (
              <li key={p.caseId}>
                <Link
                  href={p.href}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.displayName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.nextDecision?.label}
                      {p.decider === "ai" && " · IA"}
                      {p.decider === "patient" && " · Aguardando paciente"}
                    </p>
                  </div>
                  {p.nextDecision?.urgent && (
                    <Badge variant="destructive" className="shrink-0">
                      Urgente
                    </Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
