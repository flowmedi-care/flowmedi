import type { DocumentRenderContext, ExamOrderLine } from "./types";
import { buildPlaceholderMap } from "./placeholders";

function logoImg(url: string | null, scale: number | null, alt: string): string {
  if (!url) return "";
  const pct = scale && scale > 0 ? scale : 100;
  const maxH = Math.round(52 * (pct / 100));
  return `<img src="${url}" alt="${alt}" style="max-height:${maxH}px;max-width:180px;object-fit:contain" />`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type RenderExamRequestInput = {
  ctx: DocumentRenderContext;
  examLines: ExamOrderLine[];
  examNotes?: string;
  qrCodeUrl?: string | null;
};

export function renderExamRequestModernHtml(input: RenderExamRequestInput): string {
  const map = buildPlaceholderMap(input.ctx);
  const lines = input.examLines.filter((l) => l.name.trim());

  const examListHtml = lines
    .map(
      (line, i) => `
      <div class="exam-line">
        <p class="exam-line-name"><span class="exam-num">${i + 1}.</span> ${escapeHtml(line.name)}</p>
        ${
          line.details.trim()
            ? `<p class="exam-line-details">${escapeHtml(line.details).replace(/\n/g, "<br/>")}</p>`
            : ""
        }
      </div>`
    )
    .join("");

  const clinicLogo = logoImg(
    input.ctx.clinic.logo_url,
    input.ctx.clinic.logo_scale,
    input.ctx.clinic.name
  );

  const qrHtml = input.qrCodeUrl
    ? `<img src="${escapeHtml(input.qrCodeUrl)}" alt="QR Code" class="qr-img" width="72" height="72" />`
    : "";

  const crmLine = map["{{crm_medico}}"];
  const birthDisplay = map["{{data_nascimento}}"];
  const emissionDate = map["{{data_emissao}}"];

  const notesBlock = input.examNotes?.trim()
    ? `<div class="exam-notes"><strong>Observações gerais:</strong> ${escapeHtml(input.examNotes).replace(/\n/g, "<br/>")}</div>`
    : "";

  const contactParts = [
    input.ctx.clinic.phone ? escapeHtml(input.ctx.clinic.phone) : "",
    input.ctx.clinic.email ? escapeHtml(input.ctx.clinic.email) : "",
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Solicitação de exames</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 11pt;
      color: #1a3339;
      background: #fff;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 14mm 16mm;
      min-height: 277mm;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #0d6b7d;
      margin-bottom: 16px;
    }
    .header-left { flex: 1; }
    .clinic-name { font-size: 11pt; font-weight: 600; color: #0d6b7d; margin-top: 6px; }
    .doctor-block { text-align: right; }
    .doctor-name {
      font-family: Georgia, serif;
      font-size: 13pt;
      font-weight: 600;
      color: #0d3d4a;
    }
    .doctor-crm { font-size: 9pt; color: #5a7a85; margin-top: 2px; }
    .qr-img { display: block; margin-top: 6px; margin-left: auto; border-radius: 4px; }
    .title-badge {
      display: inline-block;
      background: #0d6b7d;
      color: #fff;
      font-size: 10pt;
      font-weight: 600;
      padding: 6px 18px;
      border-radius: 18px;
      margin-bottom: 16px;
    }
    .patient-simple {
      font-size: 10.5pt;
      margin-bottom: 18px;
      line-height: 1.6;
    }
    .patient-simple strong { color: #0d5c6d; font-weight: 600; }
    .exam-list { flex: 1; }
    .exam-line {
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e8f0f2;
    }
    .exam-line:last-child { border-bottom: none; }
    .exam-line-name { font-weight: 600; font-size: 11pt; color: #0d3d4a; margin-bottom: 4px; }
    .exam-num { color: #0d6b7d; }
    .exam-line-details {
      font-size: 10pt;
      color: #3d5a63;
      line-height: 1.45;
      padding-left: 18px;
      margin: 0;
    }
    .exam-notes {
      margin-top: 12px;
      padding: 10px 12px;
      background: #f4fafb;
      border-radius: 6px;
      font-size: 10pt;
      border-left: 3px solid #0d6b7d;
    }
    .sign-footer {
      margin-top: auto;
      padding-top: 24px;
      display: flex;
      justify-content: flex-end;
    }
    .sign-block {
      width: 55%;
      text-align: right;
    }
    .sign-date {
      font-size: 10pt;
      color: #3d5a63;
      margin-bottom: 28px;
    }
    .sign-area {
      border-top: 1px solid #8eb4c0;
      padding-top: 6px;
      min-height: 22mm;
    }
    .sign-label {
      font-size: 8.5pt;
      color: #5a7a85;
      text-align: right;
    }
    .footer-contact {
      margin-top: 12px;
      font-size: 8pt;
      color: #7a949c;
      text-align: center;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="header-left">
        ${clinicLogo}
        <p class="clinic-name">${escapeHtml(input.ctx.clinic.name)}</p>
      </div>
      <div class="doctor-block">
        <p class="doctor-name">${escapeHtml(map["{{nome_medico}}"])}</p>
        <p class="doctor-crm">${escapeHtml(crmLine)}</p>
        ${qrHtml}
      </div>
    </header>

    <div class="title-badge">Solicitação de exames</div>

    <div class="patient-simple">
      <p><strong>Paciente:</strong> ${escapeHtml(map["{{nome_paciente}}"])}</p>
      <p><strong>Data de nascimento:</strong> ${birthDisplay}</p>
    </div>

    <div class="exam-list">
      ${examListHtml || "<p style='color:#888'>Nenhum exame informado.</p>"}
    </div>
    ${notesBlock}

    <div class="sign-footer">
      <div class="sign-block">
        <p class="sign-date">${escapeHtml(emissionDate)}</p>
        <div class="sign-area"></div>
        <p class="sign-label">Assinatura e carimbo do médico</p>
      </div>
    </div>

    ${contactParts.length ? `<p class="footer-contact">${contactParts.join(" · ")}</p>` : ""}
  </div>
</body>
</html>`;
}
