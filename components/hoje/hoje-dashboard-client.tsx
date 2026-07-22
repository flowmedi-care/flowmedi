"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  CaseProjectionItem,
  OperationalProjection,
  OpsBoardStage,
  PanoramaCounts,
} from "@/lib/operational-journey";
import {
  AREA_COLUMNS,
  AREA_HINTS,
  BOARD_STAGE_LABELS,
  PANORAMA_SLICE_LABELS,
  actionToHojeContext,
  buildHojeHref,
  type HojeActionContext,
  type HojeArea,
} from "@/lib/operational-journey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function areaTotal(area: HojeArea, p: PanoramaCounts): number {
  if (area === "pessoas") {
    const c = p.pessoas;
    return c.novo + c.qualificacao + c.qualificado + c.cliente + c.perdido;
  }
  if (area === "agenda") return p.agenda.agendar + p.agenda.reagendar;
  if (area === "atendimentos") {
    const c = p.atendimentos;
    return c.confirmar + c.hoje + c.em_atendimento + c.realizada + c.falta;
  }
  const x = p.pacientes;
  return x.pos_consulta + x.tratamento + x.retorno + x.reativacao;
}

function areaRows(area: HojeArea, p: PanoramaCounts): { label: string; count: number }[] {
  if (area === "pessoas") {
    return [
      { label: "Novo", count: p.pessoas.novo },
      { label: "Em conversa", count: p.pessoas.qualificacao },
      { label: "Oportunidade", count: p.pessoas.qualificado },
      { label: "Cliente", count: p.pessoas.cliente },
    ];
  }
  if (area === "agenda") {
    return [
      { label: "Agendar", count: p.agenda.agendar },
      { label: "Reagendar", count: p.agenda.reagendar },
    ];
  }
  if (area === "atendimentos") {
    return [
      { label: "Confirmar", count: p.atendimentos.confirmar },
      { label: "Hoje", count: p.atendimentos.hoje },
      { label: "Realizada", count: p.atendimentos.realizada },
    ];
  }
  return [
    { label: "Pós-consulta", count: p.pacientes.pos_consulta },
    { label: "Tratamentos", count: p.pacientes.tratamento },
    { label: "Retornos", count: p.pacientes.retorno },
  ];
}

function caseHref(item: CaseProjectionItem, area: HojeArea | null): string {
  const base = `/dashboard/crm/jornada/${item.caseId}`;
  const q = new URLSearchParams();
  q.set("from", "hoje");
  if (area) q.set("area", area);
  return `${base}?${q.toString()}`;
}

const HOJE_AREAS: HojeArea[] = ["pessoas", "agenda", "atendimentos", "pacientes"];

export function HojeDashboardClient({
  projection,
  firstName,
  initialContext,
}: {
  projection: OperationalProjection;
  firstName?: string | null;
  initialContext?: HojeActionContext;
}) {
  const router = useRouter();
  const { workToday, panorama, atencao, caixaEntrada, items } = projection;
  const name = firstName?.trim().split(/\s+/)[0];

  const [activeArea, setActiveArea] = useState<HojeArea | null>(
    initialContext?.area ?? null
  );
  const [focusStage, setFocusStage] = useState<string | null>(
    initialContext?.stage ?? null
  );
  const [showAllAtencao, setShowAllAtencao] = useState(false);
  const [showAllInbox, setShowAllInbox] = useState(false);
  const operacaoRef = useRef<HTMLElement | null>(null);
  const atencaoRef = useRef<HTMLElement | null>(null);
  const inboxRef = useRef<HTMLElement | null>(null);
  const acoesRef = useRef<HTMLElement | null>(null);

  const syncUrl = useCallback(
    (ctx: HojeActionContext) => {
      router.replace(buildHojeHref(ctx), { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    if (initialContext?.area) setActiveArea(initialContext.area);
    if (initialContext?.stage) setFocusStage(initialContext.stage);
    if (initialContext?.focus === "atencao" || initialContext?.focus === "pendencias") {
      atencaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (initialContext?.focus === "inbox") {
      inboxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (initialContext?.caseId) {
      operacaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialContext?.area, initialContext?.stage, initialContext?.focus, initialContext?.caseId]);

  function openContext(
    ctx: HojeActionContext,
    scrollTo: "operacao" | "atencao" | "inbox" | "acoes" = "operacao"
  ) {
    if (ctx.area) setActiveArea(ctx.area);
    if (ctx.stage) setFocusStage(ctx.stage ?? null);
    const focus =
      scrollTo === "atencao"
        ? ("atencao" as const)
        : scrollTo === "inbox"
          ? ("inbox" as const)
          : scrollTo === "acoes"
            ? ("pendencias" as const)
            : null;
    syncUrl({
      area: ctx.area ?? activeArea,
      stage: ctx.stage ?? focusStage,
      caseId: ctx.caseId,
      focus: ctx.focus ?? focus,
    });
    requestAnimationFrame(() => {
      if (scrollTo === "atencao") {
        atencaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (scrollTo === "inbox") {
        inboxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (scrollTo === "acoes") {
        acoesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        operacaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  const shownAtencao = showAllAtencao ? atencao : atencao.slice(0, 5);
  const shownInbox = showAllInbox ? caixaEntrada : caixaEntrada.slice(0, 5);
  const quickActions = workToday.byAction.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Fila inteligente de decisões — o que precisa da sua atenção agora
        </p>
      </div>

      {/* 1. Atenção — sistema priorizou */}
      <section ref={atencaoRef} id="atencao" className="space-y-3 scroll-mt-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Atenção
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Coisas que precisam da sua decisão
          </p>
        </div>
        {shownAtencao.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Ninguém esperando decisão sua agora. Bom sinal.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {shownAtencao.map((p) => (
              <li key={p.caseId}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                  onClick={() => {
                    const ctx = actionToHojeContext(
                      p.nextDecision?.action ?? "confirm_slot",
                      p.caseId
                    );
                    openContext(ctx);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.nextDecision?.label ?? "Decidir"}
                      {p.displayName ? ` · ${p.displayName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.nextDecision?.reason
                        ? p.nextDecision.reason
                        : formatWhen(p.scheduledAt) ?? p.stage}
                    </p>
                  </div>
                  {p.nextDecision?.urgent && (
                    <Badge variant="destructive" className="shrink-0">
                      Urgente
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!showAllAtencao && atencao.length > 5 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAllAtencao(true)}>
            Ver mais {atencao.length - 5}
          </Button>
        )}
      </section>

      {/* 2. Caixa de entrada — eventos novos */}
      <section ref={inboxRef} id="inbox" className="space-y-3 scroll-mt-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Caixa de entrada
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Eventos novos que chegaram
          </p>
        </div>
        {shownInbox.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">Nada novo por aqui.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border border-dashed">
            {shownInbox.map((p) => (
              <li key={`inbox-${p.caseId}`}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                  onClick={() => {
                    if (p.nextDecision) {
                      openContext(
                        actionToHojeContext(p.nextDecision.action, p.caseId)
                      );
                    } else {
                      openContext({ area: p.panoramaSlice, caseId: p.caseId });
                    }
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.displayName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.nextDecision
                        ? `${p.nextDecision.label} · aguardando ${
                            p.nextDecision.actor === "patient"
                              ? "paciente"
                              : p.nextDecision.actor === "ai"
                                ? "IA"
                                : "sistema"
                          }`
                        : `Novo · ${p.stage}`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!showAllInbox && caixaEntrada.length > 5 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAllInbox(true)}>
            Ver mais {caixaEntrada.length - 5}
          </Button>
        )}
      </section>

      {/* 3. Ações — atalhos executáveis */}
      <section ref={acoesRef} id="acoes" className="space-y-3 scroll-mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Ações
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Até 5 atalhos executáveis</p>
          </div>
        </div>
        {quickActions.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">Nenhum atalho no momento.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {quickActions.map((g) => {
              const ctx = actionToHojeContext(g.action);
              return (
                <Button
                  key={g.action}
                  size="sm"
                  variant="outline"
                  onClick={() => openContext(ctx)}
                >
                  {g.label}
                  <Badge variant="secondary" className="ml-2">
                    {g.count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Operação — lentes */}
      <section ref={operacaoRef} id="operacao" className="space-y-3 scroll-mt-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Operação
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lentes — escolha onde trabalhar agora
          </p>
        </div>
        <div className="space-y-2">
          {HOJE_AREAS.map((area) => (
            <OperationModuleCard
              key={area}
              area={area}
              total={areaTotal(area, panorama)}
              rows={areaRows(area, panorama)}
              hint={AREA_HINTS[area]}
              expanded={activeArea === area}
              focusStage={activeArea === area ? focusStage : null}
              items={items.filter(
                (i) =>
                  i.panoramaSlice === area ||
                  AREA_COLUMNS[area].includes(i.boardStage as OpsBoardStage)
              )}
              highlightCaseId={initialContext?.caseId ?? null}
              onToggle={() => {
                if (activeArea === area) {
                  setActiveArea(null);
                  setFocusStage(null);
                  syncUrl({});
                } else {
                  openContext({ area, stage: focusStage });
                }
              }}
              onOpenCase={(item) => {
                router.push(caseHref(item, area));
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function OperationModuleCard({
  area,
  total,
  rows,
  hint,
  expanded,
  focusStage,
  items,
  highlightCaseId,
  onToggle,
  onOpenCase,
}: {
  area: HojeArea;
  total: number;
  rows: { label: string; count: number }[];
  hint: string;
  expanded: boolean;
  focusStage: string | null;
  items: CaseProjectionItem[];
  highlightCaseId: string | null;
  onToggle: () => void;
  onOpenCase: (item: CaseProjectionItem) => void;
}) {
  const columns = AREA_COLUMNS[area];

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wide">
              {PANORAMA_SLICE_LABELS[area]}
            </span>
            <Badge variant="secondary">{total}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {hint}
            {rows.length > 0 &&
              ` · ${rows
                .filter((r) => r.count > 0)
                .slice(0, 2)
                .map((r) => `${r.label} ${r.count}`)
                .join(" · ")}`}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-foreground/15 bg-background shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left bg-muted/30 hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wide">
              {PANORAMA_SLICE_LABELS[area]}
            </span>
            <Badge variant="secondary">{total}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <div className="p-3 border-t border-border">
        <OpsBoardInline
          columns={columns}
          items={items}
          focusStage={focusStage}
          highlightCaseId={highlightCaseId}
          onOpenCase={onOpenCase}
        />
      </div>
    </div>
  );
}

function OpsBoardInline({
  columns,
  items,
  focusStage,
  highlightCaseId,
  onOpenCase,
}: {
  columns: OpsBoardStage[];
  items: CaseProjectionItem[];
  focusStage: string | null;
  highlightCaseId: string | null;
  onOpenCase: (item: CaseProjectionItem) => void;
}) {
  const ordered = useMemo(() => {
    if (!focusStage) return columns;
    const rest = columns.filter((c) => c !== focusStage);
    if (columns.includes(focusStage as OpsBoardStage)) {
      return [focusStage as OpsBoardStage, ...rest];
    }
    return columns;
  }, [columns, focusStage]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {ordered.map((stage) => {
        const cards = items.filter((i) => i.boardStage === stage);
        const focused = focusStage === stage;
        return (
          <div
            key={stage}
            className={cn(
              "w-60 shrink-0 rounded-lg border p-3",
              focused ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{BOARD_STAGE_LABELS[stage]}</span>
              <Badge variant="secondary">{cards.length}</Badge>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {cards.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">Nenhum item</p>
              )}
              {cards.map((c) => (
                <button
                  key={c.caseId}
                  type="button"
                  onClick={() => onOpenCase(c)}
                  className={cn(
                    "block w-full rounded-md border bg-background p-3 text-left hover:bg-muted/50",
                    highlightCaseId === c.caseId
                      ? "border-primary ring-1 ring-primary/30"
                      : "border-border"
                  )}
                >
                  <p className="text-sm font-medium truncate">{c.displayName}</p>
                  {c.nextDecision && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.nextDecision.label}
                      {c.nextDecision.reason ? ` · ${c.nextDecision.reason}` : ""}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
