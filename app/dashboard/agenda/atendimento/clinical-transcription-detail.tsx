"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClinicalSummary, DialogueTurn } from "@/lib/clinical-transcription/types";

type DetailTab = "transcricao" | "dialogo" | "resumo";

function SummarySection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="list-disc pl-5 text-sm space-y-0.5">
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ClinicalTranscriptionDetail({
  transcript,
  liveTranscript,
  dialogue,
  clinicalSummary,
  postProcessingStatus,
  postProcessingError,
}: {
  transcript: string | null;
  liveTranscript?: string | null;
  dialogue: DialogueTurn[] | null;
  clinicalSummary: ClinicalSummary | null;
  postProcessingStatus?: string | null;
  postProcessingError?: string | null;
}) {
  const [tab, setTab] = useState<DetailTab>("transcricao");
  const text = transcript ?? liveTranscript ?? "";

  const tabs: { id: DetailTab; label: string; disabled?: boolean }[] = [
    { id: "transcricao", label: "Transcrição" },
    {
      id: "dialogo",
      label: "Diálogo",
      disabled: !dialogue?.length && postProcessingStatus !== "processing" && postProcessingStatus !== "pending",
    },
    {
      id: "resumo",
      label: "Resumo clínico",
      disabled: !clinicalSummary && postProcessingStatus !== "processing" && postProcessingStatus !== "pending",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              tab === item.id ? "bg-primary text-primary-foreground border-primary" : "bg-background",
              item.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {item.label}
          </button>
        ))}
        {postProcessingStatus === "processing" || postProcessingStatus === "pending" ? (
          <Badge variant="outline" className="text-[10px]">
            Gerando relatório…
          </Badge>
        ) : null}
        {postProcessingStatus === "failed" && postProcessingError ? (
          <Badge variant="destructive" className="text-[10px]">
            Relatório falhou
          </Badge>
        ) : null}
      </div>

      {tab === "transcricao" && text ? (
        <Textarea readOnly value={text} className="min-h-[120px] resize-y bg-muted/30" />
      ) : null}

      {tab === "dialogo" && dialogue?.length ? (
        <div className="space-y-2 max-h-[360px] overflow-y-auto rounded-md border bg-muted/20 p-3">
          {dialogue.map((turn) => (
            <div key={`${turn.ordem}-${turn.text.slice(0, 24)}`} className="text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                {turn.role === "medico"
                  ? "Médico"
                  : turn.role === "paciente"
                    ? "Paciente"
                    : turn.speaker_label}
              </p>
              <p>{turn.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "resumo" && clinicalSummary ? (
        <div className="space-y-4 rounded-md border bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Relatório gerado por IA — revise antes de usar clinicamente. Confiança:{" "}
            {clinicalSummary.confianca}
          </p>
          {clinicalSummary.avisos.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs">
              {clinicalSummary.avisos.join(" ")}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resumo da consulta
            </p>
            <p>{clinicalSummary.resumo_consulta}</p>
          </div>
          <SummarySection title="Principais queixas" items={clinicalSummary.principais_queixas} />
          <SummarySection title="Sintomas citados" items={clinicalSummary.sintomas_citados} />
          <SummarySection title="Perguntas do médico" items={clinicalSummary.perguntas_medico} />
          <SummarySection title="Respostas do paciente" items={clinicalSummary.respostas_paciente} />
          <SummarySection title="Dores relatadas" items={clinicalSummary.dores_relatadas} />
          <SummarySection title="Reclamações" items={clinicalSummary.reclamacoes} />
          {clinicalSummary.evolucao_quadro ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Evolução do quadro
              </p>
              <p>{clinicalSummary.evolucao_quadro}</p>
            </div>
          ) : null}
          <SummarySection title="Condutas mencionadas" items={clinicalSummary.condutas_mencionadas} />
          <SummarySection title="Medicamentos citados" items={clinicalSummary.medicamentos_citados} />
          <SummarySection title="Exames solicitados" items={clinicalSummary.exames_solicitados} />
          <SummarySection
            title="Retornos e acompanhamentos"
            items={clinicalSummary.retornos_acompanhamentos}
          />
          <SummarySection
            title="Outros pontos relevantes"
            items={clinicalSummary.outros_pontos_relevantes}
          />
        </div>
      ) : null}

      {tab !== "transcricao" &&
        (postProcessingStatus === "processing" || postProcessingStatus === "pending") && (
          <p className="text-sm text-muted-foreground">Processando relatório clínico…</p>
        )}

      {postProcessingStatus === "failed" && postProcessingError ? (
        <p className="text-sm text-destructive">{postProcessingError}</p>
      ) : null}
    </div>
  );
}
