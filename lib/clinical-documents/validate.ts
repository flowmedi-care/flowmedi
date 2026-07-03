import type { ClinicalDocumentType, StructuredContent } from "./types";
import { isCertificateContent, isExamOrderContent } from "./render";

export function validateClinicalDocumentContent(
  type: ClinicalDocumentType,
  structured: StructuredContent
): string | null {
  if (type === "prescription" && "medications" in structured) {
    const hasMed = structured.medications.some((m) => m.name.trim());
    if (!hasMed) return "Adicione pelo menos um medicamento.";
    return null;
  }

  if (type === "exam_request" && isExamOrderContent(structured)) {
    const hasExam = structured.examLines.some((l) => l.name.trim());
    if (!hasExam) return "Adicione pelo menos um exame.";
    return null;
  }

  if (type === "certificate" && isCertificateContent(structured)) {
    if (!structured.certificateBody.trim()) return "Informe o texto do atestado.";
    const days = structured.certificateDays ?? 1;
    if (days < 1) return "Informe pelo menos 1 dia de afastamento.";
    return null;
  }

  return "Conteúdo do documento inválido.";
}
