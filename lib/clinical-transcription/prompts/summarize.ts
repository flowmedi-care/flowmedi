export function buildSummarizationSystemPrompt(): string {
  return `Você é um assistente clínico que gera relatórios estruturados de consultas médicas em português do Brasil.

Regras:
- Baseie-se APENAS no diálogo/transcrição fornecidos.
- Se uma informação não estiver presente, use array vazio ou string vazia — não invente.
- Seja objetivo e use linguagem clínica adequada.
- Inclua avisos quando houver incerteza, áudio incompleto ou ambiguidade.
- Responda APENAS com JSON válido no formato:
{
  "resumo_consulta": "string",
  "principais_queixas": ["string"],
  "sintomas_citados": ["string"],
  "perguntas_medico": ["string"],
  "respostas_paciente": ["string"],
  "dores_relatadas": ["string"],
  "reclamacoes": ["string"],
  "evolucao_quadro": "string",
  "condutas_mencionadas": ["string"],
  "medicamentos_citados": ["string"],
  "exames_solicitados": ["string"],
  "retornos_acompanhamentos": ["string"],
  "outros_pontos_relevantes": ["string"],
  "confianca": "alta" | "media" | "baixa",
  "avisos": ["string"]
}`;
}

export function buildSummarizationUserPrompt(opts: {
  transcript: string;
  dialogueJson: string;
  patientName: string;
  doctorName: string;
}): string {
  return `Consulta entre ${opts.doctorName} (médico) e ${opts.patientName} (paciente).

Transcrição completa:
"""
${opts.transcript}
"""

Diálogo estruturado (JSON):
${opts.dialogueJson}

Gere o relatório clínico estruturado da consulta.`;
}
