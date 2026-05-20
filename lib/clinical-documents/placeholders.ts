import type { DocumentRenderContext, StructuredContent, ClinicalDocumentType } from "./types";

function formatDateBr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const birth = new Date(birthDate.includes("T") ? birthDate : `${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return "—";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? String(age) : "—";
}

function formatCpfDisplay(cpf: string | null): string {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return "—";
  return phone;
}

export function buildPlaceholderMap(ctx: DocumentRenderContext): Record<string, string> {
  const crmPart =
    ctx.doctor.crm && ctx.doctor.crm_uf
      ? `CRM/${ctx.doctor.crm_uf} ${ctx.doctor.crm}`
      : ctx.doctor.crm
        ? `CRM ${ctx.doctor.crm}`
        : "—";

  return {
    "{{nome_paciente}}": ctx.patient.full_name,
    "{{cpf_paciente}}": formatCpfDisplay(ctx.patient.cpf),
    "{{data_nascimento}}": formatDateBr(ctx.patient.birth_date),
    "{{idade}}": calcAge(ctx.patient.birth_date),
    "{{telefone_paciente}}": formatPhoneDisplay(ctx.patient.phone),
    "{{data_emissao}}": ctx.emission_date,
    "{{nome_medico}}": ctx.doctor.full_name,
    "{{crm_medico}}": crmPart,
    "{{nome_clinica}}": ctx.clinic.name,
    "{{endereco_clinica}}": ctx.clinic.address ?? "—",
    "{{telefone_clinica}}": ctx.clinic.phone ?? "—",
  };
}

export function applyPlaceholders(text: string, map: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(map)) {
    out = out.split(key).join(value);
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function structuredContentToHtml(
  type: ClinicalDocumentType,
  content: StructuredContent
): string {
  if (type === "prescription" && "medications" in content) {
    const items = content.medications.filter((m) => m.name.trim());
    if (items.length === 0) return "";
    const rows = items
      .map(
        (m, i) =>
          `<li><strong>${i + 1}. ${escapeHtml(m.name)}</strong>` +
          (m.dosage ? ` — ${escapeHtml(m.dosage)}` : "") +
          (m.quantity ? ` (${escapeHtml(m.quantity)})` : "") +
          (m.instructions ? `<br/><span style="font-size:0.9em">${escapeHtml(m.instructions)}</span>` : "") +
          `</li>`
      )
      .join("");
    return `<ul class="structured-list">${rows}</ul>`;
  }
  if (type === "exam_request" && "exams" in content) {
    const items = content.exams.filter((e) => e.name.trim());
    if (items.length === 0) return "";
    const rows = items
      .map(
        (e, i) =>
          `<li><strong>${i + 1}. ${escapeHtml(e.name)}</strong>` +
          (e.notes ? `<br/><span style="font-size:0.9em">${escapeHtml(e.notes)}</span>` : "") +
          `</li>`
      )
      .join("");
    return `<ul class="structured-list">${rows}</ul>`;
  }
  return "";
}

export function bodyTextToHtmlParagraphs(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
