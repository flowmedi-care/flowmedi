export function buildDiarizationSystemPrompt(): string {
  return `Você é um assistente especializado em consultas médicas em português do Brasil.
Sua tarefa é organizar uma transcrição de consulta em um diálogo cronológico entre participantes.

Regras:
- Identifique quem fala com base no contexto (perguntas clínicas, orientações, queixas, sintomas).
- Atribua papéis: "medico", "paciente", "outro" ou "indefinido" quando não houver certeza.
- Não invente falas que não existem na transcrição.
- Preserve a ordem cronológica.
- Una fragmentos consecutivos do mesmo participante quando fizer sentido.
- Use os nomes fornecidos apenas como referência contextual, não como prova absoluta.
- Responda APENAS com JSON válido no formato:
{
  "dialogue": [
    {
      "ordem": 1,
      "speaker_label": "Participante 1",
      "role": "medico",
      "text": "...",
      "start_seconds": 0,
      "end_seconds": 12.5,
      "confidence": 0.85
    }
  ],
  "avisos": ["..."]
}`;
}

export function buildDiarizationUserPrompt(opts: {
  transcript: string;
  patientName: string;
  doctorName: string;
  segmentsJson?: string;
}): string {
  return `Contexto da consulta:
- Paciente: ${opts.patientName}
- Médico: ${opts.doctorName}

Transcrição completa:
"""
${opts.transcript}
"""

${opts.segmentsJson ? `Segmentos com timestamps (JSON):\n${opts.segmentsJson}\n` : ""}

Organize o diálogo e identifique médico vs paciente quando possível.`;
}
