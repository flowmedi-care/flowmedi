export type TranscriptionMode = "batch" | "streaming";

export type PostProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  is_final: boolean;
  segment_index?: number;
};

export type DialogueRole = "medico" | "paciente" | "outro" | "indefinido";

export type DialogueTurn = {
  ordem: number;
  speaker_label: string;
  role: DialogueRole;
  text: string;
  start_seconds?: number;
  end_seconds?: number;
  confidence?: number;
};

export type ClinicalSummaryConfidence = "alta" | "media" | "baixa";

export type ClinicalSummary = {
  resumo_consulta: string;
  principais_queixas: string[];
  sintomas_citados: string[];
  perguntas_medico: string[];
  respostas_paciente: string[];
  dores_relatadas: string[];
  reclamacoes: string[];
  evolucao_quadro: string;
  condutas_mencionadas: string[];
  medicamentos_citados: string[];
  exames_solicitados: string[];
  retornos_acompanhamentos: string[];
  outros_pontos_relevantes: string[];
  confianca: ClinicalSummaryConfidence;
  avisos: string[];
};

export type TranscriptionRecordFull = {
  id: string;
  status: string;
  transcription_mode: TranscriptionMode;
  transcript: string | null;
  live_transcript: string | null;
  transcript_segments: TranscriptSegment[] | null;
  dialogue: DialogueTurn[] | null;
  clinical_summary: ClinicalSummary | null;
  post_processing_status: PostProcessingStatus | null;
  post_processing_error: string | null;
  stream_session_id: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  processing_time_seconds: number | null;
  created_at: string;
  completed_at: string | null;
  summarized_at: string | null;
};

export type StreamSessionResponse = {
  session_id: string;
  ws_url: string;
  ws_token: string;
  expires_at: string;
};

export type StreamSessionArtifact = {
  status: "active" | "completed" | "failed";
  full_text?: string | null;
  duration_seconds?: number | null;
  segments?: TranscriptSegment[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parseClinicalSummary(value: unknown): ClinicalSummary | null {
  if (!isRecord(value)) return null;
  const confianca = value.confianca;
  if (confianca !== "alta" && confianca !== "media" && confianca !== "baixa") {
    return null;
  }
  return {
    resumo_consulta: typeof value.resumo_consulta === "string" ? value.resumo_consulta : "",
    principais_queixas: asStringArray(value.principais_queixas),
    sintomas_citados: asStringArray(value.sintomas_citados),
    perguntas_medico: asStringArray(value.perguntas_medico),
    respostas_paciente: asStringArray(value.respostas_paciente),
    dores_relatadas: asStringArray(value.dores_relatadas),
    reclamacoes: asStringArray(value.reclamacoes),
    evolucao_quadro: typeof value.evolucao_quadro === "string" ? value.evolucao_quadro : "",
    condutas_mencionadas: asStringArray(value.condutas_mencionadas),
    medicamentos_citados: asStringArray(value.medicamentos_citados),
    exames_solicitados: asStringArray(value.exames_solicitados),
    retornos_acompanhamentos: asStringArray(value.retornos_acompanhamentos),
    outros_pontos_relevantes: asStringArray(value.outros_pontos_relevantes),
    confianca,
    avisos: asStringArray(value.avisos),
  };
}

export function parseDialogue(value: unknown): DialogueTurn[] | null {
  if (!Array.isArray(value)) return null;
  const turns: DialogueTurn[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const role = item.role;
    if (
      role !== "medico" &&
      role !== "paciente" &&
      role !== "outro" &&
      role !== "indefinido"
    ) {
      continue;
    }
    turns.push({
      ordem: typeof item.ordem === "number" ? item.ordem : turns.length + 1,
      speaker_label:
        typeof item.speaker_label === "string" ? item.speaker_label : "Participante",
      role,
      text: typeof item.text === "string" ? item.text : "",
      start_seconds:
        typeof item.start_seconds === "number" ? item.start_seconds : undefined,
      end_seconds: typeof item.end_seconds === "number" ? item.end_seconds : undefined,
      confidence: typeof item.confidence === "number" ? item.confidence : undefined,
    });
  }
  return turns.length > 0 ? turns : null;
}

export function parseTranscriptSegments(value: unknown): TranscriptSegment[] | null {
  if (!Array.isArray(value)) return null;
  const segments: TranscriptSegment[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.text !== "string") continue;
    segments.push({
      start: typeof item.start === "number" ? item.start : 0,
      end: typeof item.end === "number" ? item.end : 0,
      text: item.text,
      is_final: item.is_final === true,
      segment_index:
        typeof item.segment_index === "number" ? item.segment_index : undefined,
    });
  }
  return segments.length > 0 ? segments : null;
}
