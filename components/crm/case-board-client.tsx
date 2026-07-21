"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestCasePhaseOverride } from "@/app/dashboard/crm/jornada/case-actions";
import type {
  BoardPayload,
  BoardView,
  CasePhase,
  PipelineCard,
} from "@/app/dashboard/crm/jornada/case-types";
import { CASE_PHASE_LABELS } from "@/lib/case-management";

const VIEWS: { id: BoardView; label: string }[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "comparecimento", label: "Comparecimento" },
  { id: "financeiro", label: "Financeiro" },
  { id: "ia", label: "IA" },
  { id: "pendencias", label: "Pendências" },
];

function CaseCard({ card }: { card: PipelineCard }) {
  return (
    <Link
      href={`/dashboard/crm/jornada/${card.case.id}`}
      className="block rounded-lg border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <p className="text-sm font-medium truncate">{card.displayName}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{card.objective}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {card.case.pending_decision && (
          <Badge variant="outline" className="text-[10px]">
            Aguarda: {card.case.pending_decision.actor_role}
          </Badge>
        )}
        {card.openTaskCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {card.openTaskCount} task{card.openTaskCount > 1 ? "s" : ""}
          </Badge>
        )}
        {(card.case.owner === "ai" || card.case.owner.startsWith("ai:")) && (
          <Badge className="text-[10px]">IA</Badge>
        )}
      </div>
    </Link>
  );
}

function PhaseColumn({
  title,
  cards,
  phase,
  onDrop,
}: {
  title: string;
  cards: PipelineCard[];
  phase?: CasePhase;
  onDrop?: (caseId: string, phase: CasePhase) => void;
}) {
  return (
    <div
      className="min-w-[220px] flex-1 rounded-xl border bg-muted/30 p-2"
      onDragOver={(e) => {
        if (phase && onDrop) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!phase || !onDrop) return;
        e.preventDefault();
        const caseId = e.dataTransfer.getData("text/case-id");
        if (caseId) onDrop(caseId, phase);
      }}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">{cards.length}</span>
      </div>
      <div className="space-y-2">
        {cards.map((card) => (
          <div
            key={card.case.id}
            draggable={!!phase && !!onDrop}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/case-id", card.case.id);
            }}
          >
            <CaseCard card={card} />
          </div>
        ))}
        {cards.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Vazio</p>
        )}
      </div>
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

  function changeView(next: BoardView) {
    setView(next);
    router.push(`/dashboard/crm/jornada?view=${next}`);
  }

  function handleDrop(caseId: string, phase: CasePhase) {
    startTransition(async () => {
      setError(null);
      const res = await requestCasePhaseOverride(caseId, phase, "board_dnd");
      if (!res.ok) setError(res.error ?? "Falha ao mover");
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
            onClick={() => changeView(v.id)}
          >
            {v.label}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {pending && <p className="text-xs text-muted-foreground">Atualizando…</p>}

      {view === "pipeline" && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {initial.pipeline.columns.map((col) => (
            <PhaseColumn
              key={col.phase}
              title={col.label}
              cards={col.cards}
              phase={col.phase}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {view === "comparecimento" && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {initial.attendance.columns.map((col) => (
            <PhaseColumn key={col.status} title={col.label} cards={col.cards} />
          ))}
        </div>
      )}

      {view === "financeiro" && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {initial.finance.columns.map((col) => (
            <PhaseColumn key={col.key} title={col.label} cards={col.cards} />
          ))}
        </div>
      )}

      {view === "ia" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {initial.aiQueue.cards.map((card) => (
            <CaseCard key={card.case.id} card={card} />
          ))}
          {initial.aiQueue.cards.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum case com owner IA.</p>
          )}
        </div>
      )}

      {view === "pendencias" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {initial.pendingQueue.cards.map((card) => (
            <CaseCard key={card.case.id} card={card} />
          ))}
          {initial.pendingQueue.cards.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem pendências de decisão.</p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Fases do pipeline: {Object.values(CASE_PHASE_LABELS).join(" · ")}. Arrastar no
        Pipeline publica <code className="text-[10px]">Case.OverrideRequested</code> — a
        Transition materializa a phase.
      </p>
    </div>
  );
}
