"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  HeartPulse,
  Inbox,
  Sparkles,
  Stethoscope,
  Users,
  Zap,
} from "lucide-react";
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
import { SegmentedTabs } from "@/components/dashboard-ui/layout/segmented-tabs";
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

function caseHref(item: CaseProjectionItem, area: HojeArea | null): string {
  const base = `/dashboard/crm/jornada/${item.caseId}`;
  const q = new URLSearchParams();
  q.set("from", "hoje");
  if (area) q.set("area", area);
  return `${base}?${q.toString()}`;
}

const HOJE_AREAS: HojeArea[] = ["pessoas", "agenda", "atendimentos", "pacientes"];

const AREA_ICONS: Record<HojeArea, typeof Users> = {
  pessoas: Users,
  agenda: CalendarDays,
  atendimentos: Stethoscope,
  pacientes: HeartPulse,
};

const easeOut = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

function SectionLabel({
  icon: Icon,
  title,
  hint,
  count,
}: {
  icon: typeof Sparkles;
  title: string;
  hint: string;
  count?: number;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="text-[12px] text-muted-foreground leading-snug">{hint}</p>
        </div>
      </div>
      {typeof count === "number" && count > 0 && (
        <span className="tabular-nums text-[11px] font-medium text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );
}

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

  const [activeArea, setActiveArea] = useState<HojeArea>(
    initialContext?.area ?? "pessoas"
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
    if (initialContext?.caseId || initialContext?.area) {
      operacaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialContext?.area, initialContext?.stage, initialContext?.focus, initialContext?.caseId]);

  function openContext(
    ctx: HojeActionContext,
    scrollTo: "operacao" | "atencao" | "inbox" | "acoes" = "operacao"
  ) {
    if (ctx.area) setActiveArea(ctx.area);
    if (ctx.stage !== undefined) setFocusStage(ctx.stage ?? null);
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
  const primary = atencao[0] ?? null;

  const areaTabs = HOJE_AREAS.map((area) => ({
    id: area,
    label: PANORAMA_SLICE_LABELS[area],
    count: areaTotal(area, panorama),
    icon: AREA_ICONS[area],
  }));

  const boardItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.panoramaSlice === activeArea ||
          AREA_COLUMNS[activeArea].includes(i.boardStage as OpsBoardStage)
      ),
    [items, activeArea]
  );

  return (
    <div className="relative">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-6 h-64 sm:-inset-x-6"
      >
        <div className="absolute inset-0 gradient-mesh opacity-90" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative space-y-10">
        {/* Hero */}
        <motion.header
          {...fadeUp}
          transition={{ duration: 0.5, ease: easeOut }}
          className="space-y-1 pt-1"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary/80">
            Hoje
          </p>
          <h2 className="text-[1.75rem] sm:text-[2rem] font-semibold tracking-tight text-foreground leading-[1.15]">
            {greeting()}
            {name ? (
              <>
                , <span className="text-primary">{name}</span>
              </>
            ) : (
              ""
            )}
          </h2>
          <p className="max-w-md text-[13px] text-muted-foreground leading-relaxed">
            {primary
              ? `${atencao.length} decisão${atencao.length === 1 ? "" : "ões"} na fila · comece pelo mais importante`
              : "Nada urgente. Escolha uma lente e trabalhe no seu ritmo."}
          </p>
        </motion.header>

        {/* 1. Atenção */}
        <motion.section
          ref={atencaoRef}
          id="atencao"
          className="scroll-mt-6 space-y-3"
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.06, ease: easeOut }}
        >
          <SectionLabel
            icon={Sparkles}
            title="Atenção"
            hint="O que precisa da sua decisão agora"
            count={atencao.length}
          />

          {shownAtencao.length === 0 ? (
            <EmptyCalm
              icon={CheckCircle2}
              title="Tudo em dia"
              subtitle="Ninguém esperando decisão sua agora."
            />
          ) : (
            <div className="space-y-2">
              {shownAtencao.map((p, i) => {
                const isHero = i === 0 && !showAllAtencao;
                return (
                  <motion.button
                    key={p.caseId}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.04 * i, ease: easeOut }}
                    onClick={() => {
                      const ctx = actionToHojeContext(
                        p.nextDecision?.action ?? "confirm_slot",
                        p.caseId
                      );
                      openContext(ctx);
                    }}
                    className={cn(
                      "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl text-left transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isHero
                        ? "border border-primary/20 bg-card p-4 shadow-[0_0_0_1px_hsl(var(--primary)/0.06),0_8px_30px_-12px_hsl(var(--primary)/0.35)] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_12px_36px_-10px_hsl(var(--primary)/0.4)] hover:-translate-y-0.5"
                        : "border border-border/60 bg-card/80 px-4 py-3 shadow-sm hover:bg-card hover:border-border hover:-translate-y-px"
                    )}
                  >
                    {isHero && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-primary via-primary/70 to-primary/20"
                      />
                    )}
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        p.nextDecision?.urgent
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "font-medium tracking-tight truncate",
                          isHero ? "text-[15px]" : "text-sm"
                        )}
                      >
                        {p.nextDecision?.label ?? "Decidir"}
                        {p.displayName ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {p.displayName}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground truncate">
                        {p.nextDecision?.reason
                          ? p.nextDecision.reason
                          : formatWhen(p.scheduledAt) ?? p.stage}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.nextDecision?.urgent && (
                        <Badge variant="destructive" className="rounded-full px-2">
                          Urgente
                        </Badge>
                      )}
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {!showAllAtencao && atencao.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowAllAtencao(true)}
            >
              Ver mais {atencao.length - 5}
            </Button>
          )}
        </motion.section>

        {/* 2. Caixa de entrada */}
        <motion.section
          ref={inboxRef}
          id="inbox"
          className="scroll-mt-6 space-y-3"
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}
        >
          <SectionLabel
            icon={Inbox}
            title="Caixa de entrada"
            hint="Eventos novos que chegaram"
            count={caixaEntrada.length}
          />

          {shownInbox.length === 0 ? (
            <p className="px-1 text-[13px] text-muted-foreground">Nada novo por aqui.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-dashed border-border/80 bg-muted/20">
              <ul className="divide-y divide-border/50">
                {shownInbox.map((p) => (
                  <li key={`inbox-${p.caseId}`}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-background/70"
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
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.displayName}</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
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
                      <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground/60" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!showAllInbox && caixaEntrada.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowAllInbox(true)}
            >
              Ver mais {caixaEntrada.length - 5}
            </Button>
          )}
        </motion.section>

        {/* 3. Ações */}
        <motion.section
          ref={acoesRef}
          id="acoes"
          className="scroll-mt-6 space-y-3"
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.14, ease: easeOut }}
        >
          <SectionLabel
            icon={Zap}
            title="Ações"
            hint="Atalhos para executar agora"
          />

          {quickActions.length === 0 ? (
            <p className="px-1 text-[13px] text-muted-foreground">Nenhum atalho no momento.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {quickActions.map((g) => {
                const ctx = actionToHojeContext(g.action);
                return (
                  <button
                    key={g.action}
                    type="button"
                    onClick={() => openContext(ctx)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-2",
                      "text-[13px] font-medium tracking-tight shadow-sm",
                      "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    {g.label}
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold tabular-nums text-primary">
                      {g.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* 4. Operação — um kanban, abas por lente */}
        <motion.section
          ref={operacaoRef}
          id="operacao"
          className="scroll-mt-6 space-y-3 pb-4"
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.18, ease: easeOut }}
        >
          <SectionLabel
            icon={Stethoscope}
            title="Operação"
            hint="Um board · troque a lente pelas abas"
          />

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="border-b border-border/60 bg-muted/20 px-2 pt-2 sm:px-3">
              <SegmentedTabs
                tabs={areaTabs}
                value={activeArea}
                onChange={(id) => {
                  const area = id as HojeArea;
                  setActiveArea(area);
                  setFocusStage(null);
                  syncUrl({ area });
                }}
                variant="pill"
                className="pb-2"
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-2.5">
              <p className="text-[12px] text-muted-foreground truncate">
                {AREA_HINTS[activeArea]}
              </p>
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                {areaTotal(activeArea, panorama)} itens
              </span>
            </div>

            <div className="bg-muted/10 p-3">
              <OpsBoardInline
                columns={AREA_COLUMNS[activeArea]}
                items={boardItems}
                focusStage={focusStage}
                highlightCaseId={initialContext?.caseId ?? null}
                onOpenCase={(item) => {
                  router.push(caseHref(item, activeArea));
                }}
              />
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function EmptyCalm({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof CheckCircle2;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 px-5 py-8 text-center shadow-sm">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_65%)]"
      />
      <div className="relative space-y-2">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium tracking-tight">{title}</p>
        <p className="text-[12px] text-muted-foreground">{subtitle}</p>
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
              "w-[15.5rem] shrink-0 rounded-xl border p-2.5 transition-colors",
              focused
                ? "border-primary/30 bg-primary/[0.06]"
                : "border-border/50 bg-background/80"
            )}
          >
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold tracking-tight">
                {BOARD_STAGE_LABELS[stage]}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {cards.length}
              </span>
            </div>
            <div className="space-y-1.5 max-h-[48vh] overflow-y-auto">
              {cards.length === 0 && (
                <p className="px-2 py-4 text-center text-[11px] text-muted-foreground/80">
                  Vazio
                </p>
              )}
              {cards.map((c) => (
                <button
                  key={c.caseId}
                  type="button"
                  onClick={() => onOpenCase(c)}
                  className={cn(
                    "block w-full rounded-lg border bg-card p-2.5 text-left transition-all",
                    "hover:border-primary/25 hover:shadow-sm",
                    highlightCaseId === c.caseId
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border/40"
                  )}
                >
                  <p className="text-[13px] font-medium truncate">{c.displayName}</p>
                  {c.nextDecision && (
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">
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
